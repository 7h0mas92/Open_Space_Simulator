/**
 * Modèle de vue : ce que le rendu (`render/`) et l'interface (`ui/`) lisent.
 *
 * C'est la frontière entre la simulation et l'affichage. La simulation (`simulation/`, dans le
 * Web Worker) produit un `GameState` ; `view/adapter.ts` le convertit en `GameView`, un objet
 * plus simple à afficher (noms des colonnes, activités, heure de la journée…).
 *
 * Règle : ces objets sont des instantanés en lecture seule. Le rendu ne les modifie jamais ;
 * l'interface envoie des `GameCommand` pour demander un changement.
 */
import type {
  AcquisitionOffer,
  DevTrait,
  GameMode,
  GameResult,
  LocalizedText,
  NotificationKind,
  Phase,
  PitchResult,
  SprintReport,
  Speed,
} from '@oss/shared';

/** Les 8 profils de développeurs du cahier des charges. */
export const DEV_ROLES = [
  'SENIOR_BEARD',
  'TEN_X',
  'INTERN',
  'RUSTACEAN',
  'DESIGNER',
  'PRODUCT_OWNER',
  'AI_AGENT',
  'GHOST',
] as const;
export type DevRole = (typeof DEV_ROLES)[number];

/** Ce que fait un personnage ; pilote son comportement et son animation dans la scène. */
export const DEV_ACTIVITIES = [
  'WORKING',
  'COFFEE',
  'MEETING',
  'CHATTING',
  'ARGUING',
  'SLEEPING',
  'YELLING',
  'BABYFOOT',
  'LEAVING',
  'REMOTE',
] as const;
export type DevActivity = (typeof DEV_ACTIVITIES)[number];

export const GAUGES = ['treasury', 'coffee', 'debt', 'stability', 'hype', 'users'] as const;
export type GaugeName = (typeof GAUGES)[number];
export type Gauges = Readonly<Record<GaugeName, number>>;

export interface DevStats {
  readonly speed: number;
  readonly quality: number;
  readonly endurance: number;
  readonly ego: number;
}

export interface DevView {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly role: DevRole;
  /** Trait de personnalité (traduit par i18n : `traits.<trait>`). */
  readonly trait: DevTrait;
  /** Mini-bio drôle, dans les deux langues. */
  readonly bio: LocalizedText;
  readonly stats: DevStats;
  /** Salaire mensuel en euros. */
  readonly salary: number;
  readonly level: number;
  /** Moral de 0 à 100. */
  readonly morale: number;
  /** Énergie de 0 à 100. */
  readonly energy: number;
  readonly activity: DevActivity;
  /** Affinité avec chaque collègue, de -100 (conflit) à +100. */
  readonly relations: Readonly<Record<string, number>>;
  /** Faits marquants, du plus récent au plus ancien. */
  readonly history: readonly { readonly sprint: number; readonly text: LocalizedText }[];
  /** Index du personnage Kenney (character-a … character-r). */
  readonly look: number;
}

export const TASK_TYPES = ['FEATURE', 'REFACTOR', 'BUGFIX', 'INFRA'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const KANBAN_COLUMNS = ['BACKLOG', 'TODO', 'DOING', 'DONE'] as const;
export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

export interface TaskView {
  readonly id: string;
  readonly title: LocalizedText;
  readonly type: TaskType;
  /** Taille en points (1, 2, 3, 5, 8). */
  readonly size: number;
  readonly column: KanbanColumn;
  readonly assigneeId: string | null;
  /** Avancement de 0 à 1. */
  readonly progress: number;
  /** Sens de l'effet attendu sur les jauges (+1 ou -1), affiché sur la carte. */
  readonly impact: Partial<Gauges>;
  /** Feature hallucinée par l'IA Agent : livrée, mais elle n'existe pas. */
  readonly hallucinated: boolean;
}

export interface CandidateView {
  readonly id: string;
  readonly dev: DevView;
  /** Salaire demandé. */
  readonly askingSalary: number;
}

/** Rotation d'un objet posé, en quarts de tour. */
export type Rotation = 0 | 1 | 2 | 3;

export interface PlacedItemView {
  readonly id: string;
  /** Identifiant du catalogue (voir `view/catalog.ts`). */
  readonly kind: string;
  readonly x: number;
  readonly z: number;
  readonly rotation: Rotation;
  /** Somme remboursée à la revente. */
  readonly resale: number;
}

export interface GameTime {
  /** Sprint courant, de 1 à 39. */
  readonly sprint: number;
  readonly totalSprints: number;
  /** Jour dans le sprint, de 0 à 13 (lundi = 0, samedi = 5, lundi suivant = 7). */
  readonly day: number;
  /** Minute de la journée, de 0 à 1439. */
  readonly minute: number;
  readonly speed: Speed;
}

export const SPRINT_STEPS = ['PLANNING', 'EXECUTION', 'DEMO', 'PITCH', 'ENDED'] as const;
export type SprintStep = (typeof SPRINT_STEPS)[number];

/** Carte d'événement affichée : la partie attend le choix du joueur. */
export interface EventView {
  readonly cardId: string;
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  /** Niveau d'aggravation (0 au premier tirage, +1 à chaque « On en reparle »). */
  readonly level: number;
  readonly choices: readonly {
    readonly label: LocalizedText;
    /** Effets chiffrés sur les jauges, pour aider le joueur à choisir. */
    readonly effects: Partial<Record<GaugeName | 'moral', number>>;
  }[];
}

export interface PitchView {
  readonly investor: { readonly name: LocalizedText; readonly intro: LocalizedText };
  readonly round: number;
  readonly rounds: number;
  readonly options: readonly { readonly id: string; readonly label: LocalizedText }[];
  readonly chosen: readonly LocalizedText[];
  readonly result: PitchResult | null;
}

/** Ce qui vient de se passer dans la partie (toasts, effets visuels). */
export interface GameNotification {
  readonly tick: number;
  readonly kind: NotificationKind;
  readonly text: LocalizedText;
  readonly entityId: string | null;
}

export interface GameView {
  readonly seed: string;
  readonly mode: GameMode;
  /** Numéro du tick de simulation ayant produit cet instantané. */
  readonly tick: number;
  readonly time: GameTime;
  readonly phase: Phase;
  readonly step: SprintStep;
  readonly gauges: Gauges;
  /** Historique des jauges, un point par jour simulé. */
  readonly history: readonly Gauges[];
  readonly devs: readonly DevView[];
  readonly tasks: readonly TaskView[];
  readonly candidates: readonly CandidateView[];
  readonly items: readonly PlacedItemView[];
  /** Vrai pendant un incident de production (fumée, écran rouge). */
  readonly incident: boolean;
  /** Taille maximale de l'équipe à cette phase. */
  readonly teamMax: number;
  readonly valuation: number;
  /** Part du capital du fondateur (1 = 100 %). */
  readonly ownership: number;
  /** Carte d'événement en attente d'un choix, sinon null. */
  readonly event: EventView | null;
  /** Bilan du dernier sprint (affiché à l'écran de démo). */
  readonly lastReport: SprintReport | null;
  readonly pitch: PitchView | null;
  /** Peut-on lancer une levée de fonds maintenant ? Sinon, la raison. */
  readonly pitchBlocker: 'WRONG_STAGE' | 'NO_HYPE' | 'COOLDOWN' | null;
  readonly acquisitionOffer: AcquisitionOffer | null;
  readonly canIpo: boolean;
  readonly result: GameResult | null;
  /** Vrai si la simulation avance (faux en planification, en démo, face à une carte). */
  readonly running: boolean;
}

/** Commandes typées envoyées par l'interface. La simulation est seule juge de leur effet. */
export type GameCommand =
  | { readonly type: 'setSpeed'; readonly speed: Speed }
  | {
      readonly type: 'moveTask';
      readonly taskId: string;
      readonly column: KanbanColumn;
      readonly index: number;
    }
  | { readonly type: 'assignTask'; readonly taskId: string; readonly devId: string | null }
  | { readonly type: 'hire'; readonly candidateId: string; readonly offer: number }
  | { readonly type: 'fire'; readonly devId: string }
  | {
      readonly type: 'placeItem';
      readonly kind: string;
      readonly x: number;
      readonly z: number;
      readonly rotation: Rotation;
    }
  | {
      readonly type: 'moveItem';
      readonly itemId: string;
      readonly x: number;
      readonly z: number;
      readonly rotation?: Rotation;
    }
  | { readonly type: 'rotateItem'; readonly itemId: string }
  | { readonly type: 'sellItem'; readonly itemId: string }
  | { readonly type: 'startSprint' }
  | { readonly type: 'resolveEvent'; readonly choiceIndex: number }
  | { readonly type: 'startPitch' }
  | { readonly type: 'pitchArgument'; readonly argumentId: string }
  | { readonly type: 'closePitch' }
  | { readonly type: 'endDemo' }
  | { readonly type: 'answerAcquisition'; readonly accept: boolean }
  | { readonly type: 'launchIpo' };

/** Résultat d'une commande, pour un retour immédiat dans l'interface. */
export type CommandResult =
  | { readonly ok: true; readonly message?: string }
  | { readonly ok: false; readonly reason: string };

/** Jour de la semaine : 0 = lundi … 4 = vendredi, 5 et 6 = week-end. */
export function weekday(day: number): number {
  return day % 7;
}

export function isWeekend(day: number): boolean {
  return weekday(day) >= 5;
}

/** Vendredi 17h : moment où la prod tombe traditionnellement. */
export function isFridayFive(time: GameTime): boolean {
  return weekday(time.day) === 4 && time.minute >= 17 * 60 && time.minute < 18 * 60;
}
