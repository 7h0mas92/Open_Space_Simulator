import { z } from 'zod';
import { LocalizedTextSchema } from '../i18n.js';
import type { Phase } from '../game.js';

/**
 * Filiales : à partir de la Série A, la startup peut investir sa trésorerie pour créer
 * d'autres startups. L'entreprise devient un « groupe » : sa valorisation compte les parts
 * détenues dans les filiales, et chaque filiale ajoute une aile au bureau.
 *
 * Le hasard des filiales est tiré sur une graine à part (graine de la partie + filiale +
 * sprint) : une partie sans filiale consomme exactement les mêmes nombres aléatoires
 * qu'avant leur ajout, ce qui garde valides les replays et le Daily.
 */

/** Profil de risque d'un projet : prudent, audacieux ou « moonshot ». */
export const VENTURE_RISKS = ['SAFE', 'BOLD', 'MOONSHOT'] as const;
export const VentureRiskSchema = z.enum(VENTURE_RISKS);
export type VentureRisk = z.infer<typeof VentureRiskSchema>;

export const VENTURE_STATUSES = ['ACTIVE', 'DEAD', 'SOLD'] as const;
export const VentureStatusSchema = z.enum(VENTURE_STATUSES);
export type VentureStatus = z.infer<typeof VentureStatusSchema>;

/** Une filiale créée par le joueur. */
export const VentureSchema = z.object({
  /** Identifiant stable dans la partie (« v1 », « v2 »…). */
  id: z.string(),
  /** Projet d'origine (catalogue `VENTURE_IDEAS`). */
  ideaId: z.string(),
  name: LocalizedTextSchema,
  risk: VentureRiskSchema,
  /** Montant investi par la startup mère. */
  invested: z.number().nonnegative(),
  /** Part du capital détenue par la startup mère (0 à 1). */
  stake: z.number().min(0).max(1),
  /** Valorisation de la filiale (100 % du capital). 0 si elle a coulé. */
  valuation: z.number().nonnegative(),
  foundedAtSprint: z.number().int(),
  status: VentureStatusSchema,
  /** Dividendes déjà versés à la startup mère. */
  dividends: z.number().nonnegative(),
  /** Prix de revente des parts (statut SOLD). */
  soldFor: z.number().nonnegative().nullable(),
  /** Sprint de la faillite ou de la revente. */
  closedAtSprint: z.number().int().nullable(),
  /** Valorisation à la fin de chaque sprint depuis la création (graphique). */
  history: z.array(z.number().nonnegative()),
});
export type Venture = z.infer<typeof VentureSchema>;

/** Projet proposé au joueur pendant la planification. */
export interface VentureIdea {
  readonly id: string;
  readonly name: { readonly fr: string; readonly en: string };
  readonly pitch: { readonly fr: string; readonly en: string };
  readonly icon: string;
  readonly risk: VentureRisk;
}

export interface VentureRiskProfile {
  /** Coût de création (fourchette, arrondi à 50 k€). */
  cost: { min: number; max: number };
  /** Multiplicateur de valorisation tiré à chaque sprint (uniforme). */
  growth: { min: number; max: number };
  /** Probabilité de couler à chaque sprint. */
  deathChance: number;
  /** Part de la valeur de nos parts versée en dividendes à chaque sprint, une fois rentable. */
  dividendRate: number;
}

/** Équilibrage des filiales (vérifié par `pnpm balance`, bot « investor »). */
export const VENTURES = {
  /** Phase à partir de laquelle on peut créer une filiale. */
  unlockPhase: 'SERIES_A' satisfies Phase as Phase,
  /** Filiales fondées au maximum dans une partie (une aile du bureau chacune). */
  maxFounded: 3,
  /** Sprints entre deux créations. */
  cooldownSprints: 3,
  /** Pas de création pendant les derniers sprints : elle n'aurait pas le temps de grandir. */
  closedLastSprints: 3,
  /** Projets proposés à chaque planification. */
  ideasPerSprint: 3,
  /** Il doit rester au moins ce nombre de mois de dépenses en caisse après l'investissement. */
  minRunwayMonthsAfter: 6,
  /** Part du capital gardée par la startup mère (le reste va aux cofondateurs de la filiale). */
  stake: 0.8,
  /** Une filiale verse des dividendes à partir de ce nombre de sprints d'existence... */
  dividendsAfterSprints: 3,
  /** ... et si elle vaut au moins ce multiple de sa valorisation de départ. */
  dividendsMinMultiple: 1.2,
  /** Valorisation maximale d'une filiale : elle ne remplace pas la startup principale. */
  maxValuation: 800_000_000,
  /** Décote à la revente des parts. */
  saleDiscount: 0.9,
  hypeOnCreate: 5,
  hypeOnDeath: -5,
  /**
   * Places supplémentaires dans l'équipe par aile du bureau. Volontairement peu : avec +4,
   * le bot « investor » recrutait jusqu'à 27 devs en Série A et sa valorisation médiane
   * tombait de moitié (voir docs/balance.md).
   */
  teamPerWing: 2,
  /** Largeur d'une aile (cloison comprise), en cases. */
  wingWidth: 6,
  risks: {
    SAFE: {
      cost: { min: 400_000, max: 900_000 },
      growth: { min: 1.025, max: 1.16 },
      deathChance: 0.01,
      dividendRate: 0.018,
    },
    BOLD: {
      cost: { min: 800_000, max: 1_800_000 },
      growth: { min: 0.94, max: 1.38 },
      deathChance: 0.028,
      dividendRate: 0.009,
    },
    MOONSHOT: {
      cost: { min: 1_500_000, max: 3_000_000 },
      growth: { min: 0.79, max: 1.78 },
      deathChance: 0.065,
      dividendRate: 0,
    },
  } satisfies Record<VentureRisk, VentureRiskProfile>,
} as const;

/** Taille de la grille du bureau, ailes des filiales comprises (cases de 1 m). */
export function officeWidthWithWings(baseWidth: number, wings: number): number {
  return baseWidth + Math.max(0, Math.min(wings, VENTURES.maxFounded)) * VENTURES.wingWidth;
}
