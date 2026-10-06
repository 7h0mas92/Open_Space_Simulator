import type { LocalizedText, SlackAiMessage } from '@oss/shared';
import type { DevView, GameNotification, GameView } from '../view/types';
import {
  TEMPLATES_BY_TRIGGER,
  type AmbientTrigger,
  type SlackChannel,
  type SlackTemplate,
  type SlackTrigger,
} from './templates';

/** Un message affiché dans le panneau Slack. */
export interface SlackMessage {
  readonly id: number;
  readonly channel: SlackChannel;
  /** Prénom du dev, ou nom du bot. */
  readonly author: string;
  readonly bot: boolean;
  readonly text: LocalizedText;
  /** Minute de la journée simulée, pour l'horodatage. */
  readonly minute: number;
  /** Message écrit par l'IA (mode IA) plutôt que tiré des templates. */
  readonly ai: boolean;
}

export type Random = () => number;

/**
 * Probabilité qu'une notification donne lieu à un message : les plus fréquentes (tâches
 * finies, cartes tirées) ne doivent pas noyer le canal.
 */
const CHANCE: Partial<Record<SlackTrigger, number>> = {
  TASK_DONE: 0.25,
  FEATURE_DONE: 0.6,
  CARD_DRAWN: 0.4,
  CARD_RESOLVED: 0.7,
  SPRINT_STARTED: 0.8,
  DEV_LEVEL_UP: 0.6,
};

const BOT_NAMES = {
  oncall: 'OnCall Bot',
  github: 'GitHub',
  hr: 'RH Bot',
  investors: 'Board',
  coffee: 'Café 3000',
} as const;

const pick = <T>(list: readonly T[], random: Random): T | undefined =>
  list[Math.floor(random() * list.length)];

/** Remplace {name}, {other}, {event} et {sprint} dans les deux langues. */
export function fillTemplate(
  text: LocalizedText,
  params: { name: string; other: string; event?: LocalizedText; sprint: number },
): LocalizedText {
  const fill = (template: string, locale: 'fr' | 'en') =>
    template
      .replaceAll('{name}', params.name)
      .replaceAll('{other}', params.other)
      .replaceAll('{event}', params.event?.[locale] ?? '')
      .replaceAll('{sprint}', String(params.sprint));
  return { fr: fill(text.fr, 'fr'), en: fill(text.en, 'en') };
}

/** Choisit qui écrit : un dev du bon profil, ou n'importe qui (sauf si personne ne convient). */
function authorFor(template: SlackTemplate, devs: readonly DevView[], random: Random) {
  if (template.author.kind === 'bot') return { name: BOT_NAMES[template.author.bot], bot: true };
  const role = template.author.role;
  const candidates = role ? devs.filter((dev) => dev.role === role) : devs;
  const dev = pick(candidates, random);
  return dev ? { name: dev.name, bot: false, dev } : null;
}

let nextId = 1;

/** Un message tiré des templates pour un déclencheur, ou null si aucun ne convient. */
export function templateMessage(
  trigger: SlackTrigger,
  view: GameView,
  random: Random,
  event?: LocalizedText,
): SlackMessage | null {
  const templates = TEMPLATES_BY_TRIGGER.get(trigger) ?? [];
  // On essaie quelques templates : un template de profil n'a pas d'auteur sans ce profil.
  for (let attempt = 0; attempt < 4; attempt++) {
    const template = pick(templates, random);
    if (!template) return null;
    const author = authorFor(template, view.devs, random);
    if (!author) continue;
    const others = view.devs.filter((dev) => dev.name !== author.name);
    const other = pick(others, random)?.name ?? author.name;
    return {
      id: nextId++,
      channel: template.channel,
      author: author.name,
      bot: author.bot,
      text: fillTemplate(template.text, {
        name: author.name,
        other,
        event,
        sprint: view.time.sprint,
      }),
      minute: view.time.minute,
      ai: false,
    };
  }
  return null;
}

/** Messages de templates pour un lot de notifications de la simulation. */
export function messagesForNotifications(
  notifications: readonly GameNotification[],
  view: GameView,
  random: Random,
): SlackMessage[] {
  const messages: SlackMessage[] = [];
  for (const notification of notifications) {
    if (random() > (CHANCE[notification.kind] ?? 1)) continue;
    const message = templateMessage(notification.kind, view, random, notification.text);
    if (message) messages.push(message);
  }
  return messages;
}

/** Moments d'ambiance déclenchés quand l'heure simulée passe un cap. */
const HOURS: readonly [number, AmbientTrigger][] = [
  [9, 'MORNING'],
  [12, 'LUNCH'],
  [15, 'AFTERNOON'],
  [18, 'EVENING'],
];

/** Déclencheurs d'ambiance entre deux instantanés (heure de la journée, jauges). */
export function ambientTriggers(previous: GameView, view: GameView): AmbientTrigger[] {
  if (previous.time.day === view.time.day && previous.time.minute >= view.time.minute) return [];
  const weekday = view.time.day % 7;
  if (weekday >= 5) return [];
  const crossed = (hour: number) =>
    (previous.time.day !== view.time.day || previous.time.minute < hour * 60) &&
    view.time.minute >= hour * 60;
  const triggers: AmbientTrigger[] = [];
  for (const [hour, trigger] of HOURS) if (crossed(hour)) triggers.push(trigger);
  if (crossed(9)) {
    if (weekday === 0) triggers.push('MONDAY');
    if (weekday === 4) triggers.push('FRIDAY');
    const morale = view.devs.reduce((sum, dev) => sum + dev.morale, 0) / (view.devs.length || 1);
    if (view.gauges.coffee < 20) triggers.push('LOW_COFFEE');
    if (morale < 35) triggers.push('LOW_MORALE');
    if (view.gauges.debt > 70) triggers.push('HIGH_DEBT');
    if (view.gauges.treasury < 150_000) triggers.push('LOW_TREASURY');
    if (view.gauges.hype > 75) triggers.push('HIGH_HYPE');
  }
  return triggers;
}

/** Messages d'ambiance (on n'en garde qu'une partie pour laisser respirer le canal). */
export function ambientMessages(
  previous: GameView,
  view: GameView,
  random: Random,
): SlackMessage[] {
  return ambientTriggers(previous, view).flatMap((trigger) => {
    if (random() > 0.5) return [];
    const message = templateMessage(trigger, view, random);
    return message ? [message] : [];
  });
}

/** Message écrit par l'IA : rédigé dans une seule langue, affiché tel quel dans les deux. */
export function aiMessage(message: SlackAiMessage, view: GameView): SlackMessage {
  const author = view.devs.find((dev) => dev.name === message.author);
  return {
    id: nextId++,
    channel: message.channel,
    author: author?.name ?? message.author,
    bot: author === undefined,
    text: { fr: message.text, en: message.text },
    minute: view.time.minute,
    ai: true,
  };
}
