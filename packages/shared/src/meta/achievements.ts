import { z } from 'zod';
import { LocalizedTextSchema, type LocalizedText } from '../i18n.js';
import type { GameState } from '../sim/state.js';

/**
 * Les succès du jeu. Chaque succès est soit débloqué par une carte d'événement
 * (effet `unlockAchievement`), soit vérifié par la simulation à partir de l'état de la
 * partie (`check`). Comme `check` ne lit que l'état, le serveur retrouve exactement les
 * mêmes succès en rejouant une partie : ils ne peuvent pas être falsifiés.
 */
export interface AchievementDefinition {
  readonly id: string;
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  /** Emoji affiché dans la liste des succès. */
  readonly icon: string;
  /** Condition lue sur l'état ; absente pour les succès débloqués par une carte. */
  readonly check?: (state: GameState) => boolean;
}

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

/** La partie est-elle terminée sans faillite ? */
const survived = (state: GameState) =>
  state.result !== null && state.result.outcome !== 'BANKRUPTCY';

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  // ── Débloqués par des cartes ─────────────────────────────────────────────
  {
    id: 'this-is-fine',
    icon: '🔥',
    title: t('This is fine', 'This is fine'),
    description: t(
      'Ignorer une panne de prod un vendredi à 17h.',
      'Ignore a production outage on a Friday at 5pm.',
    ),
  },
  {
    id: 'duck-lead',
    icon: '🦆',
    title: t('Lead Canard', 'Duck Lead'),
    description: t(
      'Nommer un canard en plastique Lead Developer.',
      'Promote a rubber duck to Lead Developer.',
    ),
  },
  {
    id: 'bobby-tables',
    icon: '💾',
    title: t('Little Bobby Tables', 'Little Bobby Tables'),
    description: t(
      'Perdre la base de prod et accuser des hackers.',
      'Lose the production database and blame hackers.',
    ),
  },
  {
    id: 'zero-meeting',
    icon: '📵',
    title: t('Zéro Réunion', 'Zero Meetings'),
    description: t(
      'Annuler toutes les réunions récurrentes, ou finir une partie sans aucune réunion.',
      'Cancel every recurring meeting, or finish a game without a single meeting.',
    ),
    check: (state) => survived(state) && state.stats.meetings === 0,
  },
  {
    id: 'web3-bro',
    icon: '🪙',
    title: t('Web3 Bro', 'Web3 Bro'),
    description: t('Lancer le token de la startup.', 'Launch the startup token.'),
  },
  {
    id: 'log-scale',
    icon: '📈',
    title: t('Échelle logarithmique', 'Log Scale'),
    description: t(
      'Changer l’échelle du graphique devant le conseil.',
      'Change the chart scale in front of the board.',
    ),
  },
  {
    id: 'office-dog',
    icon: '🐶',
    title: t('Chef de la bonne humeur', 'Chief Happiness Officer'),
    description: t('Accueillir un chien au bureau.', 'Welcome a dog into the office.'),
  },
  // ── Vérifiés par la simulation ───────────────────────────────────────────
  {
    id: 'black-friday',
    icon: '🖤',
    title: t('Vendredi Noir', 'Black Friday'),
    description: t(
      'Casser la prod 10 vendredis de suite.',
      'Break production 10 Fridays in a row.',
    ),
    check: (state) => state.stats.maxFridayOutageStreak >= 10,
  },
  {
    id: 'debt-free-unicorn',
    icon: '🦄',
    title: t('Licorne sans dette', 'Debt-free Unicorn'),
    description: t(
      'Être une licorne avec une dette technique sous 10.',
      'Be a unicorn with technical debt below 10.',
    ),
    check: (state) => state.phase === 'UNICORN' && state.gauges.debt < 10,
  },
  {
    id: 'hello-world',
    icon: '👋',
    title: t('Hello World', 'Hello World'),
    description: t('Livrer sa première feature.', 'Ship your first feature.'),
    check: (state) => state.stats.featuresShipped >= 1,
  },
  {
    id: 'feature-factory',
    icon: '🏭',
    title: t('Usine à features', 'Feature Factory'),
    description: t('Livrer 50 features dans une partie.', 'Ship 50 features in one game.'),
    check: (state) => state.stats.featuresShipped >= 50,
  },
  {
    id: 'clean-coder',
    icon: '🧹',
    title: t('Clean Coder', 'Clean Coder'),
    description: t('Terminer 15 refactos dans une partie.', 'Finish 15 refactors in one game.'),
    check: (state) => state.stats.refactosDone >= 15,
  },
  {
    id: 'first-check',
    icon: '💶',
    title: t('Premier chèque', 'First Check'),
    description: t('Réussir une levée de fonds.', 'Close a funding round.'),
    check: (state) => state.fundingRounds >= 1,
  },
  {
    id: 'unicorn',
    icon: '✨',
    title: t('Licorne', 'Unicorn'),
    description: t('Atteindre 1 milliard de valorisation.', 'Reach a 1 billion valuation.'),
    check: (state) => state.phase === 'UNICORN' || state.result?.phaseReached === 'UNICORN',
  },
  {
    id: 'decacorn',
    icon: '🌌',
    title: t('Décacorne', 'Decacorn'),
    description: t('Dépasser 10 milliards de valorisation.', 'Exceed a 10 billion valuation.'),
    check: (state) => state.stats.maxValuation >= 10_000_000_000,
  },
  {
    id: 'ding-ding',
    icon: '🔔',
    title: t('Ding ding ding', 'Ding Ding Ding'),
    description: t('Entrer en Bourse.', 'Go public.'),
    check: (state) => state.result?.outcome === 'IPO',
  },
  {
    id: 'acquired',
    icon: '🤝',
    title: t('Exit !', 'Exit!'),
    description: t('Se faire racheter.', 'Get acquired.'),
    check: (state) => state.result?.outcome === 'ACQUISITION',
  },
  {
    id: 'bankrupt',
    icon: '💸',
    title: t('On a appris beaucoup de choses', 'We Learned a Lot'),
    description: t('Faire faillite.', 'Go bankrupt.'),
    check: (state) => state.result?.outcome === 'BANKRUPTCY',
  },
  {
    id: 'zombie',
    icon: '🧟',
    title: t('Startup zombie', 'Zombie Startup'),
    description: t('Survivre 18 mois sans croissance.', 'Survive 18 months without growing.'),
    check: (state) => state.result?.outcome === 'ZOMBIE',
  },
  {
    id: 'founder-control',
    icon: '👑',
    title: t('Seul maître à bord', 'Still in Charge'),
    description: t(
      'Entrer en Bourse en gardant plus de 50 % du capital.',
      'Go public while keeping more than 50% of the shares.',
    ),
    check: (state) => state.result?.outcome === 'IPO' && state.result.ownership > 0.5,
  },
  {
    id: 'burnout-factory',
    icon: '🥵',
    title: t('Culture de la performance', 'Performance Culture'),
    description: t(
      '7 devs font un burn-out dans la même partie.',
      '7 devs burn out in the same game.',
    ),
    check: (state) => state.stats.burnouts >= 7,
  },
  {
    id: 'big-team',
    icon: '🏢',
    title: t('On est une famille', 'We Are a Family'),
    description: t('Avoir 30 personnes dans l’équipe.', 'Have 30 people on the team.'),
    check: (state) => state.stats.maxTeamSize >= 30,
  },
  {
    id: 'restructuring',
    icon: '📦',
    title: t('Plan de restructuration', 'Restructuring Plan'),
    description: t('Licencier 5 devs dans une partie.', 'Fire 5 devs in one game.'),
    check: (state) => state.stats.fired >= 5,
  },
  {
    id: 'hallucination-nation',
    icon: '🤖',
    title: t('Ça compile dans ma tête', 'It Compiles in My Head'),
    description: t('L’IA Agent hallucine 10 features.', 'The AI Agent hallucinates 10 features.'),
    check: (state) => state.stats.hallucinations >= 10,
  },
  {
    id: 'decaf',
    icon: '☕',
    title: t('Décaféiné', 'Decaf'),
    description: t(
      'Passer 5 jours sans café dans une partie.',
      'Spend 5 days without coffee in one game.',
    ),
    check: (state) => state.stats.coffeeShortageDays >= 5,
  },
  {
    id: 'million-users',
    icon: '🌍',
    title: t('Un million d’utilisateurs', 'A Million Users'),
    description: t('Atteindre 1 million d’utilisateurs.', 'Reach one million users.'),
    check: (state) => state.stats.maxUsers >= 1_000_000,
  },
  {
    id: 'crisis-manager',
    icon: '🧯',
    title: t('Gestionnaire de crise', 'Crisis Manager'),
    description: t(
      'Résoudre 40 cartes d’événements dans une partie.',
      'Resolve 40 event cards in one game.',
    ),
    check: (state) => state.stats.cardsResolved >= 40,
  },
  {
    id: 'interior-designer',
    icon: '🪴',
    title: t('Architecte d’intérieur', 'Interior Designer'),
    description: t('Avoir 25 objets dans le bureau.', 'Have 25 items in the office.'),
    check: (state) => Object.keys(state.components.furniture).length >= 25,
  },
  {
    id: 'intern-army',
    icon: '🎒',
    title: t('Armée de stagiaires', 'Intern Army'),
    description: t(
      'Finir une partie « Stagiaires Only » sans faire faillite.',
      'Finish an "Interns Only" game without going bankrupt.',
    ),
    check: (state) => state.mode === 'INTERNS_ONLY' && survived(state),
  },
  {
    id: 'no-pause',
    icon: '⏩',
    title: t('Pas de pause', 'No Pause'),
    description: t(
      'Finir une partie Hardcore sans faire faillite.',
      'Finish a Hardcore game without going bankrupt.',
    ),
    check: (state) => state.mode === 'HARDCORE' && survived(state),
  },
  {
    id: 'ship-it',
    icon: '🚀',
    title: t('Ship it!', 'Ship it!'),
    description: t(
      'Réussir le défi « Cette app doit sortir en 3 sprints ».',
      'Win the "Ship this app in 3 sprints" challenge.',
    ),
    check: (state) => state.mode === 'SHIP_IN_3' && state.result?.outcome === 'ACQUISITION',
  },
  {
    id: 'daily-player',
    icon: '📅',
    title: t('Rituel du matin', 'Morning Ritual'),
    description: t('Terminer une partie Daily.', 'Finish a Daily game.'),
    check: (state) => state.mode === 'DAILY' && state.result !== null,
  },
];

export const ACHIEVEMENT_IDS: readonly string[] = ACHIEVEMENTS.map((a) => a.id);

const byId = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]));

export function getAchievement(id: string): AchievementDefinition | undefined {
  return byId.get(id);
}

/** Succès tel qu'exposé par l'API (sans la fonction de vérification). */
export const AchievementDtoSchema = z.object({
  id: z.string(),
  title: LocalizedTextSchema,
  description: LocalizedTextSchema,
  icon: z.string(),
  /** Date de déblocage pour le joueur connecté, sinon null. */
  unlockedAt: z.iso.datetime().nullable(),
});
export type AchievementDto = z.infer<typeof AchievementDtoSchema>;

export const AchievementsResponseSchema = z.object({ achievements: z.array(AchievementDtoSchema) });
export type AchievementsResponse = z.infer<typeof AchievementsResponseSchema>;

export const UnlockAchievementsBodySchema = z.object({
  ids: z.array(z.string().max(64)).min(1).max(ACHIEVEMENTS.length),
});
export type UnlockAchievementsBody = z.infer<typeof UnlockAchievementsBodySchema>;

export const UnlockAchievementsResponseSchema = z.object({ unlocked: z.array(z.string()) });
export type UnlockAchievementsResponse = z.infer<typeof UnlockAchievementsResponseSchema>;
