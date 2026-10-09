import { z } from 'zod';
import type { Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';

/**
 * Salle de réunion : dès la première levée (Seed), le bureau a une salle de réunion vide. Le
 * joueur choisit comment l'aménager. Chaque formule a un bonus ET un malus, et change la
 * réunion d'équipe du matin (9h30, en semaine) : utile, elle rapporte quelque chose ; inutile,
 * elle coûte du moral (« cette réunion aurait pu être un mail »).
 *
 * Le hasard des réunions est tiré sur une graine à part (graine de la partie + tick) : une partie
 * sans salle aménagée consomme exactement les mêmes nombres aléatoires qu'avant l'ajout de la
 * fonctionnalité, ce qui garde valides les replays et le Daily.
 */

export const MEETING_FORMAT_IDS = [
  'standup',
  'brainstorm',
  'aquarium',
  'zen',
  'war-room',
  'boardroom',
] as const;
export const MeetingFormatIdSchema = z.enum(MEETING_FORMAT_IDS);
export type MeetingFormatId = z.infer<typeof MeetingFormatIdSchema>;

/** Salle aménagée (null tant que la salle est vide). */
export const MeetingRoomSchema = z.object({
  format: MeetingFormatIdSchema,
  /** Prix payé, pour le remboursement partiel au démontage. */
  paid: z.number().nonnegative(),
  fittedAtSprint: z.number().int(),
});
export type MeetingRoom = z.infer<typeof MeetingRoomSchema>;

/** Effet d'une réunion d'équipe : `moral` va à chaque participant, le reste aux jauges. */
export interface MeetingOutcomeEffects {
  treasury?: number;
  hype?: number;
  debt?: number;
  stability?: number;
  moral?: number;
}

/** Effets permanents d'une salle (mêmes unités que le mobilier, voir `FurnitureEffects`). */
export interface MeetingRoomEffects {
  moral?: number;
  teamProductivity?: number;
  quality?: number;
  hypePerDay?: number;
  stabilityPerDay?: number;
  restBonus?: number;
}

export interface MeetingFormat {
  id: MeetingFormatId;
  icon: string;
  name: LocalizedText;
  bonus: LocalizedText;
  malus: LocalizedText;
  price: number;
  minPhase: Phase;
  effects: MeetingRoomEffects;
  /** Multiplicateur du malus des réunions du Product Owner (1 = inchangé). */
  poPenalty: number;
  /** Chance que la réunion d'équipe du matin soit utile. */
  usefulOdds: number;
  useful: MeetingOutcomeEffects;
  useless: MeetingOutcomeEffects;
  /** Message affiché après une réunion utile, puis inutile. */
  usefulText: LocalizedText;
  uselessText: LocalizedText;
}

/** Réglages communs à toutes les salles. */
export const MEETINGS = {
  unlockPhase: 'SEED' as Phase,
  /** Heure de la réunion d'équipe quotidienne (en semaine). */
  dailyHour: 9.5,
  /** Part du prix remboursée quand on démonte la salle (ou qu'on change de formule). */
  refundRatio: 0.5,
} as const;

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

export const MEETING_FORMATS: readonly MeetingFormat[] = [
  {
    id: 'standup',
    icon: '⏱️',
    name: t('Salle stand-up', 'Stand-up room'),
    bonus: t(
      'Mange-debout, pas de chaise : les réunions du PO coûtent 2 fois moins.',
      'High tables, no chairs: Product Owner meetings cost half as much.',
    ),
    malus: t('On a mal aux pieds : léger −moral chaque jour.', 'Sore feet: slight −morale daily.'),
    price: 1500,
    minPhase: 'SEED',
    effects: { moral: -0.06 },
    poPenalty: 0.5,
    usefulOdds: 0.7,
    useful: { debt: -0.4 },
    useless: { moral: -0.5 },
    usefulText: t(
      'Stand-up en 7 minutes chrono : un bug repéré avant la prod.',
      '7-minute stand-up: a bug caught before production.',
    ),
    uselessText: t(
      'Le stand-up a duré 45 minutes. Debout.',
      'The stand-up lasted 45 minutes. Standing.',
    ),
  },
  {
    id: 'brainstorm',
    icon: '💡',
    name: t('Salle brainstorming', 'Brainstorming room'),
    bonus: t(
      'Tableau blanc et post-it : +3 % de qualité, idées qui font de la hype.',
      'Whiteboard and sticky notes: +3% quality, ideas that build hype.',
    ),
    malus: t(
      'Ça déborde toujours : les réunions du PO coûtent 50 % de plus.',
      'It always runs over: Product Owner meetings cost 50% more.',
    ),
    price: 2500,
    minPhase: 'SEED',
    effects: { quality: 0.03 },
    poPenalty: 1.5,
    usefulOdds: 0.6,
    useful: { hype: 0.15 },
    useless: { moral: -1 },
    usefulText: t(
      'Brainstorming : une idée géniale sur le tableau blanc. Personne ne l’effacera.',
      'Brainstorm: a brilliant idea on the whiteboard. Nobody will erase it.',
    ),
    uselessText: t(
      '2 heures de brainstorming sur le nom du canal Slack.',
      '2 hours of brainstorming about the Slack channel name.',
    ),
  },
  {
    id: 'aquarium',
    icon: '🐠',
    name: t('Aquarium vitré', 'Glass fishbowl'),
    bonus: t(
      'Salle tout en verre, vue par les visiteurs : +hype chaque jour.',
      'All-glass room that visitors can see: +hype every day.',
    ),
    malus: t(
      'Tout le monde regarde dedans : −2 % de productivité.',
      'Everyone stares inside: −2% productivity.',
    ),
    price: 4000,
    minPhase: 'SEED',
    effects: { hypePerDay: 0.05, teamProductivity: -0.02 },
    poPenalty: 1,
    usefulOdds: 0.5,
    useful: { hype: 0.15 },
    useless: { moral: -0.8 },
    usefulText: t(
      'Un investisseur passait devant l’aquarium pendant une réunion très inspirée.',
      'An investor walked past the fishbowl during a very inspired meeting.',
    ),
    uselessText: t(
      'Réunion dans l’aquarium : tout l’open space a vu quelqu’un pleurer.',
      'Meeting in the fishbowl: the whole office saw someone cry.',
    ),
  },
  {
    id: 'zen',
    icon: '🧘',
    name: t('Salle zen', 'Zen room'),
    bonus: t(
      'Poufs, plantes et lumière douce : +moral chaque jour, meilleure récupération.',
      'Beanbags, plants and soft light: +morale daily, better rest.',
    ),
    malus: t(
      'On y fait surtout la sieste : −1 % de productivité.',
      'Mostly used for naps: −1% productivity.',
    ),
    price: 6000,
    minPhase: 'SERIES_A',
    effects: { moral: 0.25, restBonus: 0.5, teamProductivity: -0.01 },
    poPenalty: 1,
    usefulOdds: 0.6,
    useful: { moral: 1.5 },
    useless: { debt: 0.2 },
    usefulText: t(
      'Rétro bienveillante en salle zen : l’équipe repart soudée.',
      'Kind retro in the zen room: the team leaves closer than ever.',
    ),
    uselessText: t(
      'Une heure à parler de nos émotions. Le bug, lui, est toujours là.',
      'An hour talking about our feelings. The bug is still there.',
    ),
  },
  {
    id: 'war-room',
    icon: '🚨',
    name: t('War room', 'War room'),
    bonus: t(
      'Murs d’écrans de monitoring : +stabilité de la prod chaque jour.',
      'Walls of monitoring screens: +production stability every day.',
    ),
    malus: t(
      'Ambiance cellule de crise permanente : −moral chaque jour.',
      'Permanent crisis-cell mood: −morale every day.',
    ),
    price: 9000,
    minPhase: 'SERIES_A',
    effects: { stabilityPerDay: 0.1, moral: -0.12 },
    poPenalty: 1,
    usefulOdds: 0.6,
    useful: { stability: 0.4 },
    useless: { moral: -1 },
    usefulText: t(
      'War room : une alerte traitée avant que quiconque ne la remarque.',
      'War room: an alert handled before anyone noticed.',
    ),
    uselessText: t(
      'Fausse alerte en war room. Tout le monde a eu peur pour rien.',
      'False alarm in the war room. Everyone panicked for nothing.',
    ),
  },
  {
    id: 'boardroom',
    icon: '🎩',
    name: t('Salle du conseil', 'Boardroom'),
    bonus: t(
      'Grande table en bois et fauteuils en cuir : +hype chaque jour, +2 % de qualité.',
      'Long wooden table and leather chairs: +hype daily, +2% quality.',
    ),
    malus: t(
      'Réunions solennelles : celles du PO coûtent 25 % de plus, le traiteur aussi.',
      'Solemn meetings: Product Owner ones cost 25% more, so does catering.',
    ),
    price: 20000,
    minPhase: 'UNICORN',
    effects: { hypePerDay: 0.05, quality: 0.02 },
    poPenalty: 1.25,
    usefulOdds: 0.5,
    useful: { hype: 0.2 },
    useless: { treasury: -3000 },
    usefulText: t(
      'Réunion du conseil : le board repart convaincu, la hype grimpe.',
      'Board meeting: the board leaves convinced, hype goes up.',
    ),
    uselessText: t(
      'Réunion du conseil : 3 000 € de petits-fours pour reporter la décision.',
      'Board meeting: €3,000 of canapés to postpone the decision.',
    ),
  },
];

const BY_ID = new Map<string, MeetingFormat>(MEETING_FORMATS.map((format) => [format.id, format]));

export function getMeetingFormat(id: string): MeetingFormat | undefined {
  return BY_ID.get(id);
}
