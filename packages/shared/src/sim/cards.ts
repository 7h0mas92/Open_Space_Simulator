import { z } from 'zod';
import { LocalizedTextSchema } from '../i18n.js';
import { PhaseSchema } from '../game.js';
import { DecorThemeSchema } from './calendar.js';
import { DEV_ROLES, DevRoleSchema, type DevRole } from './components.js';

/**
 * Format des cartes d'événements (« crises »), tel que décrit dans le cahier des charges.
 * Les cartes sont stockées en base (table EventCard), servies par GET /api/events
 * et mises en cache côté client pour le mode hors ligne.
 */

/** Jauges qu'une condition de carte peut tester. `moral` est la moyenne de l'équipe. */
export const CARD_GAUGES = [
  'treasury',
  'coffee',
  'hype',
  'debt',
  'stability',
  'users',
  'moral',
] as const;
export const CardGaugeSchema = z.enum(CARD_GAUGES);
export type CardGauge = z.infer<typeof CardGaugeSchema>;

const RangeSchema = z
  .strictObject({ min: z.number().optional(), max: z.number().optional() })
  .refine((range) => range.min === undefined || range.max === undefined || range.min <= range.max, {
    message: 'min doit être inférieur ou égal à max',
  });

export const CardConditionsSchema = z.strictObject({
  minPhase: PhaseSchema.optional(),
  maxPhase: PhaseSchema.optional(),
  /** Un dev de ce profil doit faire partie de l'équipe. */
  hasRole: DevRoleSchema.optional(),
  gauges: z.partialRecord(CardGaugeSchema, RangeSchema).optional(),
  /** Jour de la semaine, de 1 (lundi) à 7 (dimanche). */
  dayOfWeek: z.number().int().min(1).max(7).optional(),
  /** La carte ne tombe qu'à partir de cette heure (0 à 23). */
  afterHour: z.number().int().min(0).max(23).optional(),
  /** Identifiant d'une carte qui doit déjà être sortie. */
  requiresSeen: z.string().optional(),
  /** La carte ne tombe que pendant la période de ce thème (Halloween, Noël…). */
  season: DecorThemeSchema.optional(),
});
export type CardConditions = z.infer<typeof CardConditionsSchema>;

type RoleMoralShape = { [K in DevRole as `moral.${K}`]: z.ZodOptional<z.ZodNumber> };
const roleMoralShape = Object.fromEntries(
  DEV_ROLES.map((role) => [`moral.${role}`, z.number().optional()]),
) as RoleMoralShape;

/**
 * Effets d'un choix. Les jauges sont des variations ajoutées à la valeur actuelle,
 * sauf `users`, exprimé en pourcentage (−10 = perdre 10 % des utilisateurs) pour
 * garder le même poids en Garage qu'en Licorne. `treasury` est en euros.
 */
export const CardEffectsSchema = z.strictObject({
  treasury: z.number().optional(),
  coffee: z.number().optional(),
  hype: z.number().optional(),
  debt: z.number().optional(),
  stability: z.number().optional(),
  users: z.number().min(-100).optional(),
  /** Moral de toute l'équipe. */
  moral: z.number().optional(),
  ...roleMoralShape,
  /** Sprints perdus : le calendrier avance sans production (salaires payés). */
  sprintsLost: z.number().int().min(0).max(3).optional(),
  /**
   * « On en reparle » : remet une carte en file. Sans `cardId`, la même carte revient
   * avec des effets négatifs aggravés ; avec `cardId`, une version pire écrite à part.
   */
  requeue: z
    .strictObject({
      cardId: z.string().optional(),
      delaySprints: z.number().int().min(0).max(5).optional(),
    })
    .optional(),
  /** Recrute gratuitement un dev de ce profil (si l'équipe a de la place). */
  spawnDev: DevRoleSchema.optional(),
  /** Un dev de ce profil (ou au hasard) quitte l'entreprise. */
  fireDev: z.union([DevRoleSchema, z.literal('RANDOM')]).optional(),
  unlockAchievement: z.string().optional(),
});
export type CardEffects = z.infer<typeof CardEffectsSchema>;

export const CardChoiceSchema = z.strictObject({
  label: LocalizedTextSchema,
  effects: CardEffectsSchema,
});
export type CardChoice = z.infer<typeof CardChoiceSchema>;

export const CardIdSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/, 'Identifiant en kebab-case');

export const EventCardSchema = z.strictObject({
  id: CardIdSchema,
  title: LocalizedTextSchema,
  description: LocalizedTextSchema,
  conditions: CardConditionsSchema,
  /** Poids du tirage. 0 : la carte ne sort que par une chaîne (`requeue`). */
  weight: z.number().int().min(0).max(100),
  /** Nombre de sprints avant que la carte puisse ressortir. */
  cooldownSprints: z.number().int().min(0).max(39),
  choices: z.array(CardChoiceSchema).min(2).max(4),
});
export type EventCard = z.infer<typeof EventCardSchema>;

export const EventCardListSchema = z.array(EventCardSchema);

/** Réponse de GET /api/events. */
export const EventsResponseSchema = z.object({ cards: EventCardListSchema });
export type EventsResponse = z.infer<typeof EventsResponseSchema>;
