import { z } from 'zod';
import { LocalizedTextSchema, type LocalizedText } from '../i18n.js';
import type { DevRole } from '../sim/components.js';
import type { FurnitureId } from '../sim/furniture.js';
import type { GameState } from '../sim/state.js';

/** Difficulté d'un succès, de « dès la première partie » à « défi de speedrunner ». */
export const ACHIEVEMENT_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'LEGENDARY'] as const;
export const AchievementDifficultySchema = z.enum(ACHIEVEMENT_DIFFICULTIES);
export type AchievementDifficulty = z.infer<typeof AchievementDifficultySchema>;

/**
 * Les succès du jeu. Chaque succès est soit débloqué par une carte d'événement
 * (effet `unlockAchievement`), soit vérifié par la simulation à partir de l'état de la
 * partie (`check`). Comme `check` ne lit que l'état, le serveur retrouve exactement les
 * mêmes succès en rejouant une partie : ils ne peuvent pas être falsifiés.
 *
 * Un succès `secret` s'affiche « ??? » (titre et condition) tant qu'il n'est pas débloqué.
 */
export interface AchievementDefinition {
  readonly id: string;
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  /** Emoji affiché dans la liste des succès. */
  readonly icon: string;
  readonly difficulty: AchievementDifficulty;
  /** Caché (« ??? ») tant que le joueur ne l'a pas débloqué. */
  readonly secret?: boolean;
  /** Condition lue sur l'état ; absente pour les succès débloqués par une carte. */
  readonly check?: (state: GameState) => boolean;
}

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

/** La partie est-elle terminée sans faillite ? */
const survived = (state: GameState) =>
  state.result !== null && state.result.outcome !== 'BANKRUPTCY';

/** Nombre de devs d'un profil donné dans l'équipe actuelle. */
const countRole = (state: GameState, role: DevRole) =>
  Object.values(state.components.identity).filter((identity) => identity.role === role).length;

/** Le bureau contient-il cet objet ? */
const owns = (state: GameState, itemId: FurnitureId) =>
  Object.values(state.components.furniture).some((item) => item.itemId === itemId);

/** Deux collègues ont-ils tous les deux une affinité qui vérifie `test` l'un envers l'autre ? */
const mutualRelation = (state: GameState, test: (affinity: number) => boolean) =>
  Object.entries(state.components.relations).some(([id, relations]) =>
    Object.entries(relations).some(
      ([otherId, affinity]) =>
        test(affinity) && test(state.components.relations[otherId]?.[id] ?? 0),
    ),
  );

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  // ── Débloqués par des cartes ─────────────────────────────────────────────
  {
    id: 'this-is-fine',
    difficulty: 'EASY',
    secret: true,
    icon: '🔥',
    title: t('This is fine', 'This is fine'),
    description: t(
      'Ignorer une panne de prod un vendredi à 17h.',
      'Ignore a production outage on a Friday at 5pm.',
    ),
  },
  {
    id: 'duck-lead',
    difficulty: 'EASY',
    secret: true,
    icon: '🦆',
    title: t('Lead Canard', 'Duck Lead'),
    description: t(
      'Nommer un canard en plastique Lead Developer.',
      'Promote a rubber duck to Lead Developer.',
    ),
  },
  {
    id: 'bobby-tables',
    difficulty: 'MEDIUM',
    secret: true,
    icon: '💾',
    title: t('Little Bobby Tables', 'Little Bobby Tables'),
    description: t(
      'Perdre la base de prod et accuser des hackers.',
      'Lose the production database and blame hackers.',
    ),
  },
  {
    id: 'zero-meeting',
    difficulty: 'MEDIUM',
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
    difficulty: 'EASY',
    secret: true,
    icon: '🪙',
    title: t('Web3 Bro', 'Web3 Bro'),
    description: t('Lancer le token de la startup.', 'Launch the startup token.'),
  },
  {
    id: 'log-scale',
    difficulty: 'EASY',
    secret: true,
    icon: '📈',
    title: t('Échelle logarithmique', 'Log Scale'),
    description: t(
      'Changer l’échelle du graphique devant le conseil.',
      'Change the chart scale in front of the board.',
    ),
  },
  {
    id: 'office-dog',
    difficulty: 'EASY',
    secret: true,
    icon: '🐶',
    title: t('Chef de la bonne humeur', 'Chief Happiness Officer'),
    description: t('Accueillir un chien au bureau.', 'Welcome a dog into the office.'),
  },
  // ── Vérifiés par la simulation ───────────────────────────────────────────
  {
    id: 'black-friday',
    difficulty: 'LEGENDARY',
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
    difficulty: 'HARD',
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
    difficulty: 'EASY',
    icon: '👋',
    title: t('Hello World', 'Hello World'),
    description: t('Livrer sa première feature.', 'Ship your first feature.'),
    check: (state) => state.stats.featuresShipped >= 1,
  },
  {
    id: 'feature-factory',
    difficulty: 'MEDIUM',
    icon: '🏭',
    title: t('Usine à features', 'Feature Factory'),
    description: t('Livrer 50 features dans une partie.', 'Ship 50 features in one game.'),
    check: (state) => state.stats.featuresShipped >= 50,
  },
  {
    id: 'clean-coder',
    difficulty: 'MEDIUM',
    icon: '🧹',
    title: t('Clean Coder', 'Clean Coder'),
    description: t('Terminer 15 refactos dans une partie.', 'Finish 15 refactors in one game.'),
    check: (state) => state.stats.refactosDone >= 15,
  },
  {
    id: 'first-check',
    difficulty: 'EASY',
    icon: '💶',
    title: t('Premier chèque', 'First Check'),
    description: t('Réussir une levée de fonds.', 'Close a funding round.'),
    check: (state) => state.fundingRounds >= 1,
  },
  {
    id: 'unicorn',
    difficulty: 'HARD',
    icon: '✨',
    title: t('Licorne', 'Unicorn'),
    description: t('Atteindre 1 milliard de valorisation.', 'Reach a 1 billion valuation.'),
    check: (state) => state.phase === 'UNICORN' || state.result?.phaseReached === 'UNICORN',
  },
  {
    id: 'decacorn',
    difficulty: 'LEGENDARY',
    icon: '🌌',
    title: t('Décacorne', 'Decacorn'),
    description: t('Dépasser 10 milliards de valorisation.', 'Exceed a 10 billion valuation.'),
    check: (state) => state.stats.maxValuation >= 10_000_000_000,
  },
  {
    id: 'ding-ding',
    difficulty: 'HARD',
    icon: '🔔',
    title: t('Ding ding ding', 'Ding Ding Ding'),
    description: t('Entrer en Bourse.', 'Go public.'),
    check: (state) => state.result?.outcome === 'IPO',
  },
  {
    id: 'acquired',
    difficulty: 'MEDIUM',
    icon: '🤝',
    title: t('Exit !', 'Exit!'),
    description: t('Se faire racheter.', 'Get acquired.'),
    check: (state) => state.result?.outcome === 'ACQUISITION',
  },
  {
    id: 'bankrupt',
    difficulty: 'EASY',
    icon: '💸',
    title: t('On a appris beaucoup de choses', 'We Learned a Lot'),
    description: t('Faire faillite.', 'Go bankrupt.'),
    check: (state) => state.result?.outcome === 'BANKRUPTCY',
  },
  {
    id: 'zombie',
    difficulty: 'MEDIUM',
    icon: '🧟',
    title: t('Startup zombie', 'Zombie Startup'),
    description: t('Survivre 18 mois sans croissance.', 'Survive 18 months without growing.'),
    check: (state) => state.result?.outcome === 'ZOMBIE',
  },
  {
    id: 'founder-control',
    difficulty: 'LEGENDARY',
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
    difficulty: 'HARD',
    secret: true,
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
    difficulty: 'HARD',
    icon: '🏢',
    title: t('On est une famille', 'We Are a Family'),
    description: t('Avoir 30 personnes dans l’équipe.', 'Have 30 people on the team.'),
    check: (state) => state.stats.maxTeamSize >= 30,
  },
  {
    id: 'restructuring',
    difficulty: 'MEDIUM',
    icon: '📦',
    title: t('Plan de restructuration', 'Restructuring Plan'),
    description: t('Licencier 5 devs dans une partie.', 'Fire 5 devs in one game.'),
    check: (state) => state.stats.fired >= 5,
  },
  {
    id: 'hallucination-nation',
    difficulty: 'MEDIUM',
    icon: '🤖',
    title: t('Ça compile dans ma tête', 'It Compiles in My Head'),
    description: t('L’IA Agent hallucine 10 features.', 'The AI Agent hallucinates 10 features.'),
    check: (state) => state.stats.hallucinations >= 10,
  },
  {
    id: 'decaf',
    difficulty: 'MEDIUM',
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
    difficulty: 'HARD',
    icon: '🌍',
    title: t('Un million d’utilisateurs', 'A Million Users'),
    description: t('Atteindre 1 million d’utilisateurs.', 'Reach one million users.'),
    check: (state) => state.stats.maxUsers >= 1_000_000,
  },
  {
    id: 'crisis-manager',
    difficulty: 'MEDIUM',
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
    difficulty: 'MEDIUM',
    icon: '🪴',
    title: t('Architecte d’intérieur', 'Interior Designer'),
    description: t('Avoir 25 objets dans le bureau.', 'Have 25 items in the office.'),
    check: (state) => Object.keys(state.components.furniture).length >= 25,
  },
  {
    id: 'intern-army',
    difficulty: 'HARD',
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
    difficulty: 'HARD',
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
    difficulty: 'HARD',
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
    difficulty: 'EASY',
    icon: '📅',
    title: t('Rituel du matin', 'Morning Ritual'),
    description: t('Terminer une partie Daily.', 'Finish a Daily game.'),
    check: (state) => state.mode === 'DAILY' && state.result !== null,
  },
  {
    id: 'career-first-star',
    difficulty: 'EASY',
    icon: '🧭',
    title: t('Sur les traces des géants', 'In the Footsteps of Giants'),
    description: t(
      'Finir une partie Carrière avec au moins une étoile.',
      'Finish a Career game with at least one star.',
    ),
    check: (state) => (state.result?.career?.stars ?? 0) >= 1,
  },
  {
    id: 'career-legend',
    difficulty: 'LEGENDARY',
    icon: '🏛️',
    title: t('Légende égalée', 'Legend Matched'),
    description: t(
      'Tenir tous les jalons d’une légende du mode Carrière (trois étoiles).',
      'Meet every milestone of a Career legend (three stars).',
    ),
    check: (state) => state.result?.career?.stars === 3,
  },
  // ── Ajoutés avec l'écran Succès : plus ou moins faciles, certains secrets ─
  {
    id: 'first-hire',
    icon: '🧑‍💼',
    difficulty: 'EASY',
    title: t('Premier salarié', 'First Hire'),
    description: t('Recruter un candidat.', 'Hire a candidate.'),
    check: (state) => state.stats.hired >= 2,
  },
  {
    id: 'first-sprint',
    icon: '🏁',
    difficulty: 'EASY',
    title: t('Daily stand-up', 'Daily Stand-up'),
    description: t('Terminer son premier sprint.', 'Finish your first sprint.'),
    check: (state) => state.history.sprints.length >= 1,
  },
  {
    id: 'first-users',
    icon: '🙋',
    difficulty: 'EASY',
    title: t('Product-market fit (presque)', 'Product-Market Fit (Almost)'),
    description: t('Atteindre 1 000 utilisateurs.', 'Reach 1,000 users.'),
    check: (state) => state.stats.maxUsers >= 1_000,
  },
  {
    id: 'babyfoot',
    icon: '⚽',
    difficulty: 'EASY',
    title: t('Startup nation', 'Startup Nation'),
    description: t('Installer un babyfoot au bureau.', 'Put a foosball table in the office.'),
    check: (state) => owns(state, 'babyfoot'),
  },
  {
    id: 'barista',
    icon: '🥐',
    difficulty: 'EASY',
    title: t('Barista', 'Barista'),
    description: t('Acheter une machine à expresso premium.', 'Buy a premium espresso machine.'),
    check: (state) => owns(state, 'espresso-machine'),
  },
  {
    id: 'bug-squasher',
    icon: '🐛',
    difficulty: 'MEDIUM',
    title: t('Sprint de nettoyage', 'Cleanup Sprint'),
    description: t('Corriger 5 bugs dans le même sprint.', 'Fix 5 bugs in the same sprint.'),
    check: (state) =>
      Object.values(state.components.task).filter(
        (task) => task.type === 'BUGFIX' && task.doneAtSprint === state.sprint,
      ).length >= 5,
  },
  {
    id: 'series-a',
    icon: '🌱',
    difficulty: 'MEDIUM',
    title: t('Série A', 'Series A'),
    description: t('Réussir deux levées de fonds.', 'Close two funding rounds.'),
    check: (state) => state.fundingRounds >= 2,
  },
  {
    id: 'hype-train',
    icon: '🚂',
    difficulty: 'HARD',
    title: t('Hype train', 'Hype Train'),
    description: t('Faire monter la hype à 90.', 'Push hype up to 90.'),
    check: (state) => state.gauges.hype >= 90,
  },
  {
    id: 'homegrown',
    icon: '🎓',
    difficulty: 'MEDIUM',
    title: t('Formé à la maison', 'Homegrown Talent'),
    description: t('Faire monter un dev au niveau 5.', 'Get a dev to level 5.'),
    check: (state) =>
      Object.values(state.components.employment).some((employment) => employment.level >= 5),
  },
  {
    id: 'scale-up',
    icon: '📊',
    difficulty: 'MEDIUM',
    title: t('Ça scale !', 'It Scales!'),
    description: t('Avoir 15 personnes dans l’équipe.', 'Have 15 people on the team.'),
    check: (state) => state.stats.maxTeamSize >= 15,
  },
  {
    id: 'war-chest',
    icon: '💰',
    difficulty: 'MEDIUM',
    title: t('Trésor de guerre', 'War Chest'),
    description: t('Avoir 6 M€ en banque.', 'Have €6M in the bank.'),
    check: (state) => state.gauges.treasury >= 6_000_000,
  },
  {
    id: 'great-place',
    icon: '😊',
    difficulty: 'MEDIUM',
    title: t('Great Place to Work', 'Great Place to Work'),
    description: t(
      'Avoir au moins 5 devs, tous avec un moral de 85 ou plus.',
      'Have at least 5 devs, all with morale of 85 or more.',
    ),
    check: (state) => {
      const moods = Object.values(state.components.mood);
      return moods.length >= 5 && moods.every((mood) => mood.moral >= 85);
    },
  },
  {
    id: 'kind-boss',
    icon: '🕊️',
    difficulty: 'MEDIUM',
    title: t('Patron bienveillant', 'Kind Boss'),
    description: t(
      'Finir une partie sans licenciement ni démission.',
      'Finish a game with no one fired and no one quitting.',
    ),
    check: (state) => survived(state) && state.stats.fired === 0 && state.stats.resignations === 0,
  },
  {
    id: 'speedrun',
    icon: '⏱️',
    difficulty: 'LEGENDARY',
    title: t('Speedrun any %', 'Speedrun Any%'),
    description: t('Devenir une licorne avant le sprint 25.', 'Become a unicorn before sprint 25.'),
    check: (state) => state.phase === 'UNICORN' && state.sprint < 25,
  },
  {
    id: 'gotta-catch',
    icon: '🃏',
    difficulty: 'LEGENDARY',
    title: t('Attrapez-les tous', 'Gotta Hire ’Em All'),
    description: t(
      'Avoir les 8 profils de dev en même temps dans l’équipe.',
      'Have all 8 dev profiles on the team at the same time.',
    ),
    check: (state) =>
      new Set(Object.values(state.components.identity).map((i) => i.role)).size >= 8,
  },
  // ── Secrets ─────────────────────────────────────────────────────────────
  {
    id: 'skynet',
    icon: '🦾',
    difficulty: 'MEDIUM',
    secret: true,
    title: t('Skynet', 'Skynet'),
    description: t('Avoir 3 IA Agents en même temps.', 'Have 3 AI Agents at the same time.'),
    check: (state) => countRole(state, 'AI_AGENT') >= 3,
  },
  {
    id: 'beard-council',
    icon: '🧔',
    difficulty: 'MEDIUM',
    secret: true,
    title: t('Conseil des sages', 'Council of Beards'),
    description: t(
      'Avoir 3 Seniors Barbus en même temps.',
      'Have 3 Bearded Seniors at the same time.',
    ),
    check: (state) => countRole(state, 'SENIOR_BEARD') >= 3,
  },
  {
    id: 'rust-cult',
    icon: '🦀',
    difficulty: 'EASY',
    secret: true,
    title: t('Fearless concurrency', 'Fearless Concurrency'),
    description: t(
      'Le Rustacé convertit 3 collègues à Rust.',
      'The Rustacean converts 3 colleagues to Rust.',
    ),
    check: (state) => Object.keys(state.components.rustConverted).length >= 3,
  },
  {
    id: 'friday-deploy',
    icon: '🍻',
    difficulty: 'EASY',
    secret: true,
    title: t('On ne déploie pas le vendredi', 'Never Deploy on Friday'),
    description: t('Voir la prod tomber un vendredi.', 'Watch production go down on a Friday.'),
    check: (state) => state.stats.fridayOutages >= 1,
  },
  {
    id: 'office-romance',
    icon: '💘',
    difficulty: 'EASY',
    secret: true,
    title: t('Pair programming', 'Pair Programming'),
    description: t(
      'Deux collègues deviennent inséparables (affinité de 100 l’un envers l’autre).',
      'Two colleagues become inseparable (100 affinity with each other).',
    ),
    check: (state) => mutualRelation(state, (affinity) => affinity >= 100),
  },
  {
    id: 'cold-war',
    icon: '🥶',
    difficulty: 'MEDIUM',
    secret: true,
    title: t('Guerre froide', 'Cold War'),
    description: t(
      'Deux collègues tombent à -60 d’affinité l’un envers l’autre.',
      'Two colleagues drop to -60 affinity with each other.',
    ),
    check: (state) => mutualRelation(state, (affinity) => affinity <= -60),
  },
  {
    id: 'sovereign-debt',
    icon: '🏚️',
    difficulty: 'MEDIUM',
    secret: true,
    title: t('Dette souveraine', 'Sovereign Debt'),
    description: t('Laisser la dette technique atteindre 95.', 'Let technical debt reach 95.'),
    check: (state) => state.gauges.debt >= 95,
  },
  {
    id: 'revolving-door',
    icon: '🚪',
    difficulty: 'HARD',
    secret: true,
    title: t('Porte tournante', 'Revolving Door'),
    description: t('10 démissions dans une partie.', '10 resignations in one game.'),
    check: (state) => state.stats.resignations >= 10,
  },
  {
    id: 'garage-bankrupt',
    icon: '🏠',
    difficulty: 'MEDIUM',
    secret: true,
    title: t('Retour chez papa-maman', 'Back to Mom’s Basement'),
    description: t(
      'Faire faillite sans jamais quitter le garage.',
      'Go bankrupt without ever leaving the garage.',
    ),
    check: (state) =>
      state.result?.outcome === 'BANKRUPTCY' && state.result.phaseReached === 'GARAGE',
  },
  {
    id: 'close-call',
    icon: '😅',
    difficulty: 'HARD',
    secret: true,
    title: t('Sur le fil', 'Close Call'),
    description: t(
      'Finir une partie sans faire faillite avec moins de 100 000 € en banque.',
      'Finish a game without going bankrupt with less than €100,000 in the bank.',
    ),
    check: (state) => survived(state) && state.gauges.treasury < 100_000,
  },
  {
    id: 'yolo',
    icon: '🤘',
    difficulty: 'HARD',
    secret: true,
    title: t('YOLO Driven Development', 'YOLO Driven Development'),
    description: t(
      'Finir une partie de 18 mois sans faillite et sans aucune refacto.',
      'Finish an 18-month game without going bankrupt and without a single refactor.',
    ),
    check: (state) => survived(state) && state.totalSprints > 3 && state.stats.refactosDone === 0,
  },
  {
    id: 'lone-wolf',
    icon: '🐺',
    difficulty: 'LEGENDARY',
    secret: true,
    title: t('Loup solitaire', 'Lone Wolf'),
    description: t(
      'Finir une partie de 18 mois sans faillite sans jamais dépasser 2 personnes.',
      'Finish an 18-month game without going bankrupt and never more than 2 people.',
    ),
    check: (state) => survived(state) && state.totalSprints > 3 && state.stats.maxTeamSize <= 2,
  },
  {
    id: 'google-campus',
    icon: '🛝',
    difficulty: 'HARD',
    secret: true,
    title: t('Campus Google', 'Google Campus'),
    description: t(
      'Avoir un toboggan, un sieste-pod et une table de cantine.',
      'Own a slide, a nap pod and a canteen table.',
    ),
    check: (state) =>
      owns(state, 'slide') && owns(state, 'nap-pod') && owns(state, 'canteen-table'),
  },
  {
    id: 'ghost-company',
    icon: '👻',
    difficulty: 'LEGENDARY',
    secret: true,
    title: t('Société fantôme', 'Shell Company'),
    description: t(
      'Avoir au moins 3 devs, tous Devs Fantômes.',
      'Have at least 3 devs, all of them Ghost Devs.',
    ),
    check: (state) => {
      const team = Object.values(state.components.identity);
      return team.length >= 3 && team.every((identity) => identity.role === 'GHOST');
    },
  },
  // ── Filiales ──────────────────────────────────────────────────────────────
  {
    id: 'business-angel',
    difficulty: 'EASY',
    title: t('Business Angel', 'Business Angel'),
    description: t(
      'Créer une filiale avec l’argent de ta startup.',
      'Found a subsidiary with your startup’s money.',
    ),
    icon: '👼',
    check: (state) => state.ventures.length >= 1,
  },
  {
    id: 'holding',
    difficulty: 'HARD',
    title: t('Holding', 'Holding Company'),
    description: t(
      'Avoir trois filiales en vie en même temps.',
      'Have three subsidiaries alive at the same time.',
    ),
    icon: '🏛️',
    check: (state) => state.ventures.filter((v) => v.status === 'ACTIVE').length >= 3,
  },
  {
    id: 'golden-exit',
    difficulty: 'MEDIUM',
    title: t('Exit en or', 'Golden Exit'),
    description: t(
      'Revendre tes parts d’une filiale au moins cinq fois ta mise.',
      'Sell your stake in a subsidiary for at least five times what you put in.',
    ),
    icon: '🪙',
    check: (state) => state.ventures.some((v) => v.soldFor !== null && v.soldFor >= v.invested * 5),
  },
  {
    id: 'money-pit',
    difficulty: 'MEDIUM',
    secret: true,
    title: t('Gouffre financier', 'Money Pit'),
    description: t('Voir deux filiales couler.', 'Watch two subsidiaries go under.'),
    icon: '🕳️',
    check: (state) => state.ventures.filter((v) => v.status === 'DEAD').length >= 2,
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
  difficulty: AchievementDifficultySchema,
  /** Succès caché : l'interface affiche « ??? » tant qu'il n'est pas débloqué. */
  secret: z.boolean(),
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
