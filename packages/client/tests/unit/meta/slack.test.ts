import type { LocalizedText, SlackAiRequest } from '@oss/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../../src/api/client';
import i18n from '../../../src/i18n';
import {
  aiMessage,
  ambientMessages,
  ambientTriggers,
  fillTemplate,
  messagesForNotifications,
  templateMessage,
  type SlackMessage,
} from '../../../src/slack/generator';
import {
  AI_COOLDOWN_MS,
  aiRequest,
  MAX_MESSAGES,
  SlackFeed,
  useSlack,
} from '../../../src/slack/store';
import {
  TEMPLATES_BY_TRIGGER,
  type SlackChannel,
  type SlackTemplate,
  type SlackTrigger,
} from '../../../src/slack/templates';
import type { GameNotification, GameView } from '../../../src/view/types';
import { gameView } from './helpers';

const view = gameView();

/** Une vue à un moment précis (jour du sprint, minute de la journée). */
function at(day: number, minute: number, base: GameView = view): GameView {
  return { ...base, time: { ...base.time, day, minute } };
}

function notification(
  kind: GameNotification['kind'],
  text = 'Il s’est passé un truc',
): GameNotification {
  return { tick: 1, kind, text: { fr: text, en: text }, entityId: null };
}

let fakeId = 10_000;
function message(channel: SlackChannel, text = 'coucou'): SlackMessage {
  return {
    id: fakeId++,
    channel,
    author: 'Kevin',
    bot: false,
    text: { fr: text, en: text },
    minute: 600,
    ai: false,
  };
}

/** Premier template (et son index) qui vérifie une condition. */
function findTemplate(accept: (template: SlackTemplate) => boolean): {
  trigger: SlackTrigger;
  index: number;
  count: number;
  template: SlackTemplate;
} {
  for (const [trigger, templates] of TEMPLATES_BY_TRIGGER) {
    const index = templates.findIndex(accept);
    const template = templates[index];
    if (template) return { trigger, index, count: templates.length, template };
  }
  throw new Error('Aucun template ne convient');
}

/** Hasard truqué qui tire toujours l'élément `index` d'une liste de `count` éléments. */
const always = (index: number, count: number) => () => (index + 0.5) / count;

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  useSlack.setState({ channel: 'general', open: false, ai: 'off' });
  useSlack.getState().reset();
});

describe('fillTemplate', () => {
  it('remplace tous les placeholders dans les deux langues', () => {
    const text: LocalizedText = {
      fr: '{name} accuse {other} : {event} (sprint {sprint}) — signé {name}',
      en: '{name} blames {other}: {event} (sprint {sprint})',
    };
    const filled = fillTemplate(text, {
      name: 'Kevin',
      other: 'Jade',
      event: { fr: 'la prod est tombée', en: 'prod is down' },
      sprint: 7,
    });
    expect(filled).toEqual({
      fr: 'Kevin accuse Jade : la prod est tombée (sprint 7) — signé Kevin',
      en: 'Kevin blames Jade: prod is down (sprint 7)',
    });
  });

  it('remplace {event} par une chaîne vide sans événement', () => {
    const filled = fillTemplate(
      { fr: '[{event}]', en: '[{event}]' },
      {
        name: 'a',
        other: 'b',
        sprint: 1,
      },
    );
    expect(filled).toEqual({ fr: '[]', en: '[]' });
  });
});

describe('templateMessage', () => {
  it('fait écrire un bot avec son nom et le canal du template', () => {
    const { trigger, index, count, template } = findTemplate((t) => t.author.kind === 'bot');
    const msg = templateMessage(trigger, view, always(index, count));
    expect(msg).not.toBeNull();
    expect(msg?.bot).toBe(true);
    expect(msg?.channel).toBe(template.channel);
    expect(msg?.ai).toBe(false);
    expect(msg?.minute).toBe(view.time.minute);
    expect(view.devs.map((d) => d.name)).not.toContain(msg?.author);
  });

  it('fait écrire un dev de l’équipe et remplit les placeholders', () => {
    const { trigger, index, count } = findTemplate(
      (t) => t.author.kind === 'dev' && t.author.role === undefined,
    );
    const msg = templateMessage(trigger, view, always(index, count), {
      fr: 'événement',
      en: 'event',
    });
    expect(msg?.bot).toBe(false);
    expect(view.devs.map((d) => d.name)).toContain(msg?.author);
    expect(msg?.text.fr).not.toMatch(/\{(name|other|event|sprint)\}/);
    expect(msg?.text.en).not.toMatch(/\{(name|other|event|sprint)\}/);
  });

  it('glisse le texte de l’événement dans {event}', () => {
    const { trigger, index, count } = findTemplate(
      (t) =>
        t.text.fr.includes('{event}') && (t.author.kind === 'bot' || t.author.role === undefined),
    );
    const msg = templateMessage(trigger, view, always(index, count), {
      fr: 'la feature « dark mode »',
      en: 'the "dark mode" feature',
    });
    expect(msg?.text.fr).toContain('la feature « dark mode »');
    expect(msg?.text.en).toContain('the "dark mode" feature');
  });

  it('sans équipe, seuls les bots peuvent écrire', () => {
    const empty = gameView({ devs: [] });
    for (const trigger of TEMPLATES_BY_TRIGGER.keys()) {
      for (const r of [0, 0.3, 0.7, 0.99]) {
        const msg = templateMessage(trigger, empty, () => r);
        if (msg) expect(msg.bot).toBe(true);
      }
    }
  });

  it('donne un identifiant unique à chaque message', () => {
    const { trigger } = findTemplate((t) => t.author.kind === 'bot');
    const ids = Array.from({ length: 5 }, () => templateMessage(trigger, view, () => 0)?.id);
    expect(new Set(ids).size).toBe(5);
  });
});

describe('messagesForNotifications', () => {
  it('ignore une partie des notifications fréquentes (tâche finie : 25 %)', () => {
    const notifications = [notification('TASK_DONE'), notification('TASK_DONE')];
    expect(messagesForNotifications(notifications, view, () => 0.9)).toEqual([]);
    expect(messagesForNotifications(notifications, view, () => 0).length).toBeGreaterThan(0);
  });

  it('garde toujours une panne de prod', () => {
    const messages = messagesForNotifications([notification('PROD_DOWN')], view, () => 0.99);
    expect(messages).toHaveLength(1);
  });
});

describe('ambientTriggers', () => {
  it('détecte le matin d’un lundi', () => {
    expect(ambientTriggers(at(0, 8 * 60), at(0, 9 * 60))).toEqual(['MORNING', 'MONDAY']);
  });

  it('détecte le vendredi et plusieurs caps franchis d’un coup', () => {
    const triggers = ambientTriggers(at(4, 8 * 60), at(4, 16 * 60));
    expect(triggers).toEqual(['MORNING', 'LUNCH', 'AFTERNOON', 'FRIDAY']);
  });

  it('ne déclenche rien si l’heure n’avance pas ou le week-end', () => {
    expect(ambientTriggers(at(1, 600), at(1, 600))).toEqual([]);
    expect(ambientTriggers(at(5, 8 * 60), at(5, 10 * 60))).toEqual([]);
    expect(ambientTriggers(at(13, 8 * 60), at(13, 19 * 60))).toEqual([]);
  });

  it('considère le passage à un nouveau jour', () => {
    expect(ambientTriggers(at(1, 20 * 60), at(2, 10 * 60))).toEqual(['MORNING']);
  });

  it('ajoute les alertes de jauges au matin', () => {
    const crisis = gameView({
      gauges: { ...view.gauges, coffee: 10, debt: 80, treasury: 100_000, hype: 90 },
      devs: view.devs.map((dev) => ({ ...dev, morale: 10 })),
    });
    const triggers = ambientTriggers(at(2, 8 * 60, crisis), at(2, 9 * 60, crisis));
    expect(triggers).toEqual([
      'MORNING',
      'LOW_COFFEE',
      'LOW_MORALE',
      'HIGH_DEBT',
      'LOW_TREASURY',
      'HIGH_HYPE',
    ]);
  });
});

describe('ambientMessages', () => {
  it('ne garde qu’une partie des moments d’ambiance', () => {
    expect(ambientMessages(at(0, 8 * 60), at(0, 9 * 60), () => 0.9)).toEqual([]);
    expect(ambientMessages(at(0, 8 * 60), at(0, 9 * 60), () => 0).length).toBeGreaterThan(0);
  });
});

describe('aiMessage', () => {
  it('attribue le message au dev s’il existe, sinon à un bot', () => {
    const dev = view.devs[0];
    if (!dev) throw new Error('équipe vide');
    const fromDev = aiMessage({ channel: 'random', author: dev.name, text: 'LGTM' }, view);
    expect(fromDev).toMatchObject({
      channel: 'random',
      author: dev.name,
      bot: false,
      ai: true,
      text: { fr: 'LGTM', en: 'LGTM' },
    });
    const fromBot = aiMessage({ channel: 'incidents', author: 'PagerDuty', text: '🔥' }, view);
    expect(fromBot.bot).toBe(true);
    expect(fromBot.author).toBe('PagerDuty');
  });
});

describe('useSlack', () => {
  it('compte les non-lus quand le panneau est fermé', () => {
    useSlack.getState().add([message('general'), message('incidents'), message('incidents')]);
    expect(useSlack.getState().unread).toEqual({ general: 1, random: 0, incidents: 2 });
    expect(useSlack.getState().messages.incidents).toHaveLength(2);
  });

  it('ne compte pas comme non lu un message du canal affiché', () => {
    useSlack.getState().setOpen(true);
    useSlack.getState().add([message('general'), message('random')]);
    expect(useSlack.getState().unread).toEqual({ general: 0, random: 1, incidents: 0 });
  });

  it('remet à zéro les non-lus du canal ouvert', () => {
    useSlack.getState().add([message('general'), message('random')]);
    useSlack.getState().setOpen(true);
    expect(useSlack.getState().unread.general).toBe(0);
    expect(useSlack.getState().unread.random).toBe(1);
    useSlack.getState().setChannel('random');
    expect(useSlack.getState().channel).toBe('random');
    expect(useSlack.getState().unread.random).toBe(0);
  });

  it(`garde au plus ${MAX_MESSAGES} messages par canal`, () => {
    const batch = Array.from({ length: MAX_MESSAGES + 5 }, (_, i) => message('random', `m${i}`));
    useSlack.getState().add(batch);
    const kept = useSlack.getState().messages.random;
    expect(kept).toHaveLength(MAX_MESSAGES);
    expect(kept[0]?.text.fr).toBe('m5');
    expect(kept.at(-1)?.text.fr).toBe(`m${MAX_MESSAGES + 4}`);
  });

  it('ignore un lot vide et se réinitialise', () => {
    const before = useSlack.getState().messages;
    useSlack.getState().add([]);
    expect(useSlack.getState().messages).toBe(before);
    useSlack.getState().add([message('general')]);
    useSlack.getState().reset();
    expect(useSlack.getState().messages.general).toEqual([]);
    expect(useSlack.getState().unread.general).toBe(0);
  });
});

describe('aiRequest', () => {
  it('envoie un résumé borné de la partie, jamais l’état complet', () => {
    const base = view.devs[0];
    if (!base) throw new Error('équipe vide');
    const devs = Array.from({ length: 10 }, (_, i) => ({
      ...base,
      id: `d${i}`,
      name: `${'X'.repeat(50)}${i}`,
      morale: 42.6,
    }));
    const big = gameView({ devs, time: { ...view.time, sprint: 45 } });
    const request = aiRequest(big, notification('PROD_DOWN', 'a'.repeat(400)));
    expect(request.locale).toBe('fr');
    expect(request.event).toEqual({ kind: 'PROD_DOWN', text: 'a'.repeat(300) });
    expect(request.game.sprint).toBe(39);
    expect(request.game.gauges).toEqual(big.gauges);
    expect(request.devs).toHaveLength(8);
    expect(request.devs[0]?.name).toHaveLength(40);
    expect(request.devs[0]?.morale).toBe(43);
    expect(Object.keys(request)).toEqual(['locale', 'event', 'game', 'devs']);
  });

  it('suit la langue de l’interface', async () => {
    await i18n.changeLanguage('en');
    expect(aiRequest(view, notification('PROD_DOWN')).locale).toBe('en');
  });
});

describe('SlackFeed', () => {
  const aiReply: SlackMessage = { ...message('incidents', 'écrit par Claude'), ai: true };

  it('utilise les templates quand le mode IA est coupé', () => {
    const callAi = vi.fn(async () => [aiReply]);
    const feed = new SlackFeed({ random: () => 0, callAi });
    feed.onNotifications(view, [notification('PROD_DOWN')]);
    expect(callAi).not.toHaveBeenCalled();
    expect(useSlack.getState().messages.incidents.length).toBeGreaterThan(0);
  });

  it('confie l’événement marquant à l’IA et le reste aux templates', async () => {
    useSlack.getState().setAi('on');
    const callAi = vi.fn(async (_request: SlackAiRequest) => [aiReply]);
    const feed = new SlackFeed({ random: () => 0, callAi, now: () => 1_000 });
    feed.onNotifications(view, [notification('SPRINT_STARTED'), notification('PROD_DOWN')]);

    expect(callAi).toHaveBeenCalledTimes(1);
    expect(callAi.mock.calls[0]?.[0].event.kind).toBe('PROD_DOWN');
    // Le message de template du début de sprint est publié tout de suite.
    const all = () => Object.values(useSlack.getState().messages).flat();
    expect(all().length).toBeGreaterThan(0);
    expect(all().some((m) => m.ai)).toBe(false);
    await vi.waitFor(() => expect(all()).toContainEqual(aiReply));
    expect(useSlack.getState().messages.incidents.filter((m) => !m.ai)).toEqual([]);
  });

  it('reste sur les templates quand il n’y a aucun dev pour écrire', () => {
    useSlack.getState().setAi('on');
    const callAi = vi.fn(async () => [aiReply]);
    const feed = new SlackFeed({ random: () => 0, callAi, now: () => 1_000 });
    feed.onNotifications(gameView({ devs: [] }), [notification('PROD_DOWN')]);
    expect(callAi).not.toHaveBeenCalled();
    expect(useSlack.getState().ai).toBe('on');
  });

  it('respecte le délai entre deux appels à l’IA', () => {
    useSlack.getState().setAi('on');
    let now = 50_000;
    const callAi = vi.fn(async () => [aiReply]);
    const feed = new SlackFeed({ random: () => 0, callAi, now: () => now });
    feed.onNotifications(view, [notification('PROD_DOWN')]);
    now += AI_COOLDOWN_MS - 1;
    feed.onNotifications(view, [notification('PROD_DOWN')]);
    expect(callAi).toHaveBeenCalledTimes(1);
    // Pendant le délai, l'événement passe par les templates.
    expect(useSlack.getState().messages.incidents.length).toBeGreaterThan(0);
    now += 1;
    feed.onNotifications(view, [notification('PROD_DOWN')]);
    expect(callAi).toHaveBeenCalledTimes(2);
  });

  it('n’appelle pas l’IA pour un événement banal', () => {
    useSlack.getState().setAi('on');
    const callAi = vi.fn(async () => [aiReply]);
    new SlackFeed({ random: () => 0, callAi }).onNotifications(view, [notification('TASK_DONE')]);
    expect(callAi).not.toHaveBeenCalled();
  });

  it('passe en « quota » et retombe sur les templates si le quota est épuisé', async () => {
    useSlack.getState().setAi('on');
    const callAi = vi.fn(async (): Promise<SlackMessage[]> => {
      throw new ApiRequestError(429, 'AI_QUOTA_EXCEEDED', 'quota');
    });
    new SlackFeed({ random: () => 0, callAi }).onNotifications(view, [notification('PROD_DOWN')]);
    expect(useSlack.getState().messages.incidents).toEqual([]);
    await vi.waitFor(() => expect(useSlack.getState().ai).toBe('quota'));
    expect(useSlack.getState().messages.incidents).toHaveLength(1);
  });

  it('passe en « indisponible » pour toute autre erreur', async () => {
    useSlack.getState().setAi('on');
    const callAi = vi.fn(async (): Promise<SlackMessage[]> => {
      throw new ApiRequestError(0, 'NETWORK_ERROR', 'injoignable');
    });
    new SlackFeed({ random: () => 0, callAi }).onNotifications(view, [notification('PROD_DOWN')]);
    await vi.waitFor(() => expect(useSlack.getState().ai).toBe('unavailable'));
    expect(useSlack.getState().messages.incidents).toHaveLength(1);
  });

  it('publie les messages d’ambiance entre deux instantanés', () => {
    new SlackFeed({ random: () => 0 }).onView(at(0, 8 * 60), at(0, 9 * 60));
    expect(Object.values(useSlack.getState().messages).flat().length).toBeGreaterThan(0);
  });
});
