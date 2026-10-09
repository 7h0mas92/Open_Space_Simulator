import { z } from 'zod';
import { EntityIdSchema } from './components.js';

/**
 * Demandes d'augmentation : de temps en temps (tous les 5 à 10 sprints, voir `BALANCE.raises`),
 * un dev vient réclamer plus d'argent pendant la planification. Le joueur accepte ou refuse.
 *
 * Le hasard de cette mécanique est tiré sur une graine à part (graine de la partie +
 * « raise » + sprint) : elle ne consomme aucun nombre du générateur principal.
 */

/** Demande en attente d'une réponse du joueur (affichée dans une fenêtre de décision). */
export const RaiseRequestSchema = z.object({
  devId: EntityIdSchema,
  /** Salaire mensuel actuel et salaire demandé. */
  currentSalary: z.number().nonnegative(),
  requestedSalary: z.number().nonnegative(),
  /** Sprint de la demande. */
  sprint: z.number().int(),
});
export type RaiseRequest = z.infer<typeof RaiseRequestSchema>;

/** Dev qui a démissionné après un refus : il part au début de la planification `leavesAtSprint`. */
export const DepartureSchema = z.object({
  devId: EntityIdSchema,
  leavesAtSprint: z.number().int(),
});
export type Departure = z.infer<typeof DepartureSchema>;

export const RaisesStateSchema = z.object({
  /** Sprint de la prochaine occasion de demande (null : pas encore tirée). */
  nextSprint: z.number().int().nullable(),
  pending: RaiseRequestSchema.nullable(),
  departures: z.array(DepartureSchema),
  /** Demandes acceptées et refusées depuis le début de la partie. */
  granted: z.number().int().nonnegative(),
  refused: z.number().int().nonnegative(),
});
export type RaisesState = z.infer<typeof RaisesStateSchema>;

/** État de départ (et valeur par défaut des sauvegardes d'avant les demandes d'augmentation). */
export function emptyRaisesState(): RaisesState {
  return { nextSprint: null, pending: null, departures: [], granted: 0, refused: 0 };
}
