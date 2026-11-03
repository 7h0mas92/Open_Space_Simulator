import { z } from 'zod';
import type { Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';
import type { DevRole } from '../sim/components.js';
import type { GaugeName, GameStats } from '../sim/state.js';
import type { RivalId } from '../sim/rivals.js';
import type { StoryRewardId } from './rewards.js';

/**
 * Le mode Histoire : une campagne de 10 missions en 4 chapitres, du garage à l'entrée en Bourse.
 *
 * Chaque mission est une partie normale (même simulation, mêmes cartes, mêmes systèmes) avec un
 * point de départ (phase, trésorerie, équipe), une durée en sprints, des objectifs et parfois une
 * contrainte. Elle est gagnée dès que tous les objectifs sont remplis en même temps, et perdue
 * si une contrainte est enfreinte, si la startup fait faillite ou si le temps est écoulé.
 * Une mission réussie débloque la suivante et une récompense pour les autres modes.
 *
 * Tout est déclaratif : la simulation (`client/src/simulation/story.ts`) évalue ces objectifs
 * sur l'état de la partie, sans aucun tirage aléatoire de plus.
 */

/** Statistiques de partie qu'une mission peut viser. */
export type StoryStat = keyof Pick<
  GameStats,
  | 'featuresShipped'
  | 'prodOutages'
  | 'coffeeShortageDays'
  | 'meetingsUseful'
  | 'urgentDone'
  | 'urgentMissed'
  | 'resignations'
  | 'hired'
>;

/** Un objectif (ou une contrainte) de mission, évalué à chaque instant sur l'état de la partie. */
export type MissionGoal =
  /** Atteindre au moins cette phase. */
  | { readonly kind: 'phase'; readonly atLeast: Phase }
  /** Une jauge dans un intervalle (bornes incluses). */
  | {
      readonly kind: 'gauge';
      readonly gauge: GaugeName;
      readonly min?: number;
      readonly max?: number;
    }
  /** Une statistique de la partie dans un intervalle (bornes incluses). */
  | {
      readonly kind: 'stat';
      readonly stat: StoryStat;
      readonly min?: number;
      readonly max?: number;
    }
  /** Au moins ce nombre de personnes dans l'équipe. */
  | { readonly kind: 'team'; readonly min: number }
  /** Moral moyen de l'équipe d'au moins cette valeur. */
  | { readonly kind: 'moral'; readonly min: number }
  /** Valorisation d'au moins ce montant, en euros. */
  | { readonly kind: 'valuation'; readonly min: number }
  /** Une salle des serveurs qui tourne (serveur, réseau et froid). */
  | { readonly kind: 'serverRoom' }
  /** Une salle de réunion aménagée. */
  | { readonly kind: 'meetingRoom' }
  /** Au moins ce nombre de chats heureux (équipement complet). */
  | { readonly kind: 'pets'; readonly min: number }
  /** Au moins ce nombre de sprints terminés depuis le début de la mission. */
  | { readonly kind: 'sprints'; readonly min: number }
  /** Histoire en actes : au moins autant d'utilisateurs que ce rival (ou le rival disparu). */
  | { readonly kind: 'rivalUsers'; readonly rival: RivalId }
  /** Histoire en actes : part du marché (joueur et rivaux en jeu) d'au moins cette valeur (0 à 1). */
  | { readonly kind: 'marketShare'; readonly min: number };

export type MissionGoalKind = MissionGoal['kind'];

/** Point de départ d'une mission (le reste est celui d'une nouvelle partie). */
export interface MissionSetup {
  readonly phase: Phase;
  /** Levées déjà faites (1 en Seed, 2 en Série A…), pour la suite des tours de table. */
  readonly fundingRounds: number;
  readonly treasury: number;
  readonly users: number;
  readonly hype?: number;
  readonly debt?: number;
  readonly stability?: number;
  /** Part du capital encore détenue par le fondateur. */
  readonly ownership: number;
  /** Profils recrutés en plus du premier dev du garage. */
  readonly team: readonly DevRole[];
}

export interface StoryMission {
  readonly id: StoryMissionId;
  readonly chapter: StoryChapterId;
  readonly icon: string;
  readonly title: LocalizedText;
  /** Le briefing, raconté par le cofondateur. */
  readonly brief: LocalizedText;
  /** Un conseil pour réussir. */
  readonly tip: LocalizedText;
  readonly setup: MissionSetup;
  /** Durée de la mission, en sprints. */
  readonly sprints: number;
  readonly goals: readonly MissionGoal[];
  /** Contraintes à respecter pendant toute la mission (sinon, elle est perdue). */
  readonly constraints: readonly MissionGoal[];
  readonly reward: StoryRewardId;
}

export const STORY_CHAPTER_IDS = ['garage', 'seed', 'series-a', 'unicorn'] as const;
export type StoryChapterId = (typeof STORY_CHAPTER_IDS)[number];

export interface StoryChapter {
  readonly id: StoryChapterId;
  readonly number: number;
  readonly icon: string;
  readonly title: LocalizedText;
  readonly intro: LocalizedText;
  /** Titre de fondateur gagné en finissant le chapitre (affiché dans l'écran Histoire). */
  readonly founderTitle: LocalizedText;
}

export const STORY_MISSION_IDS = [
  'first-commit',
  'coffee-first',
  'leave-garage',
  'useful-meeting',
  'server-room',
  'office-cats',
  'clean-series-a',
  'firefighters',
  'debt-free-unicorn',
  'opening-bell',
] as const;
export const StoryMissionIdSchema = z.enum(STORY_MISSION_IDS);
export type StoryMissionId = z.infer<typeof StoryMissionIdSchema>;

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

export const STORY_CHAPTERS: readonly StoryChapter[] = [
  {
    id: 'garage',
    number: 1,
    icon: '🏚️',
    title: t('Le garage', 'The garage'),
    intro: t(
      'Deux bureaux IKEA, un ramen froid et une idée « qui va tout changer ». Tout commence ici.',
      'Two IKEA desks, a cold ramen and an idea “that will change everything”. It all starts here.',
    ),
    founderTitle: t('Fondateur de garage', 'Garage founder'),
  },
  {
    id: 'seed',
    number: 2,
    icon: '🌱',
    title: t('La Seed', 'The Seed'),
    intro: t(
      'Premier vrai bureau, premiers process, premières réunions de trop. Il faut grandir sans casser.',
      'First real office, first processes, first meetings too many. Grow without breaking things.',
    ),
    founderTitle: t('Bâtisseur d’équipe', 'Team builder'),
  },
  {
    id: 'series-a',
    number: 3,
    icon: '🚀',
    title: t('La Série A', 'Series A'),
    intro: t(
      'Les investisseurs regardent la dette, les clients regardent la prod. Toi, tu regardes les deux.',
      'Investors watch the debt, customers watch prod. You watch both.',
    ),
    founderTitle: t('Pompier en chef', 'Chief firefighter'),
  },
  {
    id: 'unicorn',
    number: 4,
    icon: '🦄',
    title: t('La Licorne', 'The Unicorn'),
    intro: t(
      'Un milliard sur le papier. Reste à le prouver, et à sonner la cloche.',
      'A billion on paper. Now prove it, and ring the bell.',
    ),
    founderTitle: t('Légende de la tech', 'Tech legend'),
  },
];

const GARAGE_START: MissionSetup = {
  phase: 'GARAGE',
  fundingRounds: 0,
  treasury: 2_000_000,
  users: 0,
  ownership: 1,
  team: [],
};

const SEED_START: MissionSetup = {
  phase: 'SEED',
  fundingRounds: 1,
  treasury: 3_500_000,
  users: 6_000,
  hype: 45,
  debt: 20,
  stability: 75,
  ownership: 0.82,
  team: ['FULLSTACK', 'INTERN', 'DESIGNER'],
};

const SERIES_A_START: MissionSetup = {
  phase: 'SERIES_A',
  fundingRounds: 2,
  treasury: 9_000_000,
  users: 60_000,
  hype: 55,
  debt: 30,
  stability: 70,
  ownership: 0.64,
  team: ['FULLSTACK', 'FRONTEND', 'BACKEND', 'DEVOPS', 'INTERN', 'DESIGNER', 'PRODUCT_OWNER'],
};

/** Fin de Série A : la startup approche du milliard (mission « Licorne sans dette »). */
const LATE_SERIES_A_START: MissionSetup = {
  phase: 'SERIES_A',
  fundingRounds: 2,
  treasury: 16_000_000,
  users: 1_500_000,
  hype: 60,
  debt: 35,
  stability: 70,
  ownership: 0.6,
  team: [
    'FULLSTACK',
    'FRONTEND',
    'BACKEND',
    'BACKEND',
    'DEVOPS',
    'TECH_LEAD',
    'QA_TESTER',
    'INTERN',
    'DESIGNER',
    'PRODUCT_OWNER',
  ],
};

const UNICORN_START: MissionSetup = {
  phase: 'UNICORN',
  fundingRounds: 3,
  treasury: 40_000_000,
  users: 3_100_000,
  hype: 65,
  debt: 30,
  stability: 70,
  ownership: 0.48,
  team: [
    'FULLSTACK',
    'FRONTEND',
    'BACKEND',
    'BACKEND',
    'DEVOPS',
    'TECH_LEAD',
    'QA_TESTER',
    'INTERN',
    'DESIGNER',
    'PRODUCT_OWNER',
    'AI_AGENT',
  ],
};

export const STORY_MISSIONS: readonly StoryMission[] = [
  {
    id: 'first-commit',
    chapter: 'garage',
    icon: '⌨️',
    title: t('Premier commit', 'First commit'),
    brief: t(
      'On a levé 2 M€ sur une slide et demie. Les investisseurs veulent voir que ça code : livre 3 features avant la fin du 3e sprint.',
      'We raised €2M on a slide and a half. The investors want to see code: ship 3 features before the end of sprint 3.',
    ),
    tip: t(
      'Glisse les features en « À faire » à chaque planification et recrute un 2e dev.',
      'Drag features to “To do” at every planning and hire a second dev.',
    ),
    setup: GARAGE_START,
    sprints: 3,
    goals: [{ kind: 'stat', stat: 'featuresShipped', min: 3 }],
    constraints: [],
    reward: 'wall-blueprint',
  },
  {
    id: 'coffee-first',
    chapter: 'garage',
    icon: '☕',
    title: t('Le café d’abord', 'Coffee first'),
    brief: t(
      'Le dernier stagiaire est parti le jour où la cafetière est tombée en panne. Tiens 4 sprints à deux sans jamais manquer de café.',
      'The last intern left the day the coffee maker broke. Last 4 sprints as a team of two without ever running out of coffee.',
    ),
    tip: t(
      'Le café se recharge chaque matin : une 2e machine ou une meilleure cafetière évitent la panne sèche.',
      'Coffee restocks every morning: a second machine or a better one prevents running dry.',
    ),
    setup: GARAGE_START,
    sprints: 4,
    goals: [
      { kind: 'team', min: 2 },
      { kind: 'sprints', min: 4 },
    ],
    constraints: [{ kind: 'stat', stat: 'coffeeShortageDays', max: 0 }],
    reward: 'perk-espresso',
  },
  {
    id: 'leave-garage',
    chapter: 'garage',
    icon: '📦',
    title: t('Sortir du garage', 'Leave the garage'),
    brief: t(
      'Mes parents veulent récupérer leur garage. Lève ta Seed avant la fin du 6e sprint, qu’on ait enfin un vrai bureau.',
      'My parents want their garage back. Close your Seed round before the end of sprint 6 so we finally get a real office.',
    ),
    tip: t(
      'Les investisseurs aiment la hype et les utilisateurs : livre des features, puis ouvre « Lever des fonds ».',
      'Investors love hype and users: ship features, then open “Raise funds”.',
    ),
    setup: GARAGE_START,
    sprints: 6,
    goals: [{ kind: 'phase', atLeast: 'SEED' }],
    constraints: [],
    reward: 'color-gold',
  },
  {
    id: 'useful-meeting',
    chapter: 'seed',
    icon: '🗓️',
    title: t('La réunion utile', 'The useful meeting'),
    brief: t(
      'On dit qu’une réunion utile, ça n’existe pas. Prouve le contraire : aménage la salle de réunion et tiens 14 réunions utiles en 4 sprints.',
      'They say a useful meeting doesn’t exist. Prove them wrong: fit out the meeting room and hold 14 useful meetings in 4 sprints.',
    ),
    tip: t(
      'Ouvre le panneau « Réunion » : la réunion du matin a lieu chaque jour de semaine à 9 h.',
      'Open the “Meeting” panel: the morning meeting happens every weekday at 9 am.',
    ),
    setup: SEED_START,
    sprints: 4,
    goals: [{ kind: 'meetingRoom' }, { kind: 'stat', stat: 'meetingsUseful', min: 14 }],
    constraints: [],
    reward: 'wall-postit',
  },
  {
    id: 'server-room',
    chapter: 'seed',
    icon: '🗄️',
    title: t('La salle des serveurs', 'The server room'),
    brief: t(
      'Le cloud nous coûte un rein. Monte une salle des serveurs qui tourne et tiens 3 sprints avec une panne de prod au plus.',
      'The cloud costs us a kidney. Set up a working server room and last 3 sprints with at most one prod outage.',
    ),
    tip: t(
      'Une salle tourne avec un serveur, un switch et une clim. Garde la dette basse et surveille le stagiaire : ce sont eux qui font tomber la prod.',
      'A room runs with a server, a switch and cooling. Keep debt low and watch the intern: they are what brings prod down.',
    ),
    setup: SEED_START,
    sprints: 4,
    goals: [{ kind: 'serverRoom' }, { kind: 'sprints', min: 3 }],
    constraints: [{ kind: 'stat', stat: 'prodOutages', max: 1 }],
    reward: 'floor-datacenter',
  },
  {
    id: 'office-cats',
    chapter: 'seed',
    icon: '🐈',
    title: t('Les chats de l’open space', 'The office cats'),
    brief: t(
      'Le sondage interne est formel : l’équipe veut des chats. Adopte 3 chats heureux et garde un moral moyen d’au moins 70 pendant 3 sprints.',
      'The internal survey is clear: the team wants cats. Adopt 3 happy cats and keep average morale at 70 or more for 3 sprints.',
    ),
    tip: t(
      'Pose une litière, une gamelle et un arbre à chat avant d’ouvrir le panneau « Chats ».',
      'Place a litter box, a bowl and a cat tree before opening the “Cats” panel.',
    ),
    setup: SEED_START,
    sprints: 4,
    goals: [
      { kind: 'pets', min: 3 },
      { kind: 'moral', min: 70 },
      { kind: 'sprints', min: 3 },
    ],
    constraints: [],
    reward: 'color-neon',
  },
  {
    id: 'clean-series-a',
    chapter: 'series-a',
    icon: '🧹',
    title: t('Une Série A propre', 'A clean Series A'),
    brief: t(
      'Le fonds qui nous intéresse audite le code avant de signer. Lève ta Série A avec une dette technique de 30 % au plus.',
      'The fund we want audits the code before signing. Close your Series A with technical debt at 30% or less.',
    ),
    tip: t(
      'Alterne features et refactos : la hype attire l’investisseur, la dette basse le rassure.',
      'Alternate features and refactors: hype draws the investor in, low debt reassures them.',
    ),
    setup: SEED_START,
    sprints: 10,
    goals: [
      { kind: 'phase', atLeast: 'SERIES_A' },
      { kind: 'gauge', gauge: 'debt', max: 30 },
    ],
    constraints: [],
    reward: 'perk-network',
  },
  {
    id: 'firefighters',
    chapter: 'series-a',
    icon: '🚒',
    title: t('Les pompiers', 'The firefighters'),
    brief: t(
      'Les gros clients appellent pour tout. Termine 3 urgences à temps en 5 sprints, et n’en rate pas plus de 3.',
      'Big customers call about everything. Finish 3 urgent tasks on time in 5 sprints, missing no more than 3.',
    ),
    tip: t(
      'Les urgences passent en premier : garde des devs du code libres et du café pour eux.',
      'Urgent tasks come first: keep some coders free and the coffee flowing.',
    ),
    setup: SERIES_A_START,
    sprints: 5,
    goals: [{ kind: 'stat', stat: 'urgentDone', min: 3 }],
    constraints: [{ kind: 'stat', stat: 'urgentMissed', max: 3 }],
    reward: 'floor-checker',
  },
  {
    id: 'debt-free-unicorn',
    chapter: 'unicorn',
    icon: '🦄',
    title: t('Licorne sans dette', 'Debt-free unicorn'),
    brief: t(
      'Un milliard de valorisation, oui, mais avec un code qu’on peut encore relire. Deviens une licorne avec 20 % de dette au plus.',
      'A billion-euro valuation, yes, but with code we can still read. Become a unicorn with 20% debt or less.',
    ),
    tip: t(
      'La valorisation suit les utilisateurs et la hype ; le Tech Lead et les testeurs QA freinent la dette.',
      'Valuation follows users and hype; the Tech Lead and QA testers slow the debt down.',
    ),
    setup: LATE_SERIES_A_START,
    sprints: 12,
    goals: [
      { kind: 'phase', atLeast: 'UNICORN' },
      { kind: 'gauge', gauge: 'debt', max: 20 },
    ],
    constraints: [],
    reward: 'item-unicorn-statue',
  },
  {
    id: 'opening-bell',
    chapter: 'unicorn',
    icon: '🔔',
    title: t('La cloche de la Bourse', 'The opening bell'),
    brief: t(
      'Les banquiers préparent l’introduction en Bourse. Atteins 2 Md€ de valorisation avec une prod stable à 60 % au moins.',
      'The bankers are preparing the IPO. Reach a €2B valuation with prod stability at 60% or more.',
    ),
    tip: t(
      'Les filiales, les levées et les utilisateurs font monter la valorisation ; le DevOps garde la prod debout.',
      'Subsidiaries, funding rounds and users push valuation up; the DevOps keeps prod standing.',
    ),
    setup: UNICORN_START,
    sprints: 8,
    goals: [
      { kind: 'valuation', min: 2_000_000_000 },
      { kind: 'gauge', gauge: 'stability', min: 60 },
    ],
    constraints: [],
    reward: 'item-ipo-bell',
  },
];

const MISSIONS_BY_ID = new Map(STORY_MISSIONS.map((mission) => [mission.id, mission]));

export function getStoryMission(id: string): StoryMission | undefined {
  return MISSIONS_BY_ID.get(id as StoryMissionId);
}

export function getStoryChapter(id: StoryChapterId): StoryChapter {
  const chapter = STORY_CHAPTERS.find((c) => c.id === id);
  if (!chapter) throw new Error(`Chapitre inconnu : ${id}`);
  return chapter;
}

/** Missions d'un chapitre, dans l'ordre de la campagne. */
export function chapterMissions(chapter: StoryChapterId): StoryMission[] {
  return STORY_MISSIONS.filter((mission) => mission.chapter === chapter);
}

/**
 * Une mission est jouable quand la précédente de la campagne est réussie (la première l'est
 * toujours). On peut rejouer une mission déjà réussie.
 */
export function missionAvailable(id: StoryMissionId, completed: readonly string[]): boolean {
  const index = STORY_MISSION_IDS.indexOf(id);
  if (index <= 0) return index === 0;
  const previous = STORY_MISSION_IDS[index - 1];
  return previous !== undefined && completed.includes(previous);
}

/** Récompenses débloquées par les missions réussies, dans l'ordre de la campagne. */
export function storyUnlocks(completed: readonly string[]): StoryRewardId[] {
  return STORY_MISSIONS.filter((mission) => completed.includes(mission.id)).map(
    (mission) => mission.reward,
  );
}

/** Un chapitre est fini quand toutes ses missions sont réussies. */
export function chapterComplete(chapter: StoryChapterId, completed: readonly string[]): boolean {
  return chapterMissions(chapter).every((mission) => completed.includes(mission.id));
}

/** Titre de fondateur le plus élevé gagné (null tant qu'aucun chapitre n'est fini). */
export function founderTitle(completed: readonly string[]): LocalizedText | null {
  let title: LocalizedText | null = null;
  for (const chapter of STORY_CHAPTERS)
    if (chapterComplete(chapter.id, completed)) title = chapter.founderTitle;
  return title;
}
