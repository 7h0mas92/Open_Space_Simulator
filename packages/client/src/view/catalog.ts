/**
 * Catalogue des objets du mode construction.
 *
 * Chaque objet a un modèle Kenney (ou une forme Three.js si le modèle manque), une emprise sur
 * la grille, un prix et des effets affichés au joueur. Les effets chiffrés sont appliqués par la
 * simulation ; ici ils servent à l'affichage et à la fausse partie (`view/mock.ts`).
 */
import type { Phase } from '@oss/shared';
import type { FurnitureModel, MissingAssetId } from '../render/assetManifest';

/** Effets d'un objet, en points par jour simulé (ou en pourcentage pour la productivité). */
export interface ItemEffects {
  readonly coffee?: number;
  readonly morale?: number;
  readonly productivity?: number;
  readonly endurance?: number;
  readonly quality?: number;
  readonly hype?: number;
  readonly stability?: number;
  /** Annule le malus de productivité des réunions. */
  readonly meetingShield?: boolean;
}

export type ItemModel =
  | { readonly source: 'kenney'; readonly model: FurnitureModel }
  | { readonly source: 'primitive'; readonly model: MissingAssetId };

export const ITEM_CATEGORIES = ['work', 'comfort', 'kitchen', 'fun', 'decor'] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export interface CatalogItem {
  readonly kind: string;
  readonly category: ItemCategory;
  readonly model: ItemModel;
  /** Emprise en cases (largeur x profondeur), avant rotation. */
  readonly size: readonly [number, number];
  /** Hauteur visée du modèle, en unités de grille. */
  readonly height: number;
  readonly price: number;
  /** Phase à partir de laquelle l'objet est en vente. */
  readonly minPhase: Phase;
  readonly effects: ItemEffects;
  /** Point d'intérêt pour l'IA des personnages. */
  readonly use?: 'desk' | 'coffee' | 'meeting' | 'babyfoot' | 'rest';
}

const kenney = (model: FurnitureModel): ItemModel => ({ source: 'kenney', model });
const primitive = (model: MissingAssetId): ItemModel => ({ source: 'primitive', model });

export const CATALOG = [
  // Postes de travail
  {
    kind: 'desk',
    category: 'work',
    model: kenney('desk'),
    size: [2, 1],
    height: 0.75,
    price: 400,
    minPhase: 'GARAGE',
    effects: {},
    use: 'desk',
  },
  {
    kind: 'deskCorner',
    category: 'work',
    model: kenney('deskCorner'),
    size: [2, 2],
    height: 0.75,
    price: 650,
    minPhase: 'SEED',
    effects: { productivity: 3 },
    use: 'desk',
  },
  {
    kind: 'standingDesk',
    category: 'work',
    model: primitive('standingDesk'),
    size: [2, 1],
    height: 1.1,
    price: 900,
    minPhase: 'SERIES_A',
    effects: { endurance: 2, productivity: 2 },
    use: 'desk',
  },
  {
    kind: 'ergoChair',
    category: 'work',
    model: kenney('chairDesk'),
    size: [1, 1],
    height: 1,
    price: 350,
    minPhase: 'GARAGE',
    effects: { endurance: 3 },
  },
  {
    kind: 'headphones',
    category: 'work',
    model: primitive('headphones'),
    size: [1, 1],
    height: 0.4,
    price: 250,
    minPhase: 'SEED',
    effects: { meetingShield: true },
  },
  {
    kind: 'bookcase',
    category: 'work',
    model: kenney('bookcaseOpen'),
    size: [2, 1],
    height: 1.8,
    price: 300,
    minPhase: 'GARAGE',
    effects: { quality: 2 },
  },
  {
    kind: 'meetingTable',
    category: 'work',
    model: kenney('tableRound'),
    size: [2, 2],
    height: 0.75,
    price: 600,
    minPhase: 'SEED',
    effects: { productivity: -2, hype: 1 },
    use: 'meeting',
  },
  {
    kind: 'tv',
    category: 'work',
    model: kenney('televisionModern'),
    size: [2, 1],
    height: 1.1,
    price: 800,
    minPhase: 'SEED',
    effects: { stability: 1, hype: 1 },
  },
  // Cuisine
  {
    kind: 'coffeeMachine',
    category: 'kitchen',
    model: kenney('kitchenCoffeeMachine'),
    size: [1, 1],
    height: 0.6,
    price: 150,
    minPhase: 'GARAGE',
    effects: { coffee: 3 },
    use: 'coffee',
  },
  {
    kind: 'coffeePremium',
    category: 'kitchen',
    model: kenney('kitchenBar'),
    size: [2, 1],
    height: 1,
    price: 2500,
    minPhase: 'SEED',
    effects: { coffee: 8, morale: 1 },
    use: 'coffee',
  },
  {
    kind: 'fridge',
    category: 'kitchen',
    model: kenney('kitchenFridge'),
    size: [1, 1],
    height: 1.9,
    price: 900,
    minPhase: 'SEED',
    effects: { morale: 2 },
  },
  {
    kind: 'microwave',
    category: 'kitchen',
    model: kenney('kitchenMicrowave'),
    size: [1, 1],
    height: 0.4,
    price: 200,
    minPhase: 'GARAGE',
    effects: { morale: 1 },
  },
  {
    kind: 'toaster',
    category: 'kitchen',
    model: kenney('toaster'),
    size: [1, 1],
    height: 0.3,
    price: 60,
    minPhase: 'GARAGE',
    effects: { morale: 1, stability: -1 },
  },
  // Détente
  {
    kind: 'babyfoot',
    category: 'fun',
    model: primitive('babyfoot'),
    size: [2, 1],
    height: 0.9,
    price: 1200,
    minPhase: 'SERIES_A',
    effects: { morale: 5, productivity: -4 },
    use: 'babyfoot',
  },
  {
    kind: 'sofa',
    category: 'comfort',
    model: kenney('loungeSofa'),
    size: [2, 1],
    height: 0.8,
    price: 1100,
    minPhase: 'SEED',
    effects: { morale: 3, endurance: 1 },
    use: 'rest',
  },
  {
    kind: 'napPod',
    category: 'comfort',
    model: primitive('napPod'),
    size: [2, 1],
    height: 1.2,
    price: 6000,
    minPhase: 'UNICORN',
    effects: { endurance: 6, morale: 2 },
    use: 'rest',
  },
  {
    kind: 'slide',
    category: 'fun',
    model: primitive('slide'),
    size: [1, 3],
    height: 2,
    price: 15000,
    minPhase: 'UNICORN',
    effects: { morale: 6, hype: 3, productivity: -2 },
  },
  {
    kind: 'speaker',
    category: 'fun',
    model: kenney('speaker'),
    size: [1, 1],
    height: 1,
    price: 450,
    minPhase: 'SEED',
    effects: { morale: 2, productivity: -1 },
  },
  {
    kind: 'radio',
    category: 'fun',
    model: kenney('radio'),
    size: [1, 1],
    height: 0.4,
    price: 80,
    minPhase: 'GARAGE',
    effects: { morale: 1 },
  },
  // Décor
  {
    kind: 'plant',
    category: 'decor',
    model: kenney('pottedPlant'),
    size: [1, 1],
    height: 1.1,
    price: 90,
    minPhase: 'GARAGE',
    effects: { morale: 1 },
  },
  {
    kind: 'plantSmall',
    category: 'decor',
    model: kenney('plantSmall2'),
    size: [1, 1],
    height: 0.5,
    price: 30,
    minPhase: 'GARAGE',
    effects: { morale: 0.5 },
  },
  {
    kind: 'lamp',
    category: 'decor',
    model: kenney('lampRoundFloor'),
    size: [1, 1],
    height: 1.6,
    price: 120,
    minPhase: 'GARAGE',
    effects: { endurance: 1 },
  },
  {
    kind: 'rug',
    category: 'decor',
    model: kenney('rugRounded'),
    size: [2, 2],
    height: 0.05,
    price: 150,
    minPhase: 'SEED',
    effects: { morale: 1 },
  },
  {
    kind: 'trashcan',
    category: 'decor',
    model: kenney('trashcan'),
    size: [1, 1],
    height: 0.6,
    price: 20,
    minPhase: 'GARAGE',
    effects: { stability: 0.5 },
  },
] as const satisfies readonly CatalogItem[];

export type ItemKind = (typeof CATALOG)[number]['kind'];

const byKind = new Map<string, CatalogItem>(CATALOG.map((item) => [item.kind, item]));

export function catalogItem(kind: string): CatalogItem | undefined {
  return byKind.get(kind);
}

/** Emprise d'un objet après rotation (un quart de tour échange largeur et profondeur). */
export function footprint(item: CatalogItem, rotation: number): readonly [number, number] {
  return rotation % 2 === 0 ? item.size : [item.size[1], item.size[0]];
}
