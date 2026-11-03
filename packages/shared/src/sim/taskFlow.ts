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
  {
    id: 'https-expired',
    kind: 'URGENT',
    type: 'INFRA',
    size: 1,
    title: ['Le certificat HTTPS a expiré', 'The HTTPS certificate has expired'],
    alert: [
      'Urgent : le navigateur affiche « site dangereux » sur notre page d’accueil.',
      'Urgent: browsers show "dangerous site" on our home page.',
    ],
    deadlineHours: 8,
    weight: 2,
    reward: { stability: 1 },
    penalty: { hype: -3, usersShare: -0.01 },
  },
  {
    id: 'investor-demo',
    kind: 'URGENT',
    type: 'FEATURE',
    size: 2,
    title: ['La démo pour l’investisseur de demain', 'The investor demo for tomorrow'],
    alert: [
      'Urgent : un investisseur passe demain voir « le produit qui marche ».',
      'Urgent: an investor drops by tomorrow to see "the product that works".',
    ],
    deadlineHours: 10,
    weight: 2,
    reward: { hype: 2 },
    penalty: { hype: -3 },
  },
  {
    id: 'viral-load',
    kind: 'URGENT',
    type: 'INFRA',
    size: 3,
    title: ['Tenir la charge : on est viraux', 'Handle the load: we went viral'],
    alert: [
      'Urgent : une influenceuse a parlé de nous, les serveurs fument.',
      'Urgent: an influencer mentioned us and the servers are smoking.',
    ],
    deadlineHours: 12,
    weight: 2,
    reward: { usersShare: 0.01 },
    penalty: { stability: -4, usersShare: -0.02 },
  },
  {
    id: 'email-leak',
    kind: 'URGENT',
    type: 'BUGFIX',
    size: 2,
    title: ['Les emails de tous les clients sont visibles', 'Every customer’s email is visible'],
    alert: [
      'Urgent : la page de profil affiche les emails de tout le monde.',
      'Urgent: the profile page shows everyone’s email address.',
    ],
    deadlineHours: 8,
    weight: 1,
    reward: {},
    penalty: { hype: -5, treasuryMonths: -0.1 },
  },
  {
    id: 'store-rejected',
    kind: 'URGENT',
    type: 'BUGFIX',
    size: 2,
    title: ['L’app est refusée par le store', 'The app was rejected by the store'],
    alert: [
      'Urgent : le store refuse la mise à jour. Le lancement est jeudi.',
      'Urgent: the store rejected the update. Launch is on Thursday.',
    ],
    deadlineHours: 20,
    weight: 2,
    reward: { hype: 1 },
    penalty: { hype: -3, usersShare: -0.01 },
  },
  {
    id: 'dns-down',
    kind: 'URGENT',
    type: 'INFRA',
    size: 1,
    title: ['Le nom de domaine a expiré', 'The domain name has expired'],
    alert: [
      'Urgent : notre nom de domaine a expiré, le site affiche une pub pour des casinos.',
      'Urgent: our domain expired and the site now shows a casino ad.',
    ],
    deadlineHours: 6,
    weight: 2,
    reward: { stability: 1 },
    penalty: { hype: -4, usersShare: -0.01 },
  },
  {
    id: 'api-key-leak',
    kind: 'URGENT',
    type: 'INFRA',
    size: 2,
    title: ['Une clé d’API traîne sur GitHub', 'An API key is sitting on GitHub'],
    alert: [
      'Urgent : une clé d’API de production est publique sur GitHub. La facture grimpe.',
      'Urgent: a production API key is public on GitHub. The bill is climbing.',
    ],
    deadlineHours: 8,
    weight: 2,
    reward: {},
    penalty: { treasuryMonths: -0.12, stability: -2 },
  },
  {
    id: 'press-article',
    kind: 'URGENT',
    type: 'FEATURE',
    size: 2,
    title: ['Finir la feature citée dans la presse', 'Finish the feature quoted in the press'],
    alert: [
      'Urgent : un journaliste a annoncé une feature qui n’existe pas encore. L’article sort après-demain.',
      'Urgent: a journalist announced a feature that does not exist yet. The article comes out in two days.',
    ],
    deadlineHours: 20,
    weight: 2,
    reward: { hype: 3 },
    penalty: { hype: -3 },
  },
  {
    id: 'login-down',
    kind: 'URGENT',
    type: 'BUGFIX',
    size: 1,
    title: ['Plus personne ne peut se connecter', 'Nobody can log in anymore'],
    alert: [
      'Urgent : la page de connexion tourne dans le vide pour tout le monde.',
      'Urgent: the login page spins forever for everyone.',
    ],
    deadlineHours: 6,
    weight: 2,
    reward: { stability: 1 },
    penalty: { usersShare: -0.02, hype: -2 },
  },
  {
    id: 'accessibility-audit',
    kind: 'URGENT',
    type: 'BUGFIX',
    size: 3,
    title: ['Corriger l’audit d’accessibilité', 'Fix the accessibility audit'],
    alert: [
      'Urgent : un grand client exige un site accessible avant de signer, vendredi.',
      'Urgent: a big customer requires an accessible site before signing on Friday.',
    ],
    deadlineHours: 24,
    weight: 1,
    reward: { treasuryMonths: 0.08, hype: 1 },
    penalty: { hype: -2 },
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
  {
    id: 'security-scan',
    kind: 'WEEKLY',
    type: 'INFRA',
    size: 1,
    title: ['Scan de sécurité de la semaine', 'Weekly security scan'],
    weight: 2,
    reward: { stability: 1 },
    penalty: { stability: -2 },
  },
  {
    id: 'retro',
    kind: 'WEEKLY',
    type: 'REFACTO',
    size: 1,
    title: ['Rétro de la semaine (avec post-it)', 'Weekly retro (with sticky notes)'],
    weight: 2,
    reward: { moral: 1 },
    penalty: { moral: -1 },
  },
  {
    id: 'flaky-tests',
    kind: 'WEEKLY',
    type: 'BUGFIX',
    size: 2,
    title: [
      'Réparer les tests qui échouent un jour sur deux',
      'Fix the tests that fail every other day',
    ],
    weight: 2,
    reward: { debt: -1 },
    penalty: { debt: 2 },
  },
  {
    id: 'release-notes',
    kind: 'WEEKLY',
    type: 'REFACTO',
    size: 1,
    title: ['Écrire les notes de version', 'Write the release notes'],
    weight: 2,
    reward: { hype: 1 },
    penalty: { hype: -1 },
  },
  {
    id: 'idle-servers',
    kind: 'WEEKLY',
    type: 'INFRA',
    size: 1,
    title: ['Éteindre les serveurs oubliés', 'Shut down forgotten servers'],
    weight: 2,
    reward: { treasuryMonths: 0.03 },
    penalty: { treasuryMonths: -0.03 },
  },
  {
    id: 'bug-bash',
    kind: 'WEEKLY',
    type: 'BUGFIX',
    size: 2,
    title: ['Chasse aux bugs du vendredi', 'Friday bug hunt'],
    weight: 2,
    reward: { stability: 1 },
    penalty: { debt: 1 },
  },
  {
    id: 'cost-review',
    kind: 'WEEKLY',
    type: 'INFRA',
    size: 1,
    title: ['Relire la facture du cloud', 'Review the cloud bill'],
    weight: 2,
    reward: { treasuryMonths: 0.02 },
    penalty: { treasuryMonths: -0.02 },
  },
  {
    id: 'onboarding-doc',
    kind: 'WEEKLY',
    type: 'REFACTO',
    size: 1,
    title: ['Mettre à jour le guide d’arrivée', 'Update the onboarding guide'],
    weight: 2,
    reward: { moral: 1 },
    penalty: { debt: 1 },
  },
  {
    id: 'error-triage',
    kind: 'WEEKLY',
    type: 'BUGFIX',
    size: 1,
    title: ['Trier les erreurs remontées par la prod', 'Triage the errors reported by prod'],
    weight: 2,
    reward: { stability: 1 },
    penalty: { stability: -2 },
  },
  {
    id: 'access-review',
    kind: 'WEEKLY',
    type: 'INFRA',
    size: 1,
    title: ['Retirer les accès des anciens stagiaires', 'Revoke former interns’ access'],
    weight: 2,
    reward: { stability: 1 },
    penalty: { stability: -2 },
  },
  {
    id: 'perf-check',
    kind: 'WEEKLY',
    type: 'REFACTO',
    size: 2,
    title: ['Chasser la requête la plus lente', 'Hunt down the slowest query'],
    weight: 2,
    reward: { debt: -1 },
    penalty: { debt: 2 },
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
  /**
   * Idées ajoutées au backlog à chaque sprint, par membre de l'équipe qui prend des tâches
   * (l'encadrement ne compte pas) : au moins `BALANCE.start.newTasksPerSprint`.
   */
  ideasPerDev: 3,
  /** Taille max du backlog : au moins `BALANCE.start.backlogMax`, sinon par dev. */
  backlogPerDev: 4,
  /**
   * Réapprovisionnement du « À faire » pendant le sprint. Chaque matin de semaine (9h), le
   * rythme de chaque métier depuis le début du sprint (travail abattu par jour ouvré) est
   * comparé au travail qui reste : s'il manque de quoi tenir jusqu'à la démo, des tâches
   * passent du backlog au « À faire » (ou sont créées). À 14h, un métier dont un dev attend
   * sans tâche est dépanné tout de suite.
   */
  topUp: {
    morningHour: 9,
    middayHour: 14,
    /** Marge : on prévoit 15 % de travail en plus du rythme mesuré. */
    margin: 1.15,
    /** Au plus 2 tâches ajoutées par membre du métier et par passage. */
    maxPerDev: 2,
    /** Au 1er matin, pas encore de rythme : estimation en unités par dev et par jour ouvré. */
    defaultUnitsPerDevDay: 6,
    /** En retard : prévenu une fois par sprint, à partir de ce jour ouvré (6e jour sur 10). */
    behindFromWorkday: 5,
    /** En retard quand le travail restant dépasse 1,5 fois ce que le rythme permet. */
    behindRatio: 1.5,
  },
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
