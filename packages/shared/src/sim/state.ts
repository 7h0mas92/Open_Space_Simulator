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
import { ComputerIdSchema } from './computers.js';
import { FinancingStateSchema } from './funding.js';
import { MeetingRoomSchema } from './meetings.js';
import { MonitorSetupSchema } from './monitors.js';
import { PETS, PetSchema } from './pets.js';
import { InvestorArchetypeSchema, PitchCategorySchema } from './pitch.js';
import { emptyRaisesState, RaisesStateSchema } from './raises.js';
import { FibreSubscriptionSchema } from './serverRoom.js';
import { LobbyStateSchema, SecuritySubscriptionSchema } from './lobby.js';
import { SprintObjectiveSchema } from './taskFlow.js';
import { VentureSchema } from './ventures.js';
import { FloorFinishesSchema } from './floors.js';
import { WallFinishesSchema } from './walls.js';
import { AnnexDecorSchema } from './annexDecor.js';
import { StoryMissionIdSchema } from '../story/campaign.js';
import { StoryRewardIdSchema } from '../story/rewards.js';

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
  /** Poste de travail rangé avec son écran (absent : l'écran livré avec le bureau). */
  monitor: MonitorSetupSchema.optional(),
  /** Bureau rangé : son ordinateur, qui revient avec lui. */
  computer: ComputerIdSchema.optional(),
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
  /** Objectif du sprint, réussi ou raté (absent si le sprint n'en avait pas). */
  objective: SprintObjectiveSchema.optional(),
  /** Tâches urgentes et hebdomadaires réussies et ratées pendant le sprint. */
  specialDone: z.number().int().optional(),
  specialMissed: z.number().int().optional(),
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
  /** Tâches urgentes et hebdomadaires réussies et ratées pendant le sprint. */
  specialDone: z.number().int().default(0),
  specialMissed: z.number().int().default(0),
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
  /** Réunions de crise tenues dans la salle quand la prod tombe. */
  crisisMeetings: z.number().int().default(0),
  /** Tâches urgentes et hebdomadaires terminées à temps ou ratées, objectifs de sprint. */
  urgentDone: z.number().int().default(0),
  urgentMissed: z.number().int().default(0),
  weeklyDone: z.number().int().default(0),
  weeklyMissed: z.number().int().default(0),
  objectivesDone: z.number().int().default(0),
  objectivesFailed: z.number().int().default(0),
  /** Chats adoptés depuis le début de la partie (sert à nommer le suivant). */
  petsAdopted: z.number().int().default(0),
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
  'CRISIS_MEETING',
  'PET_ADOPTED',
  'PET_REHOMED',
  /** Abonnement fibre souscrit, changé ou résilié. */
  'FIBRE_SUBSCRIBED',
  'FIBRE_CANCELLED',
  /** L'opérateur coupe la ligne : la trésorerie ne couvrait plus la semaine. */
  'FIBRE_CUT',
  /** Hall d'entrée aménagé, secrétaire embauchée ou partie. */
  'LOBBY_BUILT',
  'RECEPTIONIST_HIRED',
  'RECEPTIONIST_LEFT',
  /** Abonnement de sécurité souscrit, changé, résilié ou suspendu faute de paiement. */
  'SECURITY_SUBSCRIBED',
  'SECURITY_CANCELLED',
  'SECURITY_CUT',
  'URGENT_TASK',
  'URGENT_DONE',
  'URGENT_MISSED',
  'WEEKLY_TASKS',
  'WEEKLY_MISSED',
  'OBJECTIVE_SET',
  'OBJECTIVE_DONE',
  'OBJECTIVE_FAILED',
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
  /** Mode Histoire : la mission est-elle réussie ? (absent hors mission) */
  mission: z
    .object({
      id: StoryMissionIdSchema,
      success: z.boolean(),
      /** Pourquoi elle est perdue : contrainte enfreinte, faillite, temps écoulé, startup vendue. */
      failure: z.enum(['CONSTRAINT', 'BANKRUPTCY', 'TIME', 'SOLD']).nullable(),
    })
    .optional(),
});
export type GameResult = z.infer<typeof GameResultSchema>;

/** Mission en cours du mode Histoire (voir `story/campaign.ts`). */
export const StoryStateSchema = z.object({
  missionId: StoryMissionIdSchema,
  /** Statistiques au lancement : les objectifs comptent depuis le début de la mission. */
  startSprint: z.number().int().min(1),
});
export type StoryState = z.infer<typeof StoryStateSchema>;

export const STATE_VERSION = 1;

/** Nombre de titres de tâches récents gardés en mémoire pour éviter les répétitions. */
export const RECENT_TASK_TITLES_MAX = 60;

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
  /** Objectif du sprint en cours (certains sprints seulement). */
  objective: SprintObjectiveSchema.nullable().default(null),
  /** Financements hors tour de table (prêt en cours, cooldowns). */
  financing: FinancingStateSchema.default({ lastSprint: {}, loan: null }),
  /** Inventaire : objets rangés, du plus ancien au plus récent (absent des vieilles sauvegardes). */
  inventory: z.array(StoredItemSchema).max(INVENTORY_MAX).default([]),
  /** Peintures et papiers peints des murs, par zone (absents des vieilles sauvegardes). */
  walls: WallFinishesSchema.default({}),
  /** Sols posés, par pièce (absents des vieilles sauvegardes). */
  floors: FloorFinishesSchema.default({}),
  /** Décor des annexes déplacé par le joueur, par clé (absent des vieilles sauvegardes). */
  annexDecor: AnnexDecorSchema.default({}),
  /** Chats du bureau (absents des sauvegardes d'avant leur ajout). */
  pets: z.array(PetSchema).max(PETS.max).default([]),
  /** Demandes d'augmentation (absentes des sauvegardes d'avant leur ajout). */
  raises: RaisesStateSchema.default(emptyRaisesState),
  /** Abonnement fibre en cours (null : pas d'abonnement, ou sauvegarde d'avant son ajout). */
  fibre: FibreSubscriptionSchema.nullable().default(null),
  /** Hall d'entrée au rez-de-chaussée (null : pas de hall, ou sauvegarde d'avant son ajout). */
  lobby: LobbyStateSchema.nullable().default(null),
  /** Abonnement de sécurité en cours (null : aucun, ou sauvegarde d'avant son ajout). */
  security: SecuritySubscriptionSchema.nullable().default(null),
  /**
   * Titres des dernières tâches du backlog (en français), pour ne pas reproposer tout de suite
   * les mêmes idées. Absent des vieilles sauvegardes.
   */
  recentTaskTitles: z.array(z.string()).max(RECENT_TASK_TITLES_MAX).default([]),
  /** Mode Histoire : la mission jouée (null dans les autres modes et les vieilles sauvegardes). */
  story: StoryStateSchema.nullable().default(null),
  /**
   * Récompenses du mode Histoire débloquées au lancement de la partie (vide en Daily, en mission
   * et dans les vieilles sauvegardes). Comme la graine, elles font partie du point de départ.
   */
  unlocks: z.array(StoryRewardIdSchema).default([]),
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
