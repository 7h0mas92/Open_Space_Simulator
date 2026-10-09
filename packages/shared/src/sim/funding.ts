import { z } from 'zod';
import type { Phase } from '../game.js';

/**
 * Financements autres que le tour de table (le pitch) : business angels, prêt bancaire,
 * financement participatif et subvention. Leurs montants sont calculés à partir de l'état,
 * sans hasard : une partie qui ne s'en sert pas reste identique au bit près (replays, Daily).
 *
 * Les tours de table à partir de la Série B agrandissent aussi le bureau : chaque tour
 * ajoute une annexe (salle de jeux, jardin, auditorium) tout le long du bureau.
 */

export const FINANCING_KINDS = ['BRIDGE', 'LOAN', 'CROWDFUNDING', 'GRANT'] as const;
export const FinancingKindSchema = z.enum(FINANCING_KINDS);
export type FinancingKind = z.infer<typeof FinancingKindSchema>;

/** Prêt bancaire en cours de remboursement. */
export const LoanSchema = z.object({
  /** Reste à rembourser (intérêts compris). */
  remaining: z.number().nonnegative(),
  /** Mensualité, payée chaque jour au prorata comme les autres dépenses. */
  monthly: z.number().positive(),
});
export type Loan = z.infer<typeof LoanSchema>;

export const FinancingStateSchema = z.object({
  /** Dernier sprint où chaque financement a été obtenu (cooldown). */
  lastSprint: z.partialRecord(FinancingKindSchema, z.number().int()).default({}),
  loan: LoanSchema.nullable().default(null),
});
export type FinancingState = z.infer<typeof FinancingStateSchema>;

/** Raisons pour lesquelles un financement n'est pas disponible. */
export const FINANCING_BLOCKERS = [
  'WRONG_STAGE',
  'COOLDOWN',
  'NO_HYPE',
  'NO_REVENUE',
  'LOAN_ACTIVE',
  'NOT_ENOUGH_USERS',
  'TOO_MUCH_DEBT',
  'TOO_BIG',
] as const;
export type FinancingBlocker = (typeof FINANCING_BLOCKERS)[number];

/** Équilibrage des financements (vérifié par `pnpm balance`, bot « financier »). */
export const FINANCING = {
  BRIDGE: {
    /** Business angels : quelques mois de dépenses contre une petite part du capital. */
    months: 3,
    dilution: 0.06,
    minHype: 20,
    cooldownSprints: 4,
  },
  LOAN: {
    /** La banque prête au plus `revenueMonths` mois de revenus et `expenseMonths` de dépenses. */
    revenueMonths: 8,
    expenseMonths: 6,
    minAmount: 50_000,
    /** Remboursé en `durationMonths` mensualités, intérêts compris. */
    durationMonths: 12,
    interest: 0.1,
    cooldownSprints: 2,
  },
  CROWDFUNDING: {
    minUsers: 2_000,
    minHype: 30,
    /** Euros par utilisateur, multipliés par hype / 60. */
    perUser: 12,
    min: 50_000,
    max: 1_500_000,
    hype: 4,
    /** Les contreparties promises aux contributeurs sont livrées à la va-vite. */
    debt: 4,
    cooldownSprints: 8,
  },
  GRANT: {
    /** Subvention à l'innovation : un montant fixe par phase (trop gros en Licorne). */
    amount: {
      GARAGE: 120_000,
      SEED: 200_000,
      SERIES_A: 300_000,
      UNICORN: 0,
      END: 0,
    } satisfies Record<Phase, number>,
    /** Le dossier technique ne passe pas avec trop de dette. */
    maxDebt: 60,
    /** 80 pages de dossier : le moral de chaque dev en prend un coup. */
    moral: -6,
    cooldownSprints: 10,
  },
} as const;

/** Annexes du bureau, ajoutées par les tours de table à partir de la Série B. */
export const ANNEX_KINDS = ['arcade', 'garden', 'auditorium'] as const;
export type AnnexKind = (typeof ANNEX_KINDS)[number];

/** Nom de chaque annexe, tel qu'il s'insère dans une phrase (« … ouvre »). */
export const ANNEX_NAMES: Record<AnnexKind, { fr: string; en: string }> = {
  arcade: { fr: 'la salle d’arcade', en: 'arcade room' },
  garden: { fr: 'le jardin intérieur', en: 'indoor garden' },
  auditorium: { fr: 'l’auditorium', en: 'auditorium' },
};

export const ANNEXES = {
  /** Levées réussies avant la première annexe (Seed et Série A ne font que changer de phase). */
  firstRound: 2,
  max: ANNEX_KINDS.length,
  /** Profondeur d'une annexe (cloison comprise), en cases. */
  depth: 6,
  /** Places en plus dans l'équipe par annexe. */
  teamPerAnnex: 2,
} as const;

/** Nombre d'annexes pour un nombre de levées réussies. */
export function annexCount(fundingRounds: number): number {
  return Math.max(0, Math.min(fundingRounds - ANNEXES.firstRound, ANNEXES.max));
}

/** Profondeur du bureau, annexes comprises (cases de 1 m). */
export function officeDepthWithAnnexes(baseDepth: number, annexes: number): number {
  return baseDepth + Math.max(0, Math.min(annexes, ANNEXES.max)) * ANNEXES.depth;
}
