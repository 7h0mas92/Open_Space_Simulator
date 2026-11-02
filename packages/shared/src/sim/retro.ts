import { z } from 'zod';
import { EntityIdSchema } from './components.js';

/*
 * Rétrospective de sprint : après la démo, au début de la planification, l'équipe se réunit
 * pour choisir une action d'amélioration. Trois actions sont proposées selon le sprint écoulé
 * (pannes, dette, café, réunions, conflits...), chaque dev vote selon son profil et son
 * caractère, et le joueur tranche. L'action donne un petit bonus pendant tout le sprint suivant.
 *
 * Gratuit et facultatif : un joueur qui passe la rétro (ou un bot qui l'ignore) joue exactement
 * la même partie qu'avant l'ajout de la mécanique. Les égalités de vote sont départagées sur
 * une graine à part (graine de la partie + « retro » + sprint).
 */

export const RETRO_ACTIONS = [
  'MORE_TESTS',
  'CODE_REVIEW',
  'COFFEE_BAR',
  'NO_MEETING_WEDNESDAY',
  'MEDIATION',
  'ON_CALL',
  'FLEX_HOURS',
  'SMALLER_TICKETS',
  'KUDOS',
  'KEEP_GOING',
] as const;
export const RetroActionSchema = z.enum(RETRO_ACTIONS);
export type RetroAction = z.infer<typeof RetroActionSchema>;

export const RETRO = {
  /** Actions proposées à chaque rétro. */
  options: 3,
  /** Suivre le vote de l'équipe : moral pour tous. Imposer un autre choix : moral perdu par
   * ceux qui ont voté autrement. */
  followMoral: 3,
  imposeMoral: 3,
  /** Plus de tests : dette des features livrées. */
  moreTestsDebtFactor: 0.85,
  /** Revue de code obligatoire : qualité et vitesse. */
  codeReviewQuality: 1.05,
  codeReviewSpeed: 0.95,
  /** Café en libre-service : consommation. */
  coffeeBarConsumption: 0.7,
  /** Médiation : affinités négatives remontées d'un coup (jamais au-dessus de 0). */
  mediationAffinity: 15,
  /** Astreinte organisée : vitesse sur les tâches urgentes. */
  onCallUrgentSpeed: 1.25,
  /** Horaires flexibles : fatigue du travail. */
  flexHoursFatigue: 0.85,
  /** Découper les tickets : vitesse sur les petites tâches (taille 2 au plus). */
  smallTicketsSpeed: 1.08,
  smallTicketMaxSize: 2,
  /** Kudos du vendredi : moral par jour ouvré. */
  kudosDailyMoral: 1,
  /** Continuer comme ça : vitesse. */
  keepGoingSpeed: 1.03,
  /** Seuils des problèmes détectés sur le sprint écoulé. */
  incidentsThreshold: 2,
  debtThreshold: 50,
  energyThreshold: 50,
  moralThreshold: 50,
  shippedThreshold: 1,
  conflictAffinity: -25,
} as const;

/** Rétro du sprint qui commence (proposée), et action en vigueur. */
export const RetroStateSchema = z.object({
  /** Rétro en attente de décision (null : aucune, déjà tenue, ou passée). */
  pending: z
    .object({
      sprint: z.number().int(),
      options: z.array(RetroActionSchema),
      /** Vote de chaque dev : identifiant → action. */
      votes: z.record(EntityIdSchema, RetroActionSchema),
    })
    .nullable(),
  /** Action retenue et sprint où elle s'applique (null : aucune). */
  active: z.object({ action: RetroActionSchema, sprint: z.number().int() }).nullable(),
  /** Rétros tenues et actions choisies contre le vote de l'équipe. */
  held: z.number().int().nonnegative(),
  imposed: z.number().int().nonnegative(),
});
export type RetroState = z.infer<typeof RetroStateSchema>;

export function emptyRetroState(): RetroState {
  return { pending: null, active: null, held: 0, imposed: 0 };
}
