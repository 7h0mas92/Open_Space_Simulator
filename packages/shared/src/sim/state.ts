import { z } from 'zod';
import { GameModeSchema, OutcomeSchema, PhaseSchema } from '../game.js';
import { LocalizedTextSchema } from '../i18n.js';
import {
  ComponentStoresSchema,
  EntityIdSchema,
  FurnitureColorSchema,
  IdentitySchema,
  StatsSchema,
} from './components.js';
import { CommandLogSchema } from './commands.js';
import { FinancingStateSchema } from './funding.js';
import { MeetingRoomSchema } from './meetings.js';
import { InvestorArchetypeSchema, PitchCategorySchema } from './pitch.js';
import { emptyRaisesState, RaisesStateSchema } from './raises.js';
import { VentureSchema } from './ventures.js';

/**
 * État complet d'une partie. Il est 100 % sérialisable en JSON : une sauvegarde est
 * un simple `JSON.stringify(state)`, et le rendu ne lit que des copies (snapshots).
 */

/** Étape du sprint en cours. */
export const SPRINT_STAGES = ['PLANNING', 'EXECUTION', 'DEMO', 'PITCH', 'ENDED'] as const;
export const SprintStageSchema = z.enum(SPRINT_STAGES);
export type SprintStage = z.infer<typeof SprintStageSchema>;

export const GaugesSchema = z.object({
  /** Euros en banque. Sous zéro : faillite. */
  treasury: z.number(),
  coffee: z.number().min(0).max(100),
  debt: z.number().min(0).max(100),
  stability: z.number().min(0).max(100),
  hype: z.number().min(0).max(100),
  users: z.number().nonnegative(),
});
export type Gauges = z.infer<typeof GaugesSchema>;
export type GaugeName = keyof Gauges;

export const CandidateSchema = z.object({
  id: z.string(),
  identity: IdentitySchema,
  stats: StatsSchema,
  /** Salaire mensuel demandé. */
  askingSalary: z.number().positive(),
  status: z.enum(['OPEN', 'HIRED', 'REFUSED']),
});
export type Candidate = z.infer<typeof CandidateSchema>;

export const PendingEventSchema = z.object({
  cardId: z.string(),
  /** Niveau d'aggravation (0 au premier tirage, +1 à chaque « On en reparle »). */
  level: z.number().int().nonnegative(),
  drawnAtTick: z.number().int(),
});
export type PendingEvent = z.infer<typeof PendingEventSchema>;

export const QueuedEventSchema = z.object({
  cardId: z.string(),
  level: z.number().int().nonnegative(),
  availableAtSprint: z.number().int(),
});
export type QueuedEvent = z.infer<typeof QueuedEventSchema>;

export const EventsStateSchema = z.object({
  pending: PendingEventSchema.nullable(),
  /** Dernier sprint où chaque carte est sortie (pour le cooldown et `requiresSeen`). */
  lastSeenSprint: z.record(z.string(), z.number().int()),
  queue: z.array(QueuedEventSchema),
  drawnThisSprint: z.number().int().nonnegative(),
  /** Historique des choix, utile aux statistiques (EventStat) et au back-office. */
  choices: z.array(
    z.object({ cardId: z.string(), choiceIndex: z.number().int(), sprint: z.number().int() }),
  ),
});
export type EventsState = z.infer<typeof EventsStateSchema>;

export const PitchResultSchema = z.object({
  success: z.boolean(),
  /** Montant levé (0 en cas d'échec). */
  amount: z.number().nonnegative(),
  preMoney: z.number().nonnegative(),
  /** Part du capital cédée (0 à 1). */
  dilution: z.number().min(0).max(1),
});
export type PitchResult = z.infer<typeof PitchResultSchema>;

export const PitchStateSchema = z.object({
  investor: InvestorArchetypeSchema,
  round: z.number().int().min(0),
  /** Intérêt de l'investisseur : plus il est haut, plus la levée a de chances de réussir. */
  interest: z.number(),
  options: z.array(z.string()),
  chosen: z.array(z.string()),
  result: PitchResultSchema.nullable(),
  /** Tour de table (0 = Seed, 1 = Série A…), voir `FUNDING_TIERS`. */
  tier: z.number().int().min(0).default(0),
  /** Nombre de manches de ce pitch. */
  manches: z.number().int().min(1).default(3),
  /** Question posée à cette manche : la catégorie de réponse attendue. */
  question: z
    .object({ category: PitchCategorySchema, index: z.number().int().min(0) })
    .nullable()
    .default(null),
  /** Effet de chaque réponse sur l'intérêt, pour les réactions de l'investisseur. */
  log: z
    .array(
      z.object({
        argumentId: z.string(),
        delta: z.number(),
        onTopic: z.boolean(),
        bluffCaught: z.boolean(),
      }),
    )
    .default([]),
  /** L'investisseur a quitté la salle avant la fin. */
  walkedOut: z.boolean().default(false),
});
export type PitchState = z.infer<typeof PitchStateSchema>;

export const AcquisitionOfferSchema = z.object({
  buyer: LocalizedTextSchema,
  amount: z.number().positive(),
  expiresAtSprint: z.number().int(),
});
export type AcquisitionOffer = z.infer<typeof AcquisitionOfferSchema>;

/**
 * Objet rangé dans l'inventaire (la réserve) : retiré de l'open space sans être revendu. Il ne
 * donne plus aucun effet mais compte toujours dans le maximum d'exemplaires de la boutique.
 */
export const StoredItemSchema = z.object({
  itemId: z.string(),
  purchasePrice: z.number().nonnegative(),
  color: FurnitureColorSchema.optional(),
});
export type StoredItem = z.infer<typeof StoredItemSchema>;

/** Taille maximale de l'inventaire (bien au-delà de ce qu'un bureau peut contenir). */
export const INVENTORY_MAX = 200;

export const HistoryPointSchema = z.object({
  day: z.number().int(),
  sprint: z.number().int(),
  treasury: z.number(),
  coffee: z.number(),
  debt: z.number(),
  stability: z.number(),
  hype: z.number(),
  users: z.number(),
  moral: z.number(),
  valuation: z.number(),
});
export type HistoryPoint = z.infer<typeof HistoryPointSchema>;

export const SprintReportSchema = z.object({
  sprint: z.number().int(),
  /** Sprint perdu (effet `sprintsLost`) : aucune production. */
  lost: z.boolean(),
  usersGained: z.number(),
  usersLost: z.number(),
  revenue: z.number(),
  expenses: z.number(),
  hypeDelta: z.number(),
  featuresShipped: z.number().int(),
  hallucinations: z.number().int(),
  incidents: z.number().int(),
  valuation: z.number(),
  /** Retours d'utilisateurs (drôles) affichés à la démo. */
  feedback: z.array(LocalizedTextSchema),
});
export type SprintReport = z.infer<typeof SprintReportSchema>;

/** Compteurs accumulés pendant le sprint en cours, remis à zéro à chaque démo. */
export const SprintTrackerSchema = z.object({
  usersAtStart: z.number(),
  usersLost: z.number(),
  revenue: z.number(),
  expenses: z.number(),
  hypeAtStart: z.number(),
  incidents: z.number().int(),
});
export type SprintTracker = z.infer<typeof SprintTrackerSchema>;

/** Statistiques de partie : alimentent les succès, l'écran de fin et le profil. */
export const GameStatsSchema = z.object({
  prodOutages: z.number().int(),
  fridayOutages: z.number().int(),
  /** Vendredis consécutifs avec une panne de prod (succès « Vendredi Noir »). */
  fridayOutageStreak: z.number().int(),
  maxFridayOutageStreak: z.number().int(),
  resignations: z.number().int(),
  /** Démissions d'un dev épuisé (énergie basse) : les « burn-out » de l'écran de fin. */
  burnouts: z.number().int(),
  fired: z.number().int(),
  hired: z.number().int(),
  meetings: z.number().int(),
  featuresShipped: z.number().int(),
  refactosDone: z.number().int(),
  hallucinations: z.number().int(),
  cardsResolved: z.number().int(),
  maxTeamSize: z.number().int(),
  coffeeShortageDays: z.number().int(),
  maxValuation: z.number(),
  maxUsers: z.number(),
  /** Journées de télétravail cumulées (hors Dev Fantôme). */
  remoteDays: z.number().int().default(0),
  /** Filiales créées, et dividendes et reventes encaissés. */
  venturesFounded: z.number().int().default(0),
  ventureCashIn: z.number().default(0),
  /** Réunions d'équipe du matin jugées utiles, puis inutiles (salle de réunion aménagée). */
  meetingsUseful: z.number().int().default(0),
  meetingsUseless: z.number().int().default(0),
});
export type GameStats = z.infer<typeof GameStatsSchema>;

export const NOTIFICATION_KINDS = [
  'SPRINT_STARTED',
  'SPRINT_ENDED',
  'CARD_DRAWN',
  'CARD_RESOLVED',
  'FEATURE_DONE',
  'TASK_DONE',
  'HALLUCINATION',
  'DESIGN_BLOCKED',
  'PROD_DOWN',
  'FRIDAY_17H',
  'COFFEE_EMPTY',
  'DEV_HIRED',
  'OFFER_REFUSED',
  'DEV_FIRED',
  'DEV_RESIGNED',
  /** Un dev demande une augmentation (fenêtre de décision pendant la planification). */
  'RAISE_REQUESTED',
  'RAISE_GRANTED',
  'RAISE_REFUSED',
  /** Démission annoncée : le dev part quelques planifications plus tard. */
  'DEV_NOTICE',
  'DEV_LEVEL_UP',
  'DEV_BIRTHDAY',
  'DEV_REMOTE',
  'RUST_CONVERT',
  'FUNDS_RAISED',
  'PITCH_FAILED',
  'PHASE_UP',
  'SEASON_STARTED',
  'ACQUISITION_OFFER',
  'VENTURE_FOUNDED',
  'VENTURE_DIED',
  'VENTURE_SOLD',
  'VENTURE_DIVIDENDS',
  'MEETING_ROOM_FITTED',
  'MEETING_USEFUL',
  'MEETING_USELESS',
  'SPRINT_LOST',
  'GAME_OVER',
  'ACHIEVEMENT_UNLOCKED',
] as const;
export const NotificationKindSchema = z.enum(NOTIFICATION_KINDS);
export type NotificationKind = z.infer<typeof NotificationKindSchema>;

/**
 * Événement émis par la simulation (« quelque chose vient de se passer »). Le rendu
 * s'en sert pour les effets (fumée, confettis), le Slack pour ses messages.
 */
export const NotificationSchema = z.object({
  tick: z.number().int(),
  kind: NotificationKindSchema,
  text: LocalizedTextSchema,
  entityId: EntityIdSchema.nullable(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const GameResultSchema = z.object({
  outcome: OutcomeSchema,
  /** Phase atteinte avant la fin (utile aux statistiques « faillite par phase »). */
  phaseReached: PhaseSchema,
  sprint: z.number().int(),
  valuation: z.number(),
  /** Part du capital détenue par le fondateur à la fin. */
  ownership: z.number(),
  /** Phrase partageable : « Ma startup a été rachetée 400 M€ et 7 devs ont fait un burn-out ». */
  headline: LocalizedTextSchema,
});
export type GameResult = z.infer<typeof GameResultSchema>;

export const STATE_VERSION = 1;

export const GameStateSchema = z.object({
  version: z.literal(STATE_VERSION),
  seed: z.string(),
  mode: GameModeSchema,
  /** État interne du générateur aléatoire (4 entiers 32 bits). */
  rng: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  /** Ticks simulés depuis le début de la partie (1 tick = 30 min simulées). */
  tick: z.number().int().nonnegative(),
  /** Sprint en cours, à partir de 1. */
  sprint: z.number().int().min(1),
  totalSprints: z.number().int().min(1),
  /** Ticks écoulés dans le sprint en cours. */
  sprintTick: z.number().int().nonnegative(),
  stage: SprintStageSchema,
  phase: PhaseSchema,
  nextEntityId: z.number().int().positive(),
  components: ComponentStoresSchema,
  gauges: GaugesSchema,
  valuation: z.number().nonnegative(),
  /** Part du capital du fondateur (1 = 100 %). */
  ownership: z.number().min(0).max(1),
  totalRaised: z.number().nonnegative(),
  fundingRounds: z.number().int().nonnegative(),
  lastPitchSprint: z.number().int().nullable(),
  pitch: PitchStateSchema.nullable(),
  candidates: z.array(CandidateSchema),
  events: EventsStateSchema,
  acquisitionOffer: AcquisitionOfferSchema.nullable(),
  /** Filiales créées par la startup (actives, coulées ou revendues). */
  ventures: z.array(VentureSchema).default([]),
  lastVentureSprint: z.number().int().nullable().default(null),
  /** Aménagement de la salle de réunion (null : salle vide, ou pas encore de salle). */
  meetingRoom: MeetingRoomSchema.nullable().default(null),
  /** Financements hors tour de table (prêt en cours, cooldowns). */
  financing: FinancingStateSchema.default({ lastSprint: {}, loan: null }),
  /** Inventaire : objets rangés, du plus ancien au plus récent (absent des vieilles sauvegardes). */
  inventory: z.array(StoredItemSchema).max(INVENTORY_MAX).default([]),
  /** Demandes d'augmentation (absentes des sauvegardes d'avant leur ajout). */
  raises: RaisesStateSchema.default(emptyRaisesState),
  lostSprintsPending: z.number().int().nonnegative(),
  tracker: SprintTrackerSchema,
  history: z.object({
    daily: z.array(HistoryPointSchema),
    sprints: z.array(SprintReportSchema),
  }),
  stats: GameStatsSchema,
  /** Succès débloqués pendant la partie (envoyés au serveur par l'étape Méta). */
  achievements: z.array(z.string()),
  /** Dernières notifications, de la plus ancienne à la plus récente. */
  notifications: z.array(NotificationSchema),
  result: GameResultSchema.nullable(),
});
export type GameState = z.infer<typeof GameStateSchema>;

/**
 * Une sauvegarde : l'état courant (reprise instantanée) et le journal des commandes
 * (rejeu complet depuis la graine : replays et vérification anti-triche).
 */
export const SaveDataSchema = z.object({
  state: GameStateSchema,
  commands: CommandLogSchema,
});
export type SaveData = z.infer<typeof SaveDataSchema>;
