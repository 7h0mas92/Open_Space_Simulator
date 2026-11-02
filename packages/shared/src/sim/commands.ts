import { z } from 'zod';
import { EntityIdSchema, FurnitureColorSchema, GridPositionSchema } from './components.js';
import { ComputerIdSchema } from './computers.js';
import { MeetingFormatIdSchema } from './meetings.js';
import { MonitorModelSchema, MonitorMountSchema, MonitorSizeSchema } from './monitors.js';
import { FinancingKindSchema } from './funding.js';
import { PetCoatSchema } from './pets.js';
import { FloorMaterialIdSchema, FloorTintSchema, FloorZoneSchema } from './floors.js';
import { FibrePlanIdSchema } from './serverRoom.js';
import { WallFinishIdSchema, WallZoneSchema } from './walls.js';

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
  /** Bouton « Tout en À faire » : tout le backlog passe dans la colonne TODO, dans l'ordre. */
  z.object({ type: z.literal('MOVE_ALL_TO_TODO') }),
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
    x: GridPositionSchema,
    y: GridPositionSchema,
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
  /**
   * Change l'écran d'un poste de travail (bureau de dev, bureau debout) : modèle, taille, pied
   * ou bras. Le nouvel écran est payé, l'ancien revendu à moitié prix.
   */
  z.object({
    type: z.literal('SET_MONITOR'),
    furnitureId: EntityIdSchema,
    model: MonitorModelSchema,
    size: MonitorSizeSchema,
    mount: MonitorMountSchema,
  }),
  z.object({
    type: z.literal('MOVE_FURNITURE'),
    furnitureId: EntityIdSchema,
    x: GridPositionSchema,
    y: GridPositionSchema,
    rotation: z.number().int().min(0).max(3),
  }),
  /** Déplace ou tourne un objet du décor offert avec une annexe (voir `annexDecor.ts`). */
  z.object({
    type: z.literal('MOVE_ANNEX_DECOR'),
    key: z.string().max(8),
    x: GridPositionSchema,
    y: GridPositionSchema,
    rotation: z.number().int().min(0).max(3),
  }),
  /** Allume ou éteint un projecteur : allumé, il déroule l'écran posé en face de lui. */
  z.object({ type: z.literal('SWITCH_PROJECTOR'), furnitureId: EntityIdSchema, on: z.boolean() }),
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
    x: GridPositionSchema,
    y: GridPositionSchema,
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
  /** Peint ou tapisse une zone de mur (l'ancien revêtement n'est pas remboursé). */
  z.object({ type: z.literal('COVER_WALL'), zone: WallZoneSchema, finish: WallFinishIdSchema }),
  /** Pose un sol (matière et teinte) dans une pièce (l'ancien sol n'est pas remboursé). */
  z.object({
    type: z.literal('COVER_FLOOR'),
    zone: FloorZoneSchema,
    material: FloorMaterialIdSchema,
    tint: FloorTintSchema,
  }),
  z.object({ type: z.literal('START_PITCH') }),
  z.object({ type: z.literal('PITCH_ARGUMENT'), argumentId: z.string() }),
  z.object({ type: z.literal('CLOSE_PITCH') }),
  /** Financement hors tour de table : business angels, prêt, financement participatif… */
  z.object({ type: z.literal('TAKE_FINANCING'), kind: FinancingKindSchema }),
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
  /** Aménage la salle de réunion avec une formule (remplace l'aménagement précédent). */
  z.object({ type: z.literal('FIT_MEETING_ROOM'), format: MeetingFormatIdSchema }),
  /** Démonte l'aménagement de la salle de réunion (remboursé en partie). */
  z.object({ type: z.literal('CLEAR_MEETING_ROOM') }),
  /** Adopte un chat de cette robe (litière, gamelle et arbre à chat posés). */
  z.object({ type: z.literal('ADOPT_PET'), coat: PetCoatSchema }),
  /** Confie un chat à une famille (sans remboursement, l'équipe est triste). */
  z.object({ type: z.literal('REHOME_PET'), petId: z.string().max(32) }),
  /** Change l'ordinateur d'un bureau (l'ancien est revendu, le nouveau payé). */
  z.object({
    type: z.literal('SET_COMPUTER'),
    furnitureId: EntityIdSchema,
    computer: ComputerIdSchema,
  }),
  /** Souscrit à une offre fibre, ou en change : la première semaine est payée tout de suite. */
  z.object({ type: z.literal('SUBSCRIBE_FIBRE'), plan: FibrePlanIdSchema }),
  /** Résilie l'abonnement fibre (la semaine entamée n'est pas remboursée). */
  z.object({ type: z.literal('CANCEL_FIBRE') }),
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
  'NOT_AVAILABLE',
  'INVENTORY_FULL',
  'RAISE_PENDING',
] as const;
export type CommandError = (typeof COMMAND_ERRORS)[number];

export type CommandResult = { ok: true } | { ok: false; error: CommandError };
