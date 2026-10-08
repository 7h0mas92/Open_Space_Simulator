/**
 * Slack simulé : trois canaux alimentés par les templates (par défaut) ou par l'IA du
 * serveur (option). L'IA n'écrit que des messages : elle ne touche jamais à la partie.
 */
import type { SlackAiRequest } from '@oss/shared';
import { create } from 'zustand';
import i18n from '../i18n';
import type { GameNotification, GameView } from '../view/types';
import {
  ambientMessages,
  chanceOf,
  messagesForNotifications,
  templateMessage,
  type Random,
  type SlackMessage,
} from './generator';
import { isUrgent, SlackPacer } from './pacing';
import { SLACK_CHANNELS, type SlackChannel } from './templates';

/** Messages gardés par canal. */
export const MAX_MESSAGES = 60;
/** Délai minimum entre deux appels à l'IA (le quota serveur reste la vraie limite). */
export const AI_COOLDOWN_MS = 45_000;

/** Événements assez marquants pour mériter une réaction écrite par l'IA. */
const AI_KINDS = new Set([
  'PROD_DOWN',
  'CARD_RESOLVED',
  'FUNDS_RAISED',
  'PITCH_FAILED',
  'DEV_RESIGNED',
  'DEV_FIRED',
  'DEV_HIRED',
  'PHASE_UP',
  'HALLUCINATION',
  'GAME_OVER',
]);

export type AiState = 'off' | 'on' | 'unavailable' | 'quota';

interface SlackStore {
  channel: SlackChannel;
  messages: Record<SlackChannel, SlackMessage[]>;
  unread: Record<SlackChannel, number>;
  /** État du mode IA pour cette session (repli sur les templates si indisponible). */
  ai: AiState;
  open: boolean;
  setChannel(channel: SlackChannel): void;
  setOpen(open: boolean): void;
  add(messages: readonly SlackMessage[]): void;
  reset(): void;
  setAi(ai: AiState): void;
}

const empty = <T>(value: () => T) =>
  Object.fromEntries(SLACK_CHANNELS.map((channel) => [channel, value()])) as Record<
    SlackChannel,
    T
  >;

export const useSlack = create<SlackStore>((set, get) => ({
  channel: 'general',
  messages: empty<SlackMessage[]>(() => []),
  unread: empty(() => 0),
  ai: 'off',
  open: false,

  setChannel(channel) {
    set({ channel, unread: { ...get().unread, [channel]: 0 } });
  },

  setOpen(open) {
    const { channel, unread } = get();
    set({ open, unread: open ? { ...unread, [channel]: 0 } : unread });
  },

  add(incoming) {
    if (incoming.length === 0) return;
    const { messages, unread, channel, open } = get();
    const nextMessages = { ...messages };
    const nextUnread = { ...unread };
    for (const message of incoming) {
      nextMessages[message.channel] = [...nextMessages[message.channel], message].slice(
        -MAX_MESSAGES,
      );
      if (!(open && message.channel === channel)) nextUnread[message.channel] += 1;
    }
    set({ messages: nextMessages, unread: nextUnread });
  },

  reset() {
    set({ messages: empty<SlackMessage[]>(() => []), unread: empty(() => 0) });
  },

  setAi(ai) {
    set({ ai });
  },
}));

/** Résumé envoyé au serveur pour le mode IA : jamais l'état complet de la partie. */
export function aiRequest(view: GameView, notification: GameNotification): SlackAiRequest {
  const locale = i18n.resolvedLanguage === 'en' ? 'en' : 'fr';
  return {
    locale,
    event: { kind: notification.kind, text: notification.text[locale].slice(0, 300) },
    game: {
      phase: view.phase,
      sprint: Math.min(view.time.sprint, 39),
      gauges: { ...view.gauges },
    },
    devs: view.devs.slice(0, 8).map((dev) => ({
      name: dev.name.slice(0, 40),
      role: dev.role,
      trait: dev.trait,
      morale: Math.round(dev.morale),
    })),
  };
}

export interface SlackFeedOptions {
  random?: Random;
  /** Appel au serveur pour le mode IA (null : templates seulement). */
  callAi?: ((request: SlackAiRequest) => Promise<SlackMessage[]>) | null;
  now?: () => number;
}

/**
 * Le fil Slack d'une partie : reçoit les notifications et les instantanés, produit les
 * messages. Le débit est limité (voir pacing.ts) pour que le canal reste lisible, même en x4.
 * Le mode IA remplace le template d'un événement marquant ; en cas d'échec, le template est
 * utilisé et l'IA est mise en pause pour la session.
 */
export class SlackFeed {
  private lastAiCall = Number.NEGATIVE_INFINITY;
  private readonly random: Random;
  private readonly now: () => number;
  private readonly pacer: SlackPacer;

  constructor(private readonly options: SlackFeedOptions = {}) {
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
    this.pacer = new SlackPacer(this.now);
  }

  /** Messages de templates pour un lot, les urgents d'abord, dans la limite du débit. */
  private templateMessages(
    view: GameView,
    notifications: readonly GameNotification[],
  ): SlackMessage[] {
    const ordered = [
      ...notifications.filter((n) => isUrgent(n.kind)),
      ...notifications.filter((n) => !isUrgent(n.kind)),
    ];
    const messages: SlackMessage[] = [];
    for (const notification of ordered) {
      if (this.random() > chanceOf(notification.kind)) continue;
      if (!this.pacer.take(isUrgent(notification.kind))) continue;
      const message = templateMessage(notification.kind, view, this.random, notification.text);
      if (message) messages.push(message);
    }
    return messages;
  }

  onNotifications(view: GameView, notifications: readonly GameNotification[]): void {
    const slack = useSlack.getState();
    const callAi = this.options.callAi;
    const important = notifications.findLast((n) => AI_KINDS.has(n.kind));
    // L'IA a besoin d'au moins un dev pour écrire ; sinon on reste sur les templates.
    const useAi =
      callAi &&
      slack.ai === 'on' &&
      important &&
      view.devs.length > 0 &&
      this.now() - this.lastAiCall >= AI_COOLDOWN_MS;
    const rest = useAi ? notifications.filter((n) => n !== important) : notifications;
    slack.add(this.templateMessages(view, rest));
    if (!useAi || !important || !callAi) return;
    if (!this.pacer.take(isUrgent(important.kind))) return;

    this.lastAiCall = this.now();
    callAi(aiRequest(view, important))
      .then((messages) => {
        // L'IA écrit jusqu'à 3 messages : le premier est déjà compté, les autres attendent
        // qu'il reste de la place dans le canal.
        const [first, ...others] = messages;
        const kept = first ? [first, ...others.filter(() => this.pacer.take())] : [];
        useSlack.getState().add(kept);
      })
      .catch((error: unknown) => {
        const code = (error as { code?: string }).code;
        useSlack.getState().setAi(code === 'AI_QUOTA_EXCEEDED' ? 'quota' : 'unavailable');
        useSlack.getState().add(messagesForNotifications([important], view, () => 0));
      });
  }

  onView(previous: GameView, view: GameView): void {
    useSlack.getState().add(ambientMessages(previous, view, this.random, () => this.pacer.take()));
  }
}
