/**
 * Modèle de vue : ce que le rendu (`render/`) et l'interface (`ui/`) lisent.
 *
 * C'est la frontière entre la simulation et l'affichage. La simulation (étape 3, `simulation/`)
 * produira son propre état ; un adaptateur le convertira en `GameView`. Tant qu'elle n'existe pas,
 * `view/mock.ts` fournit une fausse partie déterministe pour développer la scène et le HUD.
 *
 * Règle : ces objets sont des instantanés en lecture seule. Le rendu ne les modifie jamais ;
 * l'interface envoie des `GameCommand` pour demander un changement.
 */
import type { Phase, Speed } from '@oss/shared';

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
  /** Clé de trait (traduite par i18n : `traits.<clé>`). */
  readonly trait: string;
  /** Clé de bio drôle (traduite par i18n : `bios.<clé>`). */
  readonly bio: string;
  readonly stats: DevStats;
  /** Salaire mensuel en euros. */
  readonly salary: number;
  readonly level: number;
  /** Moral de 0 à 100. */
  readonly morale: number;
  readonly activity: DevActivity;
  /** Affinité avec chaque collègue, de -100 (conflit) à +100. */
  readonly relations: Readonly<Record<string, number>>;
  /** Faits marquants, du plus récent au plus ancien (clés i18n `history.*`). */
  readonly history: readonly string[];
  /** Index du personnage Kenney (character-a … character-r). */
  readonly look: number;
}

export const TASK_TYPES = ['FEATURE', 'REFACTOR', 'BUGFIX', 'INFRA'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const KANBAN_COLUMNS = ['BACKLOG', 'TODO', 'DOING', 'DONE'] as const;
export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

export interface TaskView {
  readonly id: string;
  /** Clé de titre (i18n `tasks.<clé>`). */
  readonly title: string;
  readonly type: TaskType;
  /** Taille en points (1, 2, 3, 5, 8). */
  readonly size: number;
  readonly column: KanbanColumn;
  readonly assigneeId: string | null;
  /** Avancement de 0 à 1. */
  readonly progress: number;
  /** Effet attendu sur les jauges, affiché sur la carte. */
  readonly impact: Partial<Gauges>;
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
}

export interface GameTime {
  /** Sprint courant, de 1 à 39. */
  readonly sprint: number;
  /** Jour ouvré dans le sprint, de 0 à 9 (lundi = 0, 5). */
  readonly day: number;
  /** Minute de la journée, de 0 à 1439. */
  readonly minute: number;
  readonly speed: Speed;
}

export const SPRINT_STEPS = ['PLANNING', 'EXECUTION', 'DEMO'] as const;
export type SprintStep = (typeof SPRINT_STEPS)[number];

export interface GameView {
  readonly seed: number;
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
  | { readonly type: 'moveItem'; readonly itemId: string; readonly x: number; readonly z: number }
  | { readonly type: 'rotateItem'; readonly itemId: string }
  | { readonly type: 'sellItem'; readonly itemId: string }
  | { readonly type: 'startSprint' };

/** Résultat d'une commande, pour un retour immédiat dans l'interface. */
export type CommandResult =
  | { readonly ok: true; readonly message?: string }
  | { readonly ok: false; readonly reason: string };

/** Jours ouvrés : 0 = lundi … 4 = vendredi. */
export function weekday(day: number): number {
  return day % 5;
}

/** Vendredi 17h : moment où la prod tombe traditionnellement. */
export function isFridayFive(time: GameTime): boolean {
  return weekday(time.day) === 4 && time.minute >= 17 * 60 && time.minute < 18 * 60;
}
