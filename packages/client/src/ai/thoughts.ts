/**
 * Bulles de pensée contextuelles. Chaque clé est traduite par i18n (`thoughts.<clé>`).
 * Le choix dépend de l'activité, du profil, du moral et de l'état de la prod.
 */
import type { DevActivity, DevRole } from '../view/types';
import type { Random } from './random';

const BY_ACTIVITY: Record<DevActivity, readonly string[]> = {
  WORKING: ['whyWorks', 'whyNotWorks', 'worksOnMyMachine', 'stackOverflow', 'oneMoreTest'],
  COFFEE: ['coffeeFuel', 'thirdCup'],
  MEETING: ['couldBeEmail', 'youAreMuted'],
  CHATTING: ['didYouSee', 'newFramework'],
  ARGUING: ['tabsVsSpaces', 'yourCode'],
  SLEEPING: ['zzz'],
  YELLING: ['whyNotWorks', 'aaargh'],
  BABYFOOT: ['goal', 'gamelle'],
  BREAK: ['snack', 'stretch', 'fridgeThief'],
  LUNCH: ['ramen', 'lunchDebate', 'fridgeThief'],
  LEAVING: ['seeYouTomorrow'],
  REMOTE: [],
};

const BY_ROLE: Record<DevRole, string> = {
  SENIOR_BEARD: 'tooYoungFramework',
  TEN_X: 'noComments',
  INTERN: 'pushMain',
  RUSTACEAN: 'rewriteInRust',
  DESIGNER: 'paddingWrong',
  PRODUCT_OWNER: 'anotherMeeting',
  AI_AGENT: 'hallucination',
  GHOST: 'boo',
};

export interface ThoughtContext {
  readonly activity: DevActivity;
  readonly role: DevRole;
  readonly morale: number;
  readonly incident: boolean;
  readonly fridayFive: boolean;
}

/** Choisit une pensée, ou `null` si le personnage n'a rien à dire. */
export function pickThought(context: ThoughtContext, random: Random): string | null {
  if (context.activity === 'REMOTE') return null;
  if (context.incident && random.chance(0.6)) return 'prodDown';
  if (context.fridayFive && random.chance(0.4)) return 'fridayDeploy';
  if (context.morale < 25 && random.chance(0.5)) return 'quit';
  if (random.chance(0.25)) return BY_ROLE[context.role];
  const pool = BY_ACTIVITY[context.activity];
  return pool.length > 0 ? random.pick(pool) : null;
}

/** Toutes les clés possibles : sert à vérifier que les traductions sont complètes. */
export const ALL_THOUGHTS: readonly string[] = [
  'prodDown',
  'fridayDeploy',
  'quit',
  ...Object.values(BY_ROLE),
  ...Object.values(BY_ACTIVITY).flat(),
];
