import { GAME, type Phase } from '../game.js';
import type { DevRole } from './components.js';

/**
 * Constantes de temps. La simulation avance par pas fixes (ticks) : c'est ce qui la
 * rend déterministe, quelle que soit la vitesse d'affichage (x1, x2, x4).
 */
export const TIME = {
  /** Minutes simulées par tick. */
  tickMinutes: 30,
  ticksPerHour: 2,
  ticksPerDay: 48,
  daysPerSprint: 14,
  ticksPerSprint: 14 * 48,
  /** Un sprint commence le lundi à 8h. */
  sprintStartMinute: 8 * 60,
} as const;

/** Taille de la grille du bureau à chaque phase (cases de 1 m). */
export const OFFICE_SIZE: Record<Phase, { width: number; depth: number }> = {
  GARAGE: { width: 8, depth: 6 },
  SEED: { width: 14, depth: 10 },
  SERIES_A: { width: 20, depth: 14 },
  UNICORN: { width: 28, depth: 20 },
  END: { width: 28, depth: 20 },
};

/** Taille maximale de l'équipe par phase. */
export const TEAM_MAX: Record<Phase, number> = {
  GARAGE: 2,
  SEED: 6,
  SERIES_A: 15,
  UNICORN: 30,
  END: 30,
};

/** Profil de base de chaque rôle : stats moyennes, salaire et multiplicateurs. */
export interface RoleProfile {
  stats: { speed: number; quality: number; endurance: number; ego: number };
  /** Salaire mensuel chargé de référence. */
  salary: number;
  speedMultiplier: number;
  qualityMultiplier: number;
  /** Multiplicateur de la dette produite par ses tâches. */
  debtMultiplier: number;
}

export const ROLE_PROFILES: Record<DevRole, RoleProfile> = {
  SENIOR_BEARD: {
    stats: { speed: 5, quality: 7, endurance: 6, ego: 7 },
    salary: 9000,
    speedMultiplier: 1,
    qualityMultiplier: 1.5,
    debtMultiplier: 0.6,
  },
  TEN_X: {
    stats: { speed: 8, quality: 5, endurance: 6, ego: 9 },
    salary: 10000,
    speedMultiplier: 2.2,
    qualityMultiplier: 1,
    debtMultiplier: 2.2,
  },
  INTERN: {
    stats: { speed: 4, quality: 3, endurance: 8, ego: 3 },
    salary: 1800,
    speedMultiplier: 0.8,
    qualityMultiplier: 0.8,
    debtMultiplier: 1.4,
  },
  RUSTACEAN: {
    stats: { speed: 5, quality: 7, endurance: 6, ego: 7 },
    salary: 8500,
    speedMultiplier: 1,
    qualityMultiplier: 1.2,
    debtMultiplier: 0.8,
  },
  DESIGNER: {
    stats: { speed: 5, quality: 7, endurance: 6, ego: 6 },
    salary: 7000,
    speedMultiplier: 0.9,
    qualityMultiplier: 1.1,
    debtMultiplier: 1,
  },
  PRODUCT_OWNER: {
    stats: { speed: 3, quality: 5, endurance: 7, ego: 6 },
    salary: 7500,
    speedMultiplier: 0.5,
    qualityMultiplier: 1,
    debtMultiplier: 1,
  },
  AI_AGENT: {
    stats: { speed: 9, quality: 4, endurance: 10, ego: 1 },
    salary: 4000,
    speedMultiplier: 3,
    qualityMultiplier: 0.9,
    debtMultiplier: 1.5,
  },
  GHOST: {
    stats: { speed: 6, quality: 6, endurance: 7, ego: 4 },
    salary: 7500,
    speedMultiplier: 1,
    qualityMultiplier: 1,
    debtMultiplier: 1,
  },
};

/**
 * Toutes les constantes d'équilibrage. Le script `pnpm balance` simule des milliers
 * de parties : c'est ici qu'on ajuste quand une stratégie est trop forte.
 */
export const BALANCE = {
  start: {
    treasury: GAME.startingTreasury,
    coffee: 80,
    debt: 5,
    stability: 85,
    hype: 30,
    users: 0,
    backlogSize: 8,
    /** Nouvelles tâches ajoutées au backlog à chaque sprint (au moins), et taille maximale. */
    newTasksPerSprint: 5,
    backlogMax: 24,
  },
  work: {
    /** Unités de travail par point de tâche (1 unité = 1 h d'un dev de vitesse 5). */
    unitsPerPoint: 5,
    /** Arrivée et départ du bureau (heures). */
    arrivalHour: 9,
    leaveHour: 19,
    nightOwlShift: 2,
    workaholicExtraHours: 3,
    coffeeEmptyDivider: 3,
    poMeetingPenalty: 0.1,
    poMeetingHours: [10, 11.5, 14, 16],
    debtProductivityDivider: 250,
    xpPerUnit: 1,
    xpPerLevel: 120,
    autoAssign: true,
  },
  energy: {
    drainPerWorkTick: 1.6,
    enduranceSaving: 0.07,
    restPerTick: 3,
    sleepThreshold: 12,
  },
  coffee: {
    consumptionPerWorkTick: 0.35,
    consumptionPerBreak: 2,
    addictMultiplier: 2,
    /** Coût d'un point de café réapprovisionné. */
    pricePerPoint: 4,
  },
  activity: {
    coffeeBreak: 0.05,
    chat: 0.03,
    argue: 0.02,
    yell: 0.015,
    babyfoot: 0.03,
  },
  moral: {
    dailyBase: 0.4,
    debtDivider: 60,
    affinityDivider: 60,
    lowEnergyPenalty: 1.5,
    coffeeEmptyPenalty: 3,
    weekendRecovery: 1.5,
    firePenalty: 8,
    fireAffinityPenalty: 15,
    resignationThreshold: 0,
    startMin: 65,
    startMax: 85,
  },
  relations: {
    chatGain: 4,
    argueLoss: 8,
    dailyDrift: 0.2,
    grumpyMalus: 15,
  },
  economy: {
    /** Revenu mensuel moyen par utilisateur (euros). */
    arpuMonthly: 0.6,
    /** Frais fixes par dev et par mois : matériel, licences, mutuelle, tickets resto. */
    overheadPerDevMonthly: 2500,
    /** Frais fixes mensuels de la phase : loyer, marketing, comptable, avocats... */
    fixedCostsMonthly: {
      GARAGE: 85_000,
      SEED: 120_000,
      SERIES_A: 250_000,
      UNICORN: 600_000,
      END: 0,
    } as Record<Phase, number>,
    /** Frais fixes (serveurs, licences...) par utilisateur et par mois. */
    serverCostPerUserMonthly: 0.12,
    severanceMonths: 1,
  },
  users: {
    /** Utilisateurs apportés par point de feature livrée, selon la phase. */
    perFeaturePoint: { GARAGE: 150, SEED: 600, SERIES_A: 2500, UNICORN: 8000, END: 0 } as Record<
      Phase,
      number
    >,
    /** Croissance organique quotidienne maximale (hype à 100). */
    organicDailyGrowth: 0.008,
    baseDailyChurn: 0.002,
    instabilityDailyChurn: 0.02,
    designerBonus: 0.15,
    hypePerFeaturePoint: 0.5,
    hypePerRefactoPoint: -0.35,
  },
  debt: {
    featurePerPoint: 1.1,
    refactoPerPoint: -2.6,
    bugfixPerPoint: -0.4,
    infraPerPoint: -0.3,
    hallucinationDebt: 3,
  },
  stability: {
    featurePerPoint: -0.35,
    bugfixPerPoint: 2.2,
    infraPerPoint: 1.6,
    dailyDebtErosion: 0.02,
    dailyRecovery: 0.3,
    outageLoss: 15,
    /** Probabilité de panne le vendredi à 17h quand la stabilité est à 0. */
    fridayOutageMax: 0.6,
    /** Probabilité quotidienne de bug grave quand la dette est à 100. */
    debtOutageMax: 0.08,
    outageUserLoss: 0.02,
  },
  hype: {
    dailyDecay: 0.4,
    /** Au-delà de cette valeur, la hype ne monte plus avec les livraisons. */
    softCap: 120,
    poDailyGain: 0.25,
    outageLoss: 4,
  },
  roles: {
    internBreakProdDaily: 0.05,
    aiHallucination: 0.3,
    designerBlock: 0.35,
    designerExtraWork: 0.2,
    rustConvertDaily: 0.08,
    rustRefactoBonus: 1.3,
    rustOtherMalus: 0.9,
    seniorShinyMalus: 0.5,
    shinyFrameworkChance: 0.25,
  },
  recruitment: {
    candidatesPerSprint: 3,
    /** Ratio offre / salaire demandé sous lequel le candidat refuse toujours. */
    minRatio: 0.75,
    /** Ratio au-dessus duquel il accepte toujours. */
    sureRatio: 1.1,
  },
  events: {
    /** Probabilité de tirer une carte à chaque heure ouvrée. */
    drawChancePerWorkHour: 0.03,
    maxPerSprint: 3,
    /** Aggravation des effets négatifs à chaque « On en reparle ». */
    escalation: 0.5,
    /** Mode Hardcore : ticks avant résolution automatique (dernier choix). */
    hardcoreAutoResolveTicks: 4,
  },
  valuation: {
    base: 4_000_000,
    perDev: 400_000,
    perUser: 100,
    arrMultiple: 15,
  },
  fundraising: {
    cooldownSprints: 3,
    rounds: 3,
    /** Part du capital cédée à chaque levée : 15 % de base, plus si l'investisseur est conquis. */
    baseDilution: 0.15,
    dilutionPerInterest: 0.03,
    minDilution: 0.1,
    maxDilution: 0.3,
  },
  phases: {
    unicornValuation: 1_000_000_000,
    ipoMinStability: 50,
    acquisitionChancePerSprint: 0.06,
    /** À la fin des 18 mois, une startup Seed valorisée au-delà de ce seuil est rachetée. */
    seedAcquisitionValuation: 100_000_000,
  },
  history: {
    notificationsKept: 50,
    devLogKept: 20,
  },
} as const;
