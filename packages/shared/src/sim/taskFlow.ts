import { z } from 'zod';
import type { LocalizedText } from '../i18n.js';
import type { TaskType } from './components.js';

/**
 * Tâches dynamiques : le Kanban vit pendant le sprint.
 * - le backlog grandit avec l'équipe ;
 * - des tâches urgentes tombent (prod cassée, faille de sécurité, gros client...) avec un délai ;
 * - chaque lundi, des tâches hebdomadaires sont à finir avant vendredi 18h ;
 * - certains sprints ont un objectif, récompensé selon sa difficulté.
 *
 * Le hasard de ces tâches est tiré sur une graine à part (graine de la partie + clé + instant),
 * comme pour les filiales : le générateur principal de la partie n'est jamais consommé ici.
 */

/** Tâche spéciale : urgente (délai court) ou hebdomadaire (avant vendredi 18h). */
export const TASK_KINDS = ['URGENT', 'WEEKLY'] as const;
export const TaskKindSchema = z.enum(TASK_KINDS);
export type TaskKind = z.infer<typeof TaskKindSchema>;

/**
 * Effet d'une tâche spéciale réussie ou ratée. `usersShare` est une part des utilisateurs
 * (0,03 = 3 %) ; `treasuryMonths` se compte en mois de dépenses courantes.
 */
export interface TaskFlowEffects {
  readonly hype?: number;
  readonly debt?: number;
  readonly stability?: number;
  readonly moral?: number;
  readonly usersShare?: number;
  readonly treasuryMonths?: number;
}

export interface SpecialTaskTemplate {
  readonly id: string;
  readonly kind: TaskKind;
  readonly type: TaskType;
  readonly size: number;
  readonly title: readonly [string, string];
  /** Message affiché quand la tâche urgente apparaît. */
  readonly alert?: readonly [string, string];
  /** Délai d'une tâche urgente, en heures ouvrées (lundi-vendredi, 9h-19h). */
  readonly deadlineHours?: number;
  /** Poids au tirage (0 : jamais tirée au hasard, seulement déclenchée). */
  readonly weight: number;
  readonly reward: TaskFlowEffects;
  readonly penalty: TaskFlowEffects;
}

/** Identifiant de la tâche urgente créée quand la prod tombe. */
export const PROD_FIX_TEMPLATE = 'prod-fix';

export const URGENT_TEMPLATES: readonly SpecialTaskTemplate[] = [
  {
    id: PROD_FIX_TEMPLATE,
    kind: 'URGENT',
    type: 'BUGFIX',
    size: 2,
    title: ['Réparer la prod', 'Fix prod'],
    alert: [
      'Urgent : la prod est cassée, il faut la réparer avant demain.',
      'Urgent: prod is broken, it must be fixed by tomorrow.',
    ],
    deadlineHours: 10,
    weight: 0,
    reward: { stability: 2 },
    penalty: { stability: -6, hype: -3, usersShare: -0.02 },
  },
  {
    id: 'security-patch',
    kind: 'URGENT',
    type: 'INFRA',
    size: 3,
    title: ['Patcher la faille de sécurité du jour', 'Patch the security hole of the day'],
    alert: [
      'Urgent : une faille critique touche notre framework. Patch exigé sous 2 jours.',
      'Urgent: a critical vulnerability hits our framework. Patch due within 2 days.',
    ],
    deadlineHours: 20,
    weight: 3,
    reward: { stability: 1 },
    penalty: { hype: -5, usersShare: -0.03 },
  },
  {
    id: 'big-client',
    kind: 'URGENT',
    type: 'FEATURE',
    size: 3,
    title: [
      '« Juste un petit bouton » pour le gros client',
      '"Just a small button" for the big client',
    ],
    alert: [
      'Urgent : le plus gros client veut « juste un petit bouton » pour sa démo de jeudi.',
      'Urgent: our biggest client wants "just a small button" for their Thursday demo.',
    ],
    deadlineHours: 20,
    weight: 3,
    reward: { treasuryMonths: 0.1 },
    penalty: { hype: -3 },
  },
  {
    id: 'payment-bug',
    kind: 'URGENT',
    type: 'BUGFIX',
    size: 1,
    title: ['Le paiement ne marche plus en Belgique', 'Payments are broken in Belgium'],
    alert: [
      'Urgent : plus personne ne peut payer en Belgique. Chaque heure coûte cher.',
      'Urgent: nobody in Belgium can pay anymore. Every hour costs money.',
    ],
    deadlineHours: 6,
    weight: 3,
    reward: {},
    penalty: { treasuryMonths: -0.1, usersShare: -0.01 },
  },
  {
    id: 'gdpr-request',
    kind: 'URGENT',
    type: 'INFRA',
    size: 2,
    title: [
      'Demande RGPD : tout supprimer, partout',
      'GDPR request: delete everything, everywhere',
    ],
    alert: [
      'Urgent : un utilisateur exerce son droit à l’oubli. L’avocat dit « vite ».',
      'Urgent: a user wants to be forgotten. The lawyer says "fast".',
    ],
    deadlineHours: 16,
    weight: 2,
    reward: {},
    penalty: { treasuryMonths: -0.15 },
  },
  {
    id: 'demo-crash',
    kind: 'URGENT',
    type: 'BUGFIX',
    size: 2,
    title: ['La démo plante sur le Wi-Fi du salon', 'The demo crashes on the trade show Wi-Fi'],
    alert: [
      'Urgent : la démo du salon plante dès qu’on clique. Le stand ouvre demain.',
      'Urgent: the trade show demo crashes on the first click. The booth opens tomorrow.',
    ],
    deadlineHours: 10,
    weight: 2,
    reward: { hype: 1 },
    penalty: { hype: -4 },
  },
];

export const WEEKLY_TEMPLATES: readonly SpecialTaskTemplate[] = [
  {
    id: 'deps-update',
    kind: 'WEEKLY',
    type: 'INFRA',
    size: 2,
    title: ['Mise à jour hebdo des dépendances', 'Weekly dependency update'],
    weight: 3,
    reward: { debt: -1 },
    penalty: { debt: 3 },
  },
  {
    id: 'code-review',
    kind: 'WEEKLY',
    type: 'REFACTO',
    size: 2,
    title: ['Revue de code de la semaine', 'Weekly code review'],
    weight: 3,
    reward: { moral: 1 },
    penalty: { debt: 2 },
  },
  {
    id: 'support-triage',
    kind: 'WEEKLY',
    type: 'BUGFIX',
    size: 1,
    title: ['Trier les tickets du support', 'Triage the support tickets'],
    weight: 3,
    reward: { stability: 1 },
    penalty: { usersShare: -0.01 },
  },
  {
    id: 'backup-check',
    kind: 'WEEKLY',
    type: 'INFRA',
    size: 1,
    title: ['Vérifier que les sauvegardes se restaurent', 'Check that backups actually restore'],
    weight: 2,
    reward: { stability: 1 },
    penalty: { stability: -3 },
  },
  {
    id: 'kpi-dashboard',
    kind: 'WEEKLY',
    type: 'INFRA',
    size: 1,
    title: [
      'Graphiques qui montent pour les investisseurs',
      'Up-and-to-the-right charts for investors',
    ],
    weight: 2,
    reward: { hype: 1 },
    penalty: { hype: -2 },
  },
  {
    id: 'docs-update',
    kind: 'WEEKLY',
    type: 'REFACTO',
    size: 1,
    title: ['Mettre à jour le README (de 2023)', 'Update the README (from 2023)'],
    weight: 2,
    reward: { moral: 1 },
    penalty: { debt: 1 },
  },
];

const ALL_TEMPLATES = [...URGENT_TEMPLATES, ...WEEKLY_TEMPLATES];

export function getTaskTemplate(id: string | undefined): SpecialTaskTemplate | undefined {
  return id === undefined ? undefined : ALL_TEMPLATES.find((template) => template.id === id);
}

/** Objectifs de sprint possibles. */
export const OBJECTIVE_KINDS = [
  /** Livrer au moins `target` features (hors hallucinations). */
  'SHIP_FEATURES',
  /** Terminer au moins `target` tâches, tous types confondus. */
  'CLOSE_TASKS',
  /** Aucune panne de prod pendant le sprint. */
  'ZERO_INCIDENT',
  /** Faire baisser la dette d'au moins `target` points. */
  'REDUCE_DEBT',
  /** Gagner au moins `target` utilisateurs (net) pendant le sprint. */
  'GAIN_USERS',
] as const;
export const ObjectiveKindSchema = z.enum(OBJECTIVE_KINDS);
export type ObjectiveKind = z.infer<typeof ObjectiveKindSchema>;

export const OBJECTIVE_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
export const ObjectiveDifficultySchema = z.enum(OBJECTIVE_DIFFICULTIES);
export type ObjectiveDifficulty = z.infer<typeof ObjectiveDifficultySchema>;

export const ObjectiveRewardSchema = z.object({
  treasury: z.number().nonnegative(),
  hype: z.number().nonnegative(),
  moral: z.number().nonnegative(),
});
export type ObjectiveReward = z.infer<typeof ObjectiveRewardSchema>;

export const SprintObjectiveSchema = z.object({
  kind: ObjectiveKindSchema,
  difficulty: ObjectiveDifficultySchema,
  target: z.number().nonnegative(),
  /** Valeur de départ (dette au début du sprint pour REDUCE_DEBT, sinon 0). */
  baseline: z.number(),
  sprint: z.number().int(),
  reward: ObjectiveRewardSchema,
  /** ACTIVE pendant le sprint, puis réussi ou raté à la démo. */
  status: z.enum(['ACTIVE', 'SUCCESS', 'FAILED']),
  /** Valeur atteinte à la démo (null tant que le sprint n'est pas fini). */
  value: z.number().nullable(),
});
export type SprintObjective = z.infer<typeof SprintObjectiveSchema>;

/** Constantes d'équilibrage des tâches dynamiques (ajustées avec `pnpm balance`). */
export const TASK_FLOW = {
  /** Idées ajoutées au backlog à chaque sprint : au moins `BALANCE.start.newTasksPerSprint`. */
  ideasPerDev: 2,
  /** Taille max du backlog : au moins `BALANCE.start.backlogMax`, sinon par dev. */
  backlogPerDev: 2.5,
  /** Chance d'une tâche urgente au hasard à 10h un jour ouvré : base + par dev, plafonnée. */
  urgentBaseChance: 0.02,
  urgentChancePerDev: 0.005,
  urgentMaxChance: 0.08,
  /** Pas de tâche urgente au hasard au premier sprint (tutoriel). */
  urgentFromSprint: 2,
  /** Tâches hebdomadaires : 1, plus 1 tous les `weeklyPerDevs` devs, au plus `weeklyMax`. */
  weeklyPerDevs: 6,
  weeklyMax: 3,
  /** Les tâches hebdo arrivent le lundi à 9h et sont dues le vendredi à 18h. */
  weeklyDueHour: 18,
  /** Chance qu'un sprint ait un objectif (à partir du sprint 2). */
  objectiveChance: 0.4,
  objectiveFromSprint: 2,
  /** Récompenses : mois de dépenses, hype et moral, selon la difficulté. */
  rewards: {
    EASY: { treasuryMonths: 0.1, hype: 1, moral: 0 },
    MEDIUM: { treasuryMonths: 0.25, hype: 2, moral: 2 },
    HARD: { treasuryMonths: 0.5, hype: 4, moral: 4 },
  },
} as const;

/** Titre bilingue d'un modèle de tâche spéciale. */
export function templateTitle(template: SpecialTaskTemplate): LocalizedText {
  return { fr: template.title[0], en: template.title[1] };
}
