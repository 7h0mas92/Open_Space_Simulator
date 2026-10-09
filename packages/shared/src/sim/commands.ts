import { z } from 'zod';
import { EntityIdSchema, FurnitureColorSchema } from './components.js';

/**
 * Commandes typées envoyées par l'interface à la simulation. C'est le SEUL moyen de
 * modifier une partie : la liste horodatée des commandes, avec la graine, suffit à
 * rejouer une partie à l'identique (replays, vérification des scores côté serveur).
 */
export const CommandSchema = z.discriminatedUnion('type', [
  /** Fin de la planification : le sprint démarre. */
  z.object({ type: z.literal('START_SPRINT') }),
  /** Glisser-déposer du Kanban entre BACKLOG et TODO (`index` : position d'arrivée). */
  z.object({
    type: z.literal('MOVE_TASK'),
    taskId: EntityIdSchema,
    column: z.enum(['BACKLOG', 'TODO']),
    index: z.number().int().nonnegative().optional(),
  }),
  /** Affecte une tâche à un dev (ou la libère avec `devId: null`). */
  z.object({
    type: z.literal('ASSIGN_TASK'),
    taskId: EntityIdSchema,
    devId: EntityIdSchema.nullable(),
  }),
  z.object({ type: z.literal('RESOLVE_EVENT'), choiceIndex: z.number().int().min(0).max(3) }),
  z.object({
    type: z.literal('MAKE_OFFER'),
    candidateId: z.string(),
    salary: z.number().positive().max(1_000_000),
  }),
  z.object({ type: z.literal('FIRE_DEV'), devId: EntityIdSchema }),
  z.object({
    type: z.literal('BUY_FURNITURE'),
    itemId: z.string(),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    rotation: z.number().int().min(0).max(3),
    color: FurnitureColorSchema.optional(),
  }),
  /** Achète un accessoire et le pose sur l'emplacement `slot` du meuble `hostId`. */
  z.object({
    type: z.literal('BUY_ACCESSORY'),
    itemId: z.string(),
    hostId: EntityIdSchema,
    slot: z.number().int().nonnegative().max(15),
    rotation: z.number().int().min(0).max(3),
    color: FurnitureColorSchema.optional(),
  }),
  /** Déplace un accessoire vers un autre emplacement (du même meuble ou d'un autre). */
  z.object({
    type: z.literal('MOVE_ACCESSORY'),
    furnitureId: EntityIdSchema,
    hostId: EntityIdSchema,
    slot: z.number().int().nonnegative().max(15),
    rotation: z.number().int().min(0).max(3),
  }),
  /** Change la couleur d'un objet posé (gratuit, purement esthétique). */
  z.object({
    type: z.literal('PAINT_FURNITURE'),
    furnitureId: EntityIdSchema,
    color: FurnitureColorSchema,
  }),
  z.object({
    type: z.literal('MOVE_FURNITURE'),
    furnitureId: EntityIdSchema,
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    rotation: z.number().int().min(0).max(3),
  }),
  z.object({ type: z.literal('SELL_FURNITURE'), furnitureId: EntityIdSchema }),
  /** Range un objet posé dans l'inventaire (avec les accessoires posés dessus). */
  z.object({ type: z.literal('STORE_FURNITURE'), furnitureId: EntityIdSchema }),
  /**
   * Ressort de l'inventaire le premier objet rangé de ce type et de cette couleur (absente :
   * couleurs d'origine) et le pose au sol (gratuit).
   */
  z.object({
    type: z.literal('PLACE_STORED'),
    itemId: z.string(),
    color: FurnitureColorSchema.optional(),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    rotation: z.number().int().min(0).max(3),
  }),
  /** Ressort un accessoire de l'inventaire (même règle) et le pose sur un meuble à plateau. */
  z.object({
    type: z.literal('PLACE_STORED_ACCESSORY'),
    itemId: z.string(),
    color: FurnitureColorSchema.optional(),
    hostId: EntityIdSchema,
    slot: z.number().int().nonnegative().max(15),
    rotation: z.number().int().min(0).max(3),
  }),
  /** Revend un objet rangé de ce type et de cette couleur. */
  z.object({
    type: z.literal('SELL_STORED'),
    itemId: z.string(),
    color: FurnitureColorSchema.optional(),
  }),
  z.object({ type: z.literal('START_PITCH') }),
  z.object({ type: z.literal('PITCH_ARGUMENT'), argumentId: z.string() }),
  z.object({ type: z.literal('CLOSE_PITCH') }),
  /** Fin de l'écran de démo : passage au sprint suivant. */
  z.object({ type: z.literal('END_DEMO') }),
  z.object({ type: z.literal('ANSWER_ACQUISITION'), accept: z.boolean() }),
  /** Réponse à la demande d'augmentation d'un dev (pendant la planification). */
  z.object({ type: z.literal('ANSWER_RAISE'), accept: z.boolean() }),
  z.object({ type: z.literal('LAUNCH_IPO') }),
  /** Crée une filiale à partir d'un des projets proposés pendant la planification. */
  z.object({ type: z.literal('FOUND_VENTURE'), ideaId: z.string() }),
  /** Revend les parts détenues dans une filiale. */
  z.object({ type: z.literal('SELL_VENTURE'), ventureId: z.string() }),
]);
export type Command = z.infer<typeof CommandSchema>;
export type CommandType = Command['type'];

/** Une commande et le tick où elle a été appliquée. */
export const LoggedCommandSchema = z.object({
  tick: z.number().int().nonnegative(),
  command: CommandSchema,
});
export type LoggedCommand = z.infer<typeof LoggedCommandSchema>;

export const CommandLogSchema = z.array(LoggedCommandSchema).max(50_000);

/** Raisons pour lesquelles une commande est refusée (traduites par l'UI). */
export const COMMAND_ERRORS = [
  'INVALID_COMMAND',
  'WRONG_STAGE',
  'NOT_FOUND',
  'INVALID_CHOICE',
  'TEAM_FULL',
  'NOT_ENOUGH_MONEY',
  'INVALID_PLACEMENT',
  'LOCKED',
  'COOLDOWN',
  'NO_HYPE',
  'NOT_ELIGIBLE',
  'GAME_OVER',
  'VENTURE_LIMIT',
  'TOO_LATE',
  'INVENTORY_FULL',
  'RAISE_PENDING',
] as const;
export type CommandError = (typeof COMMAND_ERRORS)[number];

export type CommandResult = { ok: true } | { ok: false; error: CommandError };
