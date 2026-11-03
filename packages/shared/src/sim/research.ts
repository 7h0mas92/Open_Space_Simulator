import { z } from 'zod';
import type { LocalizedText } from '../i18n.js';
import { STORY_MISSIONS, type StoryMissionId } from '../story/campaign.js';
import { STORY_REWARDS, type StoryRewardId } from '../story/rewards.js';

/**
 * Arbre R&D des objets (mode Histoire, longue partie « Ctrl+Alt+Fonder »).
 *
 * En Histoire, le catalogue démarre réduit au strict nécessaire (`RESEARCH_FREE`) : le reste se
 * débloque dans un arbre d'entreprise avec des **points d'innovation**. On en gagne en livrant
 * des features, en remplissant les objectifs de l'histoire et en battant les rivaux sur un sprint.
 *
 * 5 branches de 4 niveaux achetés avec ces points (Confort, Tech, Ambiance, Cuisine,
 * Organisation) et une 6e, Prestige, qui ne s'achète pas : ce sont les récompenses des objectifs
 * de l'histoire (statue licorne, cloche de la Bourse…), débloquées en les remplissant.
 *
 * Chaque niveau demande le précédent de sa branche et l'acte qui lui correspond (niveau 1 dès le
 * garage, niveau 4 à partir de l'acte III « Le géant ») ; le verrou de phase de chaque objet
 * reste en plus. Les autres modes ne sont pas concernés : sans arbre (`campaign.research`
 * absent), tout le catalogue suit les règles habituelles.
 *
 * Aucun tirage : les points se calculent à partir de l'état à chaque démo, le serveur retrouve
 * le même arbre en rejouant les commandes.
 */

export const RESEARCH_BRANCHES = [
  'comfort',
  'tech',
  'ambiance',
  'kitchen',
  'organisation',
] as const;
export const ResearchBranchSchema = z.enum(RESEARCH_BRANCHES);
export type ResearchBranch = z.infer<typeof ResearchBranchSchema>;

/** Branche Prestige : récompenses des objectifs, jamais achetées avec des points. */
export const PRESTIGE_BRANCH = 'prestige' as const;

export const RESEARCH_LEVELS = [1, 2, 3, 4] as const;
export type ResearchLevel = (typeof RESEARCH_LEVELS)[number];

export const RESEARCH_NODE_IDS = [
  'comfort-1',
  'comfort-2',
  'comfort-3',
  'comfort-4',
  'tech-1',
  'tech-2',
  'tech-3',
  'tech-4',
  'ambiance-1',
  'ambiance-2',
  'ambiance-3',
  'ambiance-4',
  'kitchen-1',
  'kitchen-2',
  'kitchen-3',
  'kitchen-4',
  'organisation-1',
  'organisation-2',
  'organisation-3',
  'organisation-4',
] as const;
export const ResearchNodeIdSchema = z.enum(RESEARCH_NODE_IDS);
export type ResearchNodeId = z.infer<typeof ResearchNodeIdSchema>;

/**
 * Ce que débloque un niveau, sous forme de clés : `item:<id>` (catalogue de construction),
 * `computer:<id>`, `monitor:<modèle>`, `monitor:arm` (bras articulé), `wall:<id>`, `floor:<id>`,
 * `meeting:<formule>`.
 */
export type ResearchKey =
  | `item:${string}`
  | `computer:${string}`
  | `monitor:${string}`
  | `wall:${string}`
  | `floor:${string}`
  | `meeting:${string}`;

/** Réglages chiffrés : coûts et gains, faciles à équilibrer (`pnpm balance:story`). */
export const RESEARCH = {
  /** Coût de chaque niveau, en points d'innovation. */
  cost: { 1: 4, 2: 8, 3: 14, 4: 20 } as Record<ResearchLevel, number>,
  /** Acte minimum (index dans `STORY_ACTS`, 0 = prologue) pour chaque niveau. */
  act: { 1: 0, 2: 1, 3: 2, 4: 3 } as Record<ResearchLevel, number>,
  /** Points par feature livrée à la démo. */
  perFeature: 1,
  /** Points par objectif de l'histoire rempli (objectif secondaire d'un acte). */
  perGoal: 3,
  /** Points quand on gagne plus d'utilisateurs que chaque rival en jeu sur le sprint. */
  beatRivals: 2,
  /** Points au début de l'histoire : de quoi prendre un premier niveau tout de suite. */
  start: 4,
} as const;

export interface ResearchNode {
  readonly id: ResearchNodeId;
  readonly branch: ResearchBranch;
  readonly level: ResearchLevel;
  readonly name: LocalizedText;
  readonly keys: readonly ResearchKey[];
}

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

export const RESEARCH_BRANCH_INFO: Record<
  ResearchBranch | typeof PRESTIGE_BRANCH,
  { readonly icon: string; readonly name: LocalizedText }
> = {
  comfort: { icon: '🪑', name: t('Confort', 'Comfort') },
  tech: { icon: '💻', name: t('Tech', 'Tech') },
  ambiance: { icon: '🌿', name: t('Ambiance', 'Ambiance') },
  kitchen: { icon: '☕', name: t('Cuisine', 'Kitchen') },
  organisation: { icon: '🗓️', name: t('Organisation', 'Organisation') },
  prestige: { icon: '🏆', name: t('Prestige', 'Prestige') },
};

const items = (...ids: string[]): ResearchKey[] => ids.map((id) => `item:${id}` as const);

/** Le catalogue de départ, sans recherche : de quoi coder et boire un café dans un garage. */
export const RESEARCH_FREE: readonly ResearchKey[] = [
  ...items(
    'desk',
    'ikea-desk',
    'plant',
    'small-plant',
    'drip-coffee-maker',
    'coffee-mug',
    'rubber-duck',
    'desk-lamp',
    'trashcan',
  ),
  'computer:tower',
  'monitor:office',
  'wall:cream',
];

export const RESEARCH_TREE: readonly ResearchNode[] = [
  // ─── 🪑 Confort ──────────────────────────────────────────────────────────
  {
    id: 'comfort-1',
    branch: 'comfort',
    level: 1,
    name: t('Coin canapé', 'Sofa corner'),
    keys: items('sofa', 'rug', 'bookcase', 'book-stack', 'teddy-bear', 'bench'),
  },
  {
    id: 'comfort-2',
    branch: 'comfort',
    level: 2,
    name: t('Ergonomie', 'Ergonomics'),
    keys: items(
      'ergonomic-chair',
      'standing-desk',
      'desk-earbuds',
      'earbuds-dock',
      'speaker',
      'mini-speaker',
      'radio',
    ),
  },
  {
    id: 'comfort-3',
    branch: 'comfort',
    level: 3,
    name: t('Salle de jeux', 'Game room'),
    keys: items('babyfoot', 'arcade-cabinet', 'pinball'),
  },
  {
    id: 'comfort-4',
    branch: 'comfort',
    level: 4,
    name: t('Bureau de rêve', 'Dream office'),
    keys: items('nap-pod', 'slide'),
  },
  // ─── 💻 Tech ─────────────────────────────────────────────────────────────
  {
    id: 'tech-1',
    branch: 'tech',
    level: 1,
    name: t('Meilleurs écrans', 'Better screens'),
    keys: ['monitor:portrait', 'monitor:gaming', 'computer:gaming-neon', 'item:second-screen'],
  },
  {
    id: 'tech-2',
    branch: 'tech',
    level: 2,
    name: t('Postes de pro', 'Pro workstations'),
    keys: ['computer:gaming-liquid', 'monitor:slim', 'monitor:arm', 'item:tv-dashboard'],
  },
  {
    id: 'tech-3',
    branch: 'tech',
    level: 3,
    name: t('Local serveur', 'Server closet'),
    keys: items(
      'server-closet',
      'server-rack',
      'rack-server',
      'network-switch',
      'fibre-router',
      'split-ac',
      'precision-cooling',
      'ups-unit',
      'backup-nas',
      'firewall',
      'server-monitoring',
    ),
  },
  {
    id: 'tech-4',
    branch: 'tech',
    level: 4,
    name: t('Datacenter maison', 'In-house datacenter'),
    keys: [
      ...items('server-room', 'blade-server', 'gpu-server', 'inrow-cooling', 'fire-suppression'),
      'monitor:curved',
      'computer:gaming-titan',
      'computer:pro-laptop',
    ],
  },
  // ─── 🌿 Ambiance ─────────────────────────────────────────────────────────
  {
    id: 'ambiance-1',
    branch: 'ambiance',
    level: 1,
    name: t('Petites plantes et peinture', 'Small plants and paint'),
    keys: [
      ...items('snake-plant', 'pothos', 'bonsai', 'succulent', 'mini-cactus'),
      'wall:sage',
      'wall:teal',
      'wall:terracotta',
      'wall:mustard',
      'wall:blush',
      'wall:navy',
      'wall:anthracite',
    ],
  },
  {
    id: 'ambiance-2',
    branch: 'ambiance',
    level: 2,
    name: t('Papiers peints et sols', 'Wallpapers and floors'),
    keys: [
      'wall:stripes',
      'wall:dots',
      'wall:herringbone',
      'wall:brick',
      'wall:jungle',
      'wall:wainscot',
      'wall:chalkboard',
      'floor:vinyl',
      'floor:carpet',
      'floor:concrete',
      'floor:tiles',
      'floor:planks',
      'floor:chevron',
      ...items('neon-sign', 'trophy'),
    ],
  },
  {
    id: 'ambiance-3',
    branch: 'ambiance',
    level: 3,
    name: t('Fenêtres, grandes plantes et chats', 'Windows, big plants and cats'),
    keys: [
      ...items(
        'fiddle-leaf-fig',
        'kentia-palm',
        'planter-box',
        'indoor-tree',
        'fountain',
        'window-small',
        'window-medium',
        'window-large',
        'litter-open',
        'litter-covered',
        'litter-robot',
        'cat-bowl',
        'cat-feeder',
        'cat-tree-small',
        'cat-tree-medium',
        'cat-tree-large',
      ),
      'wall:artdeco',
      'floor:terrazzo',
    ],
  },
  {
    id: 'ambiance-4',
    branch: 'ambiance',
    level: 4,
    name: t('Baie vitrée et marbre', 'Glass wall and marble'),
    keys: [...items('glass-wall', 'olive-tree', 'giant-monstera'), 'wall:coderain', 'floor:marble'],
  },
  // ─── ☕ Cuisine ──────────────────────────────────────────────────────────
  {
    id: 'kitchen-1',
    branch: 'kitchen',
    level: 1,
    name: t('Kitchenette', 'Kitchenette'),
    keys: items(
      'kitchen-drawers',
      'kitchen-doors',
      'kitchen-sink',
      'kettle',
      'microwave-oven',
      'toaster',
    ),
  },
  {
    id: 'kitchen-2',
    branch: 'kitchen',
    level: 2,
    name: t('Vrai café', 'Real coffee'),
    keys: items('espresso-machine', 'kitchen-tall', 'rice-cooker', 'blender'),
  },
  {
    id: 'kitchen-3',
    branch: 'kitchen',
    level: 3,
    name: t('Cuisine équipée', 'Fitted kitchen'),
    keys: items('kitchen-island', 'kitchen-hutch', 'fridge'),
  },
  {
    id: 'kitchen-4',
    branch: 'kitchen',
    level: 4,
    name: t('Cantine', 'Canteen'),
    keys: items('canteen-table'),
  },
  // ─── 🗓️ Organisation ─────────────────────────────────────────────────────
  {
    id: 'organisation-1',
    branch: 'organisation',
    level: 1,
    name: t('Stand-up et cloisons', 'Stand-ups and partitions'),
    keys: [
      'meeting:standup',
      'meeting:brainstorm',
      ...items('thin-wall', 'glass-partition', 'projector', 'projection-screen-small'),
    ],
  },
  {
    id: 'organisation-2',
    branch: 'organisation',
    level: 2,
    name: t('Présentations', 'Presentations'),
    keys: [
      'meeting:aquarium',
      ...items('projection-screen-medium', 'ceiling-projector', 'lectern', 'reception-desk'),
    ],
  },
  {
    id: 'organisation-3',
    branch: 'organisation',
    level: 3,
    name: t('War room et salle zen', 'War room and zen room'),
    keys: [
      'meeting:war-room',
      'meeting:zen',
      ...items('projection-screen-large', 'stage', 'auditorium-screen'),
    ],
  },
  {
    id: 'organisation-4',
    branch: 'organisation',
    level: 4,
    name: t('Salle du conseil', 'Boardroom'),
    keys: ['meeting:boardroom'],
  },
];

export function getResearchNode(id: string): ResearchNode | undefined {
  return RESEARCH_TREE.find((node) => node.id === id);
}

/** Nœud qui débloque cette clé (undefined : en vente sans recherche). */
const NODE_OF_KEY = new Map<string, ResearchNode>(
  RESEARCH_TREE.flatMap((node) => node.keys.map((key) => [key, node] as const)),
);

export function researchNodeOf(key: ResearchKey): ResearchNode | undefined {
  return NODE_OF_KEY.get(key);
}

/** Niveau précédent de la même branche (null pour le niveau 1). */
export function previousResearchNode(node: ResearchNode): ResearchNodeId | null {
  return node.level === 1 ? null : (`${node.branch}-${node.level - 1}` as ResearchNodeId);
}

/** Arbre d'une partie : points disponibles, gagnés au total, niveaux pris. */
export const ResearchStateSchema = z.object({
  points: z.number().int().nonnegative(),
  earned: z.number().int().nonnegative(),
  nodes: z.array(ResearchNodeIdSchema),
  /** Objectifs de l'histoire déjà comptés (longueur de `campaign.done` à la dernière démo). */
  goalsCounted: z.number().int().nonnegative(),
});
export type ResearchState = z.infer<typeof ResearchStateSchema>;

export function emptyResearch(): ResearchState {
  return { points: RESEARCH.start, earned: RESEARCH.start, nodes: [], goalsCounted: 0 };
}

/**
 * La clé est-elle utilisable ? Sans arbre (autres modes, vieilles parties) : toujours. Une clé
 * absente de l'arbre et du catalogue de départ (récompenses de Prestige, objets ajoutés plus
 * tard) suit ses autres règles habituelles.
 */
export function researchAllows(research: ResearchState | undefined, key: ResearchKey): boolean {
  if (!research) return true;
  const node = NODE_OF_KEY.get(key);
  return !node || research.nodes.includes(node.id);
}

/** Pourquoi un niveau ne peut pas être pris tout de suite (null : il peut l'être). */
export type ResearchBlock = 'owned' | 'previous' | 'act' | 'points';

export function researchBlock(
  research: ResearchState,
  act: number,
  node: ResearchNode,
): ResearchBlock | null {
  if (research.nodes.includes(node.id)) return 'owned';
  const previous = previousResearchNode(node);
  if (previous && !research.nodes.includes(previous)) return 'previous';
  if (act < RESEARCH.act[node.level]) return 'act';
  if (research.points < RESEARCH.cost[node.level]) return 'points';
  return null;
}

/**
 * Branche Prestige : les récompenses des objectifs de l'histoire (papiers peints, sols, couleurs,
 * objets ; pas les bonus de départ, qui n'ont de sens qu'au lancement d'une partie).
 */
export const PRESTIGE_REWARDS: readonly StoryRewardId[] = STORY_REWARDS.filter(
  (reward) => reward.kind !== 'perk',
).map((reward) => reward.id);

/** La récompense de Prestige est-elle gagnée par un objectif rempli dans cette histoire ? */
export function prestigeEarned(done: readonly StoryMissionId[], reward: StoryRewardId): boolean {
  return (
    PRESTIGE_REWARDS.includes(reward) &&
    STORY_MISSIONS.some((mission) => mission.reward === reward && done.includes(mission.id))
  );
}
