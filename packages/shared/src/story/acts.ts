import { z } from 'zod';
import type { Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';
import {
  StoryMissionIdSchema,
  type MissionGoal,
  type StoryMissionId,
  type StoryStat,
} from './campaign.js';
import { RivalStateSchema } from '../sim/rivals.js';
import { ResearchStateSchema } from '../sim/research.js';

/**
 * L'histoire « Ctrl+Alt+Fonder » : une seule longue partie du mode Histoire, en 5 actes, du
 * garage à la cloche de la Bourse (voir `docs/proposition-mode-histoire.md`).
 *
 * Chaque acte a un objectif principal à remplir avant une date limite (un sprint de la partie)
 * et des objectifs secondaires : les 10 missions de la campagne courte, avec les mêmes objectifs,
 * les mêmes contraintes et les mêmes récompenses. Objectif principal rempli : l'acte suivant
 * commence aussitôt. Date limite dépassée : l'histoire s'arrête, et le joueur reprend l'acte
 * depuis son point de sauvegarde. Le dernier acte se termine par une sortie : entrée en Bourse
 * ou rachat.
 *
 * Tout est déclaratif et sans tirage : la simulation (`client/src/simulation/story.ts`) lit l'état
 * de la partie, le serveur retrouve la même progression en rejouant les commandes.
 */

/** Valeur de `mission` au lancement d'une partie Histoire : la longue partie en actes. */
export const STORY_CAMPAIGN = 'campaign' as const;

/** Point de départ d'une partie Histoire : la longue partie, ou une mission courte. */
export const StoryStartSchema = z.union([StoryMissionIdSchema, z.literal(STORY_CAMPAIGN)]);
export type StoryStart = z.infer<typeof StoryStartSchema>;

/** Durée de l'histoire, en sprints (environ 2 ans et 4 mois de jeu, 5 h à x1). */
export const STORY_TOTAL_SPRINTS = 60;

export const STORY_ACT_IDS = ['prologue', 'race', 'price-war', 'giant', 'bell'] as const;
export const StoryActIdSchema = z.enum(STORY_ACT_IDS);
export type StoryActId = z.infer<typeof StoryActIdSchema>;

/** Statistiques qu'un objectif peut compter : elles repartent de zéro à chaque acte. */
export const STORY_STATS = [
  'featuresShipped',
  'prodOutages',
  'coffeeShortageDays',
  'meetingsUseful',
  'urgentDone',
  'urgentMissed',
  'resignations',
  'hired',
] as const satisfies readonly StoryStat[];

export interface StoryAct {
  readonly id: StoryActId;
  /** 0 pour le prologue, puis I à IV. */
  readonly number: number;
  readonly icon: string;
  readonly title: LocalizedText;
  /** Ce qui se passe, raconté au début de l'acte. */
  readonly intro: LocalizedText;
  /** Phase où l'acte se joue (pour l'écran Histoire). */
  readonly phase: Phase;
  /** Objectif principal (tous en même temps). Vide : l'acte se termine par une sortie. */
  readonly goals: readonly MissionGoal[];
  /** Date limite : l'objectif principal doit être rempli à la démo de ce sprint. */
  readonly deadline: number;
  /** Objectifs secondaires : missions de la campagne courte, avec leurs récompenses. */
  readonly side: readonly StoryMissionId[];
}

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

export const STORY_TITLE = t('Ctrl+Alt+Fonder', 'Ctrl+Alt+Found');

export const STORY_SYNOPSIS = t(
  'Ton ancien chef, Bastien Lemaître, a présenté ton idée comme la sienne, levé 5 M€ et fondé Synergix dans la tour d’en face. Il te reste un garage, un ami dev et 2 M€ de business angels qui croient en toi. Du garage à la Bourse, montre-lui qui avait l’idée.',
  'Your former boss, Bastien Lemaître, pitched your idea as his own, raised €5M and founded Synergix in the tower across the street. You have a garage, a dev friend and €2M from business angels who believe in you. From the garage to the stock exchange, show him whose idea it was.',
);

export const STORY_ACTS: readonly StoryAct[] = [
  {
    id: 'prologue',
    number: 0,
    icon: '🏚️',
    title: t('Le garage', 'The garage'),
    intro: t(
      'Ton idée volée, un garage et un premier commit. En face, Synergix inaugure ses bureaux. Lève la Seed pour sortir du garage.',
      'Your stolen idea, a garage and a first commit. Across the street, Synergix opens its offices. Raise the Seed to get out of the garage.',
    ),
    phase: 'GARAGE',
    goals: [{ kind: 'phase', atLeast: 'SEED' }],
    deadline: 8,
    side: ['first-commit', 'coffee-first', 'leave-garage'],
  },
  {
    id: 'race',
    number: 1,
    icon: '🏁',
    title: t('La course', 'The race'),
    intro: t(
      'Les premiers utilisateurs arrivent, et Synergix aussi. Dépasse-le en utilisateurs et lève ta Série A.',
      'The first users are coming in, and so is Synergix. Overtake him in users and raise your Series A.',
    ),
    phase: 'SEED',
    goals: [
      { kind: 'phase', atLeast: 'SERIES_A' },
      { kind: 'rivalUsers', rival: 'synergix' },
    ],
    deadline: 18,
    side: ['useful-meeting', 'clean-series-a'],
  },
  {
    id: 'price-war',
    number: 2,
    icon: '⚔️',
    title: t('La guerre des prix', 'The price war'),
    intro: t(
      'Pivotly change de produit tous les deux sprints et casse les prix. Tiens la prod, tiens l’équipe et deviens licorne.',
      'Pivotly changes products every other sprint and slashes prices. Keep prod up, keep the team together and become a unicorn.',
    ),
    phase: 'SERIES_A',
    goals: [{ kind: 'phase', atLeast: 'UNICORN' }],
    deadline: 48,
    side: ['server-room', 'office-cats', 'debt-free-unicorn'],
  },
  {
    id: 'giant',
    number: 3,
    icon: '🏢',
    title: t('Le géant', 'The giant'),
    intro: t(
      'Gigacorp rachète Synergix et sort un clone de ton produit. Vaux 1,5 milliard et garde 30 % du marché.',
      'Gigacorp buys Synergix and releases a clone of your product. Be worth 1.5 billion and keep 30% of the market.',
    ),
    phase: 'UNICORN',
    goals: [
      { kind: 'valuation', min: 1_500_000_000 },
      { kind: 'marketShare', min: 0.3 },
    ],
    deadline: 56,
    side: ['firefighters'],
  },
  {
    id: 'bell',
    number: 4,
    icon: '🔔',
    title: t('La cloche', 'The bell'),
    intro: t(
      'Gigacorp t’offre de te racheter. Tu signes, ou tu vises l’entrée en Bourse ? À toi d’écrire la fin.',
      'Gigacorp offers to buy you out. Do you sign, or go for the IPO? Write the ending yourself.',
    ),
    phase: 'UNICORN',
    goals: [],
    deadline: STORY_TOTAL_SPRINTS,
    side: ['opening-bell'],
  },
];

export function getStoryAct(index: number): StoryAct {
  const act = STORY_ACTS[Math.max(0, Math.min(STORY_ACTS.length - 1, index))];
  if (!act) throw new Error(`Acte inconnu : ${index}`);
  return act;
}

/** Fins écrites de l'histoire : entrée en Bourse ou rachat par Gigacorp. */
export const STORY_ENDINGS = ['IPO', 'ACQUISITION'] as const;
export const StoryEndingSchema = z.enum(STORY_ENDINGS);
export type StoryEnding = z.infer<typeof StoryEndingSchema>;

/** Avancement de la longue partie, gardé dans `state.story.campaign`. */
export const CampaignStateSchema = z.object({
  /** Acte en cours (0 = prologue). */
  act: z
    .number()
    .int()
    .min(0)
    .max(STORY_ACTS.length - 1),
  /** Objectifs secondaires remplis (missions), dans l'ordre où ils l'ont été. */
  done: z.array(StoryMissionIdSchema),
  /** Objectifs secondaires ratés : contrainte enfreinte, ou acte terminé sans eux. */
  missed: z.array(StoryMissionIdSchema),
  /** Statistiques au début de l'acte : les objectifs comptent depuis ce moment. */
  statsAtAct: z.record(z.enum(STORY_STATS), z.number()),
  /** Startups rivales (`sim/rivals.ts`), simulées à chaque démo. Absent des vieilles parties. */
  rivals: z.array(RivalStateSchema).default([]),
  /** Utilisateurs du joueur à chaque démo, pour comparer les courbes. */
  usersHistory: z.array(z.number()).default([]),
  /**
   * Arbre R&D des objets (`sim/research.ts`) : points d'innovation et niveaux pris. Absent des
   * parties commencées avant l'arbre : leur catalogue reste complet.
   */
  research: ResearchStateSchema.optional(),
  /**
   * Saison libre : l'histoire s'est finie par l'entrée en Bourse et la partie continue sans
   * limite, la concurrence montant à partir de `fromSprint`. Absent pendant l'histoire.
   */
  freeSeason: z
    .object({ fromSprint: z.number().int().min(1), valuation: z.number().nonnegative() })
    .optional(),
});
export type CampaignState = z.infer<typeof CampaignStateSchema>;

/** Une nouvelle startup rivale arrive tous les combien de sprints en Saison libre. */
export const FREE_SEASON_NEWCOMER_SPRINTS = 10;

/** Sprint où commence la Saison libre (null pendant l'histoire et hors de l'histoire). */
export function freeSeasonStart(
  story: { campaign?: CampaignState | undefined } | null | undefined,
): number | null {
  return story?.campaign?.freeSeason?.fromSprint ?? null;
}

/** Bilan de l'histoire à la fin de la partie (`result.campaign`). */
export const CampaignResultSchema = z.object({
  act: StoryActIdSchema,
  success: z.boolean(),
  /** Pourquoi elle s'arrête : date limite dépassée, faillite, startup vendue trop tôt. */
  failure: z.enum(['TIME', 'BANKRUPTCY', 'SOLD']).nullable(),
  /** Fin écrite atteinte (succès seulement). */
  ending: StoryEndingSchema.nullable(),
  /** Sprints tenus en Saison libre après l'entrée en Bourse. */
  freeSeasonSprints: z.number().int().nonnegative().optional(),
});
export type CampaignResult = z.infer<typeof CampaignResultSchema>;

/** Coup de pouce d'un objectif secondaire rempli dans la longue partie (sans tirage). */
export interface StorySideBonus {
  /** Qui l'annonce dans la notification. */
  readonly from: 'ines' | 'josette' | 'hugo';
  readonly treasury?: number;
  readonly hype?: number;
  /** Utilisateurs en plus, en % des utilisateurs actuels. */
  readonly users?: number;
  /** Utilisateurs des rivaux, en %. */
  readonly rivals?: number;
  readonly text: LocalizedText;
}

/**
 * Bonus de chaque objectif secondaire de l'histoire en actes, en plus de la récompense de la
 * mission : ils aident à tenir les dates limites suivantes.
 */
export const STORY_SIDE_BONUS: Readonly<Record<StoryMissionId, StorySideBonus>> = {
  'first-commit': {
    from: 'josette',
    treasury: 50_000,
    text: t(
      'Mamie Josette a vendu ses confitures au marché : +50 000 €.',
      'Granny Josette sold her jam at the market: +€50,000.',
    ),
  },
  'coffee-first': {
    from: 'hugo',
    hype: 4,
    text: t(
      'Hugo poste une photo du garage et de la cafetière : +4 de hype.',
      'Hugo posts a photo of the garage and the coffee maker: +4 hype.',
    ),
  },
  'leave-garage': {
    from: 'josette',
    treasury: 150_000,
    text: t(
      'Les amies du club de bridge de Mamie Josette investissent : +150 000 €.',
      'Granny Josette’s bridge club friends invest: +€150,000.',
    ),
  },
  'useful-meeting': {
    from: 'ines',
    hype: 5,
    users: 3,
    text: t(
      'Inès raconte « la startup où les réunions servent à quelque chose » : +5 de hype, +3 % d’utilisateurs.',
      'Inès writes about “the startup where meetings are useful”: +5 hype, +3% users.',
    ),
  },
  'clean-series-a': {
    from: 'ines',
    users: 5,
    rivals: -3,
    text: t(
      'TechMatin compare ton code à celui de Synergix : +5 % d’utilisateurs, -3 % pour les rivaux.',
      'TechMorning compares your code to Synergix’s: +5% users, -3% for the rivals.',
    ),
  },
  'server-room': {
    from: 'hugo',
    users: 5,
    text: t(
      'Plus une seule panne pendant les soldes : +5 % d’utilisateurs.',
      'Not a single outage during the sales: +5% users.',
    ),
  },
  'office-cats': {
    from: 'ines',
    hype: 6,
    text: t(
      'Les chats du bureau font la une de TechMatin : +6 de hype.',
      'The office cats make the TechMorning front page: +6 hype.',
    ),
  },
  'debt-free-unicorn': {
    from: 'ines',
    hype: 6,
    users: 5,
    rivals: -5,
    text: t(
      'Inès : « La licorne sans dette, Pivotly peut aller se rhabiller » : +6 de hype, +5 % d’utilisateurs, -5 % pour les rivaux.',
      'Inès: “The debt-free unicorn leaves Pivotly in the dust”: +6 hype, +5% users, -5% for the rivals.',
    ),
  },
  firefighters: {
    from: 'ines',
    users: 8,
    rivals: -5,
    text: t(
      'Pendant la panne de Gigacorp Teams+, tu tiens bon : +8 % d’utilisateurs, -5 % pour les rivaux.',
      'During the Gigacorp Teams+ outage, you hold firm: +8% users, -5% for the rivals.',
    ),
  },
  'opening-bell': {
    from: 'josette',
    hype: 8,
    text: t(
      'Mamie Josette parle de toi à tout le quartier : +8 de hype.',
      'Granny Josette tells the whole neighborhood about you: +8 hype.',
    ),
  },
};
