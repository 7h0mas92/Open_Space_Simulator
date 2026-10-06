import { z } from 'zod';
import { LocalizedTextSchema } from '../i18n.js';

/**
 * Composants de l'ECS (Entity Component System) de la simulation.
 *
 * Une entité n'est qu'un identifiant ("e12"). Ses données vivent dans des
 * "magasins" de composants : `components.identity["e12"]`, `components.mood["e12"]`...
 * Un système (fonction pure) parcourt les entités qui possèdent les composants
 * dont il a besoin. Tout est sérialisable en JSON : c'est ce qui rend la
 * sauvegarde instantanée.
 */

export const EntityIdSchema = z.string().regex(/^e\d+$/);
export type EntityId = z.infer<typeof EntityIdSchema>;

/** Les 8 profils de développeurs du jeu. */
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
export const DevRoleSchema = z.enum(DEV_ROLES);
export type DevRole = z.infer<typeof DevRoleSchema>;

/** Traits de personnalité : un par dev, en plus de son profil. */
export const DEV_TRAITS = [
  'COFFEE_ADDICT',
  'NIGHT_OWL',
  'WORKAHOLIC',
  'CHATTERBOX',
  'PERFECTIONIST',
  'GRUMPY',
  'ZEN',
  'GAMER',
] as const;
export const DevTraitSchema = z.enum(DEV_TRAITS);
export type DevTrait = z.infer<typeof DevTraitSchema>;

/**
 * Activité courante d'un personnage. Le rendu s'en sert pour choisir l'animation
 * et la destination (machine à café, salle de réunion, babyfoot...).
 */
export const ACTIVITIES = [
  'WORKING',
  'IDLE',
  'COFFEE',
  'MEETING',
  'CHATTING',
  'ARGUING',
  'SLEEPING',
  'YELLING',
  'BABYFOOT',
  'GONE',
] as const;
export const ActivitySchema = z.enum(ACTIVITIES);
export type Activity = z.infer<typeof ActivitySchema>;

export const TASK_TYPES = ['FEATURE', 'REFACTO', 'BUGFIX', 'INFRA'] as const;
export const TaskTypeSchema = z.enum(TASK_TYPES);
export type TaskType = z.infer<typeof TaskTypeSchema>;

/** Colonnes du Kanban. Le joueur déplace les tâches entre BACKLOG et TODO. */
export const TASK_COLUMNS = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE'] as const;
export const TaskColumnSchema = z.enum(TASK_COLUMNS);
export type TaskColumn = z.infer<typeof TaskColumnSchema>;

const Score = z.number().min(0).max(100);

/** Qui est ce dev ? Données fixées à l'embauche. */
export const IdentitySchema = z.object({
  name: z.string(),
  age: z.number().int(),
  role: DevRoleSchema,
  trait: DevTraitSchema,
  bio: LocalizedTextSchema,
  /** Variante visuelle (0 à 17) : le rendu choisit le modèle de personnage avec. */
  look: z.number().int().min(0),
});
export type Identity = z.infer<typeof IdentitySchema>;

/** Statistiques de 1 à 10. */
export const StatsSchema = z.object({
  speed: z.number().min(1).max(10),
  quality: z.number().min(1).max(10),
  endurance: z.number().min(1).max(10),
  ego: z.number().min(1).max(10),
});
export type Stats = z.infer<typeof StatsSchema>;

export const EmploymentSchema = z.object({
  /** Salaire mensuel chargé, en euros. */
  salary: z.number().nonnegative(),
  hiredAtSprint: z.number().int(),
  xp: z.number().nonnegative(),
  level: z.number().int().min(1),
  tasksDone: z.number().int().nonnegative(),
});
export type Employment = z.infer<typeof EmploymentSchema>;

export const MoodSchema = z.object({
  moral: Score,
  energy: Score,
});
export type Mood = z.infer<typeof MoodSchema>;

/** Affinité avec chaque collègue, de -100 (conflit) à +100 (meilleurs amis). */
export const RelationsSchema = z.record(z.string(), z.number().min(-100).max(100));
export type Relations = z.infer<typeof RelationsSchema>;

export const ActivityStateSchema = z.object({
  kind: ActivitySchema,
  /** Tick jusqu'auquel l'activité dure (exclu). */
  untilTick: z.number().int(),
  /** Collègue impliqué (discussion, dispute). */
  withId: EntityIdSchema.nullable(),
});
export type ActivityState = z.infer<typeof ActivityStateSchema>;

export const WorkerSchema = z.object({
  taskId: EntityIdSchema.nullable(),
});
export type Worker = z.infer<typeof WorkerSchema>;

/** Une ligne de l'historique d'un dev (affichée dans sa fiche). */
export const DevLogEntrySchema = z.object({
  sprint: z.number().int(),
  text: LocalizedTextSchema,
});
export type DevLogEntry = z.infer<typeof DevLogEntrySchema>;

export const TaskSchema = z.object({
  title: LocalizedTextSchema,
  type: TaskTypeSchema,
  /** Taille en points (suite de Fibonacci). */
  size: z.number().int().positive(),
  /** Travail accompli et travail nécessaire, en "unités dev-heure". */
  progress: z.number().nonnegative(),
  work: z.number().positive(),
  column: TaskColumnSchema,
  /** Position dans sa colonne (ordre de priorité). */
  order: z.number(),
  assigneeId: EntityIdSchema.nullable(),
  /** Somme pondérée de la qualité des contributions (0 à 1 par unité de travail). */
  qualitySum: z.number().nonnegative(),
  /** Dette technique ajoutée par les raccourcis pris sur cette tâche. */
  debtFactor: z.number().nonnegative(),
  /** Utilise un framework de moins de 5 ans : le Senior Barbu traîne des pieds. */
  shinyFramework: z.boolean(),
  /** La designeuse a validé le padding. */
  designApproved: z.boolean(),
  /** Feature hallucinée par l'IA Agent : livrée, mais elle n'existe pas. */
  hallucinated: z.boolean(),
  createdAtSprint: z.number().int(),
  doneAtSprint: z.number().int().nullable(),
});
export type Task = z.infer<typeof TaskSchema>;

export const ROTATIONS = [0, 1, 2, 3] as const;

/** Objet posé sur la grille du bureau. */
export const FurnitureSchema = z.object({
  itemId: z.string(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  /** Quart de tour (0 à 3). */
  rotation: z.number().int().min(0).max(3),
  purchasePrice: z.number().nonnegative(),
});
export type Furniture = z.infer<typeof FurnitureSchema>;

/** Composant "tag" (sans données) : ce dev a été converti à Rust par le Rustacé. */
export const TagSchema = z.literal(true);

export const ComponentStoresSchema = z.object({
  identity: z.record(z.string(), IdentitySchema),
  stats: z.record(z.string(), StatsSchema),
  employment: z.record(z.string(), EmploymentSchema),
  mood: z.record(z.string(), MoodSchema),
  relations: z.record(z.string(), RelationsSchema),
  activity: z.record(z.string(), ActivityStateSchema),
  worker: z.record(z.string(), WorkerSchema),
  devLog: z.record(z.string(), z.array(DevLogEntrySchema)),
  task: z.record(z.string(), TaskSchema),
  furniture: z.record(z.string(), FurnitureSchema),
  remote: z.record(z.string(), TagSchema),
  rustConverted: z.record(z.string(), TagSchema),
});
export type ComponentStores = z.infer<typeof ComponentStoresSchema>;
export type ComponentName = keyof ComponentStores;
/** Type des données d'un composant : `ComponentOf<'mood'>` vaut `Mood`. */
export type ComponentOf<K extends ComponentName> = ComponentStores[K][string];
