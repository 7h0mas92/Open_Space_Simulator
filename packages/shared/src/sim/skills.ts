import { z } from 'zod';
import type { GameMode } from '../game.js';
import type { LocalizedText } from '../i18n.js';
import type { DevRole } from './components.js';

/**
 * Arbre de compétences des devs.
 *
 * Chaque niveau gagné (le système d'XP existe déjà) donne 1 point de compétence. Le joueur le
 * dépense dans la fiche du dev, onglet « Compétences » : 3 branches de 5 nœuds, chaque nœud
 * demande le précédent de sa branche. Un dev gagne environ 8 niveaux sur une partie complète :
 * il ne peut pas tout prendre, il faut spécialiser l'équipe.
 *
 * Chaque profil qui code ajoute un **nœud de métier** au bout d'une branche (il demande le 3e
 * nœud de cette branche). L'encadrement (scrum master, managers, directeurs) ne code pas, ne
 * gagne pas d'XP et n'a donc pas d'arbre.
 *
 * On peut aussi acheter de l'expérience (livre, formation, conférence) et réinitialiser l'arbre
 * d'un dev contre un mois de son salaire.
 *
 * Aucun tirage au sort : les bonus passent par les systèmes existants (travail, fatigue, moral,
 * réunions, pannes). Une partie où l'on ne touche pas à l'arbre reste identique au bit près
 * (replays, Daily, sauvegardes). L'arbre est fermé en Daily, pour garder des parties
 * comparables au classement du jour.
 */

export const SKILL_BRANCHES = ['TECH', 'SPEED', 'HUMAN'] as const;
export const SkillBranchSchema = z.enum(SKILL_BRANCHES);
export type SkillBranch = z.infer<typeof SkillBranchSchema>;

/** Les 15 nœuds communs, dans l'ordre de chaque branche. */
export const COMMON_SKILL_IDS = [
  // 🛠️ Technique
  'clean-code',
  'debugger',
  'architect',
  'code-review',
  'prod-guardian',
  // ⚡ Vitesse
  'shortcuts',
  'focus',
  'deep-work',
  'sprint-finish',
  'crunch',
  // 🤝 Humain
  'stamina',
  'diplomat',
  'mentor',
  'good-mood',
  'leader',
] as const;

/** Les nœuds de métier, un par profil qui code. */
export const ROLE_SKILL_IDS = [
  'wise-elder',
  'commented-code',
  'hands-off-main',
  'successful-rewrite',
  'pixel-perfect',
  'efficient-meetings',
  'fewer-hallucinations',
  'always-online',
  'versatile',
  'chief-architect',
  'infra-as-code',
  'test-automation',
] as const;

export const SKILL_IDS = [...COMMON_SKILL_IDS, ...ROLE_SKILL_IDS] as const;
export const SkillIdSchema = z.enum(SKILL_IDS);
export type SkillId = z.infer<typeof SkillIdSchema>;

export interface SkillNode {
  readonly id: SkillId;
  readonly branch: SkillBranch;
  readonly icon: string;
  readonly name: LocalizedText;
  /** Effet, en une phrase, tel qu'il est affiché dans la fiche. */
  readonly effect: LocalizedText;
  /** Nœud à prendre avant celui-ci (null : premier de sa branche). */
  readonly requires: SkillId | null;
  /** Nœud de métier : seul ce profil peut le prendre. */
  readonly role?: DevRole;
  /** Pouvoir à déclencher (le Crunch), pas un bonus permanent. */
  readonly active?: boolean;
}

/** Réglages chiffrés de l'arbre : tous les effets sont ici, faciles à équilibrer. */
export const SKILLS = {
  /** Points gagnés par niveau. */
  pointsPerLevel: 1,
  // Technique
  cleanCodeDebt: 0.9,
  debuggerBugfix: 1.25,
  architectRefacto: 1.25,
  /** Dette des features de toute l'équipe, par relecteur (2 relecteurs au plus). */
  codeReviewDebt: 0.95,
  codeReviewMax: 2,
  prodGuardianFix: 2,
  // Vitesse
  shortcutsSpeed: 1.05,
  /** Malus des réunions du Product Owner pour ce dev (0,5 : divisé par 2). */
  focusMeeting: 0.5,
  /** Le matin, avant le déjeuner, l'open space est calme. */
  deepWorkSpeed: 1.1,
  deepWorkUntilHour: 12,
  sprintFinishSpeed: 1.15,
  /** Dernier jour ouvré du sprint (vendredi de la 2e semaine, jour 11 sur 0 à 13). */
  sprintFinishDay: 11,
  crunchSpeed: 1.5,
  /** Durée du Crunch, en ticks de 30 min (24 h). */
  crunchTicks: 48,
  crunchMoral: -10,
  // Humain
  staminaFatigue: 0.85,
  diplomatConflict: 0.5,
  /** XP des collègues d'un mentor (non cumulable). */
  mentorXp: 1.2,
  /** Moral gagné chaque jour par toute l'équipe, par dev de bonne humeur (3 au plus). */
  goodMoodDaily: 0.3,
  goodMoodMax: 3,
  // Métiers
  commentedCodeDebt: 0.5,
  handsOffMainOdds: 0.02,
  successfulRewriteRefacto: 1.2,
  pixelPerfectBlock: 0.5,
  efficientMeetings: 0.5,
  fewerHallucinationsOdds: 0.15,
  alwaysOnlineQuality: 1.1,
  /** Côté de la stack qui n'est pas le sien : multiplicateur au moins égal à ceci. */
  versatileCrossStack: 0.85,
  chiefArchitectDebt: 0.9,
  infraAsCodeInfra: 1.25,
  testAutomationDebt: 0.95,
} as const;

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

export const SKILL_TREE: readonly SkillNode[] = [
  // ─── 🛠️ Technique ────────────────────────────────────────────────────────
  {
    id: 'clean-code',
    branch: 'TECH',
    icon: '🧼',
    name: t('Code propre', 'Clean code'),
    effect: t('-10 % de dette sur son code.', '-10% debt on their code.'),
    requires: null,
  },
  {
    id: 'debugger',
    branch: 'TECH',
    icon: '🐛',
    name: t('Débogueur', 'Debugger'),
    effect: t('+25 % de vitesse sur les bugfix.', '+25% speed on bugfixes.'),
    requires: 'clean-code',
  },
  {
    id: 'architect',
    branch: 'TECH',
    icon: '📐',
    name: t('Architecte', 'Architect'),
    effect: t('+25 % de vitesse sur les refactos.', '+25% speed on refactors.'),
    requires: 'debugger',
  },
  {
    id: 'code-review',
    branch: 'TECH',
    icon: '🔍',
    name: t('Revue de code', 'Code review'),
    effect: t(
      '-5 % de dette sur les features de toute l’équipe (2 relecteurs au plus).',
      '-5% debt on the whole team’s features (2 reviewers at most).',
    ),
    requires: 'architect',
  },
  {
    id: 'prod-guardian',
    branch: 'TECH',
    icon: '🛡️',
    name: t('Gardien de la prod', 'Prod guardian'),
    effect: t('Répare les pannes 2 fois plus vite.', 'Fixes outages twice as fast.'),
    requires: 'code-review',
  },
  // ─── ⚡ Vitesse ──────────────────────────────────────────────────────────
  {
    id: 'shortcuts',
    branch: 'SPEED',
    icon: '⌨️',
    name: t('Raccourcis clavier', 'Keyboard shortcuts'),
    effect: t('+5 % de vitesse.', '+5% speed.'),
    requires: null,
  },
  {
    id: 'focus',
    branch: 'SPEED',
    icon: '🎧',
    name: t('Concentration', 'Focus'),
    effect: t(
      'Malus des réunions du Product Owner divisé par 2.',
      'Product Owner meeting penalty halved.',
    ),
    requires: 'shortcuts',
  },
  {
    id: 'deep-work',
    branch: 'SPEED',
    icon: '🌅',
    name: t('Deep work', 'Deep work'),
    effect: t(
      '+10 % de vitesse le matin, quand l’open space est calme.',
      '+10% speed in the morning, while the office is quiet.',
    ),
    requires: 'focus',
  },
  {
    id: 'sprint-finish',
    branch: 'SPEED',
    icon: '🏁',
    name: t('Fin de sprint', 'Sprint finish'),
    effect: t('+15 % de vitesse le dernier jour du sprint.', '+15% speed on the last sprint day.'),
    requires: 'deep-work',
  },
  {
    id: 'crunch',
    branch: 'SPEED',
    icon: '🔥',
    name: t('Crunch', 'Crunch'),
    effect: t(
      'Pouvoir : +50 % de vitesse pendant 24 h, -10 de moral, une fois par sprint.',
      'Power: +50% speed for 24 h, -10 morale, once per sprint.',
    ),
    requires: 'sprint-finish',
    active: true,
  },
  // ─── 🤝 Humain ───────────────────────────────────────────────────────────
  {
    id: 'stamina',
    branch: 'HUMAN',
    icon: '🫀',
    name: t('Endurance', 'Stamina'),
    effect: t('-15 % de fatigue.', '-15% fatigue.'),
    requires: null,
  },
  {
    id: 'diplomat',
    branch: 'HUMAN',
    icon: '🕊️',
    name: t('Diplomate', 'Diplomat'),
    effect: t('Ses disputes font 2 fois moins de dégâts.', 'Their arguments do half the damage.'),
    requires: 'stamina',
  },
  {
    id: 'mentor',
    branch: 'HUMAN',
    icon: '🧑‍🏫',
    name: t('Mentor', 'Mentor'),
    effect: t(
      '+20 % d’XP pour ses collègues (non cumulable).',
      '+20% XP for their teammates (does not stack).',
    ),
    requires: 'diplomat',
  },
  {
    id: 'good-mood',
    branch: 'HUMAN',
    icon: '😄',
    name: t('Bonne humeur', 'Good mood'),
    effect: t(
      '+0,3 de moral par jour pour toute l’équipe (3 devs au plus).',
      '+0.3 morale per day for the whole team (3 devs at most).',
    ),
    requires: 'mentor',
  },
  {
    id: 'leader',
    branch: 'HUMAN',
    icon: '👑',
    name: t('Leader', 'Leader'),
    effect: t(
      'Tant qu’il est là, personne ne démissionne pour un moral à 0.',
      'While they are around, nobody quits over zero morale.',
    ),
    requires: 'good-mood',
  },
  // ─── Nœuds de métier ─────────────────────────────────────────────────────
  {
    id: 'wise-elder',
    branch: 'TECH',
    icon: '🧙',
    name: t('Vieux sage', 'Wise elder'),
    effect: t(
      'Accepte enfin les frameworks récents : plus de malus.',
      'Finally accepts recent frameworks: no more penalty.',
    ),
    requires: 'architect',
    role: 'SENIOR_BEARD',
  },
  {
    id: 'commented-code',
    branch: 'TECH',
    icon: '💬',
    name: t('Code commenté', 'Commented code'),
    effect: t(
      'Son code devient lisible : 2 fois moins de dette.',
      'Their code becomes readable: half the debt.',
    ),
    requires: 'architect',
    role: 'TEN_X',
  },
  {
    id: 'hands-off-main',
    branch: 'TECH',
    icon: '🙅',
    name: t('Ne touche plus à main', 'Hands off main'),
    effect: t(
      'Casse la prod 2 % des jours au lieu de 5 %.',
      'Breaks prod on 2% of days instead of 5%.',
    ),
    requires: 'architect',
    role: 'INTERN',
  },
  {
    id: 'successful-rewrite',
    branch: 'TECH',
    icon: '🦀',
    name: t('Réécriture réussie', 'Successful rewrite'),
    effect: t(
      'Ses refactos effacent 20 % de dette en plus.',
      'Their refactors clear 20% more debt.',
    ),
    requires: 'architect',
    role: 'RUSTACEAN',
  },
  {
    id: 'pixel-perfect',
    branch: 'HUMAN',
    icon: '📏',
    name: t('Pixel perfect', 'Pixel perfect'),
    effect: t(
      'Le padding est juste du premier coup : 2 fois moins de releases bloquées.',
      'Padding is right the first time: half as many blocked releases.',
    ),
    requires: 'mentor',
    role: 'DESIGNER',
  },
  {
    id: 'efficient-meetings',
    branch: 'HUMAN',
    icon: '⏱️',
    name: t('Réunions efficaces', 'Efficient meetings'),
    effect: t(
      'Ses réunions coûtent 2 fois moins de productivité à l’équipe.',
      'Their meetings cost the team half as much productivity.',
    ),
    requires: 'mentor',
    role: 'PRODUCT_OWNER',
  },
  {
    id: 'fewer-hallucinations',
    branch: 'TECH',
    icon: '🤖',
    name: t('Moins d’hallucinations', 'Fewer hallucinations'),
    effect: t(
      'Hallucine 15 % des features au lieu de 30 %.',
      'Hallucinates 15% of features, not 30%.',
    ),
    requires: 'architect',
    role: 'AI_AGENT',
  },
  {
    id: 'always-online',
    branch: 'SPEED',
    icon: '👻',
    name: t('Toujours connecté', 'Always online'),
    effect: t('+10 % de qualité.', '+10% quality.'),
    requires: 'deep-work',
    role: 'GHOST',
  },
  {
    id: 'versatile',
    branch: 'SPEED',
    icon: '🔀',
    name: t('Polyvalent', 'Versatile'),
    effect: t(
      'Moins perdu de l’autre côté de la stack (85 % au lieu de 60 %).',
      'Less lost on the other side of the stack (85% instead of 60%).',
    ),
    requires: 'deep-work',
  },
  {
    id: 'chief-architect',
    branch: 'TECH',
    icon: '🏛️',
    name: t('Architecte en chef', 'Chief architect'),
    effect: t(
      '-10 % de dette sur les features de toute l’équipe.',
      '-10% debt on the whole team’s features.',
    ),
    requires: 'architect',
    role: 'TECH_LEAD',
  },
  {
    id: 'infra-as-code',
    branch: 'TECH',
    icon: '🧰',
    name: t('Infra as code', 'Infra as code'),
    effect: t('+25 % de vitesse sur les tâches d’infra.', '+25% speed on infra tasks.'),
    requires: 'architect',
    role: 'DEVOPS',
  },
  {
    id: 'test-automation',
    branch: 'TECH',
    icon: '🧪',
    name: t('Tests automatisés', 'Test automation'),
    effect: t(
      '-5 % de dette sur les features de toute l’équipe.',
      '-5% debt on the whole team’s features.',
    ),
    requires: 'architect',
    role: 'QA_TESTER',
  },
];

/** Le nœud « Polyvalent » est commun aux trois profils front, back et fullstack. */
const VERSATILE_ROLES: readonly DevRole[] = ['FRONTEND', 'BACKEND', 'FULLSTACK'];

export function skillNode(id: SkillId): SkillNode {
  const node = SKILL_TREE.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`Compétence inconnue : ${id}`);
  return node;
}

/** Le nœud de métier d'un profil (null : pas de nœud de métier, encadrement compris). */
export function roleSkillOf(role: DevRole): SkillNode | null {
  if (VERSATILE_ROLES.includes(role)) return skillNode('versatile');
  return SKILL_TREE.find((node) => node.role === role) ?? null;
}

/** Nœuds d'une branche pour un profil : les 5 nœuds communs, puis son nœud de métier. */
export function branchNodes(branch: SkillBranch, role: DevRole): SkillNode[] {
  const common = SKILL_TREE.filter((node) => node.branch === branch && !isRoleSkill(node.id));
  const own = roleSkillOf(role);
  return own && own.branch === branch ? [...common, own] : common;
}

export function isRoleSkill(id: SkillId): boolean {
  return (ROLE_SKILL_IDS as readonly string[]).includes(id);
}

/** Ce profil peut-il prendre ce nœud ? (nœuds communs : tous ; nœud de métier : le sien) */
export function canHaveSkill(role: DevRole, id: SkillId): boolean {
  return !isRoleSkill(id) || roleSkillOf(role)?.id === id;
}

/** L'arbre est ouvert dans tous les modes, sauf le Daily (parties comparables au classement). */
export function skillsEnabled(mode: GameMode): boolean {
  return mode !== 'DAILY';
}

/** Points gagnés par un dev d'un niveau donné. */
export function skillPointsForLevel(level: number): number {
  return Math.max(0, level - 1) * SKILLS.pointsPerLevel;
}

/** Formations : de l'expérience contre de l'argent, une par dev et par sprint, en planification. */
export const TRAINING_KINDS = ['BOOK', 'COURSE', 'CONFERENCE'] as const;
export const TrainingKindSchema = z.enum(TRAINING_KINDS);
export type TrainingKind = z.infer<typeof TrainingKindSchema>;

export interface Training {
  readonly kind: TrainingKind;
  readonly icon: string;
  readonly name: LocalizedText;
  readonly effect: LocalizedText;
  readonly price: number;
  /** Part d'un niveau d'XP gagnée (1 = un niveau entier). */
  readonly levels: number;
  readonly moral: number;
  readonly hype: number;
}

export const TRAININGS: readonly Training[] = [
  {
    kind: 'BOOK',
    icon: '📘',
    name: t('Livre technique', 'Tech book'),
    effect: t('+50 % d’un niveau d’XP.', '+50% of a level’s XP.'),
    price: 500,
    levels: 0.5,
    moral: 0,
    hype: 0,
  },
  {
    kind: 'COURSE',
    icon: '🎓',
    name: t('Formation de 3 jours', '3-day course'),
    effect: t('+1 niveau.', '+1 level.'),
    price: 2_000,
    levels: 1,
    moral: 0,
    hype: 0,
  },
  {
    kind: 'CONFERENCE',
    icon: '🎤',
    name: t('Conférence', 'Conference'),
    effect: t('+1 niveau, +10 de moral, +1 de hype.', '+1 level, +10 morale, +1 hype.'),
    price: 5_000,
    levels: 1,
    moral: 10,
    hype: 1,
  },
];

export function trainingOf(kind: TrainingKind): Training {
  const training = TRAININGS.find((candidate) => candidate.kind === kind);
  if (!training) throw new Error(`Formation inconnue : ${kind}`);
  return training;
}

/** Réinitialiser l'arbre d'un dev coûte ce nombre de mois de son salaire. */
export const SKILL_RESET_SALARY_MONTHS = 1;

/** Compétences d'un dev (composant ECS, absent tant qu'il n'a rien appris ni suivi). */
export const DevSkillsSchema = z.object({
  /** Nœuds appris, dans l'ordre d'achat. */
  learned: z.array(SkillIdSchema),
  /** Sprint de la dernière formation (une par sprint). */
  trainedSprint: z.number().int().optional(),
  /** Sprint du dernier Crunch (une fois par sprint). */
  crunchSprint: z.number().int().optional(),
  /** Le Crunch dure jusqu'à ce tick (exclu). */
  crunchUntilTick: z.number().int().optional(),
});
export type DevSkills = z.infer<typeof DevSkillsSchema>;
