/**
 * Catalogue des objets du mode construction, vu par le rendu et l'interface.
 *
 * La simulation est seule juge des règles : identifiants, prix, emprise, phase de déblocage et
 * effets viennent de `FURNITURE_CATALOG` (`@oss/shared`). Ce fichier n'y ajoute que l'habillage :
 * le modèle Kenney (ou la forme Three.js si le modèle manque), la hauteur visée, la catégorie
 * de la boutique et le point d'intérêt que l'IA des personnages peut utiliser.
 */
import { FURNITURE_CATALOG, type LocalizedText, type Phase } from '@oss/shared';
import type { FurnitureModel, MissingAssetId } from '../render/assetManifest';

export type ItemModel =
  | { readonly source: 'kenney'; readonly model: FurnitureModel }
  | { readonly source: 'primitive'; readonly model: MissingAssetId };

export const ITEM_CATEGORIES = ['work', 'comfort', 'kitchen', 'fun', 'decor'] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

/** Point d'intérêt pour l'IA des personnages. */
export type ItemUse = 'desk' | 'coffee' | 'meeting' | 'babyfoot' | 'rest';

interface ItemLook {
  readonly category: ItemCategory;
  readonly model: ItemModel;
  /** Hauteur visée du modèle, en unités de grille (sert à la forme de secours). */
  readonly height: number;
  readonly use?: ItemUse;
  /**
   * Échelle propre au modèle (x, y, z), appliquée en plus de l'échelle commune du kit, pour
   * qu'il couvre son emprise (la table de cantine fait 3 x 2 cases).
   */
  readonly scale?: readonly [number, number, number];
  /** Petits appareils posés côte à côte sur le meuble (machine à café sur un placard…). */
  readonly onTop?: readonly FurnitureModel[];
}

export interface CatalogItem extends ItemLook {
  readonly kind: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  /** Emprise en cases (largeur x profondeur), avant rotation. */
  readonly size: readonly [number, number];
  readonly price: number;
  /** Phase à partir de laquelle l'objet est en vente. */
  readonly minPhase: Phase;
  /** Nombre maximum d'exemplaires. */
  readonly maxCount: number;
}

const kenney = (model: FurnitureModel): ItemModel => ({ source: 'kenney', model });
const primitive = (model: MissingAssetId): ItemModel => ({ source: 'primitive', model });

type SimItemId = (typeof FURNITURE_CATALOG)[number]['id'];

/** Habillage de chaque objet de la simulation (le typage oblige à n'en oublier aucun). */
const LOOKS: Record<SimItemId, ItemLook> = {
  desk: { category: 'work', model: kenney('desk'), height: 0.75, use: 'desk' },
  'ikea-desk': { category: 'work', model: kenney('table'), height: 0.65, use: 'desk' },
  'standing-desk': {
    category: 'work',
    model: primitive('standingDesk'),
    height: 1.1,
    use: 'desk',
  },
  'ergonomic-chair': { category: 'work', model: kenney('chairDesk'), height: 1.2 },
  'noise-headsets': { category: 'work', model: primitive('headphones'), height: 0.4 },
  bookcase: { category: 'work', model: kenney('bookcaseClosedWide'), height: 1.6 },
  'tv-dashboard': {
    category: 'work',
    model: kenney('cabinetTelevision'),
    height: 1.5,
    onTop: ['televisionModern'],
  },
  'server-rack': { category: 'work', model: kenney('bookcaseClosedDoors'), height: 1.7 },
  'coffee-machine': {
    category: 'kitchen',
    model: kenney('kitchenCabinet'),
    height: 1.25,
    use: 'coffee',
    onTop: ['kitchenCoffeeMachine'],
  },
  'premium-coffee-machine': {
    category: 'kitchen',
    model: kenney('kitchenCabinetDrawer'),
    height: 1.25,
    use: 'coffee',
    onTop: ['kitchenCoffeeMachine', 'kitchenBlender'],
  },
  fridge: { category: 'kitchen', model: kenney('kitchenFridge'), height: 1.85, use: 'coffee' },
  microwave: {
    category: 'kitchen',
    model: kenney('kitchenCabinet'),
    height: 1.25,
    onTop: ['kitchenMicrowave'],
  },
  'canteen-table': {
    category: 'kitchen',
    model: kenney('tableCrossCloth'),
    height: 0.7,
    use: 'meeting',
    scale: [1.6, 1, 2],
  },
  babyfoot: { category: 'fun', model: primitive('babyfoot'), height: 0.9, use: 'babyfoot' },
  speaker: { category: 'fun', model: kenney('speaker'), height: 1.25 },
  slide: { category: 'fun', model: primitive('slide'), height: 2 },
  sofa: { category: 'comfort', model: kenney('loungeSofa'), height: 0.9, use: 'rest' },
  'nap-pod': { category: 'comfort', model: primitive('napPod'), height: 1.2, use: 'rest' },
  plant: { category: 'decor', model: kenney('pottedPlant'), height: 1.3 },
  'small-plant': {
    category: 'decor',
    model: kenney('plantSmall2'),
    height: 0.55,
    scale: [2, 2, 2],
  },
  rug: { category: 'decor', model: kenney('rugRound'), height: 0.02 },
  trashcan: { category: 'decor', model: kenney('trashcan'), height: 0.85 },
};

export const CATALOG: readonly CatalogItem[] = FURNITURE_CATALOG.map((item) => ({
  ...LOOKS[item.id],
  kind: item.id,
  name: item.name,
  description: item.description,
  size: [item.width, item.depth] as const,
  price: item.price,
  minPhase: item.minPhase,
  maxCount: item.maxCount,
}));

const byKind = new Map<string, CatalogItem>(CATALOG.map((item) => [item.kind, item]));

export function catalogItem(kind: string): CatalogItem | undefined {
  return byKind.get(kind);
}

/** Emprise d'un objet après rotation (un quart de tour échange largeur et profondeur). */
export function footprint(item: CatalogItem, rotation: number): readonly [number, number] {
  return rotation % 2 === 0 ? item.size : [item.size[1], item.size[0]];
}
