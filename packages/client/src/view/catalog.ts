/**
 * Catalogue des objets du mode construction, vu par le rendu et l'interface.
 *
 * La simulation est seule juge des règles : identifiants, prix, emprise, phase de déblocage et
 * effets viennent de `FURNITURE_CATALOG` (`@oss/shared`). Ce fichier n'y ajoute que l'habillage :
 * le modèle Kenney (ou la forme Three.js si le modèle manque), la hauteur visée, la catégorie
 * de la boutique et le point d'intérêt que l'IA des personnages peut utiliser.
 */
import { FURNITURE_CATALOG, type LocalizedText, type PetNeed, type Phase } from '@oss/shared';
import type { FurnitureModel, MissingAssetId } from '../render/assetManifest';

export type ItemModel =
  | { readonly source: 'kenney'; readonly model: FurnitureModel }
  | { readonly source: 'primitive'; readonly model: MissingAssetId };

export const ITEM_CATEGORIES = [
  'work',
  'comfort',
  'kitchen',
  'fun',
  'decor',
  'pets',
  'window',
  'accessory',
] as const;
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
  readonly onTop?: readonly ItemModel[];
  /** Pièces ajoutées à une position précise (écran sur le bureau, bancs autour d'une table…). */
  readonly parts?: readonly ItemPart[];
  /**
   * Matériaux repeints quand le joueur choisit une couleur (noms des matériaux Kenney, ou
   * couleurs de `PALETTE` pour les formes Three.js). Le premier prend la teinte choisie, les
   * suivants une version plus sombre. Absent : bois et tissu ; vide : objet non repeignable.
   */
  readonly paint?: readonly string[];
  /**
   * Meuble à plateau : emplacements des accessoires [x, hauteur du plateau, z], dans le repère
   * du meuble. Leur nombre doit égaler `surfaceSlots` de la simulation (vérifié par un test).
   */
  readonly surface?: readonly (readonly [number, number, number])[];
  /**
   * Arbre à chat : endroits où un chat s'installe [x, hauteur, z], dans le repère du meuble
   * (centre de l'emprise, avant rotation).
   */
  readonly perches?: readonly (readonly [number, number, number])[];
}

/** Matériaux repeints par défaut : le bois et le tissu des modèles Kenney. */
const DEFAULT_PAINT = ['wood', 'woodDark', 'carpet', 'carpetDarker'] as const;

/** Pièce d'un objet composé, placée dans le repère de l'objet (centre de l'emprise, au sol). */
export interface ItemPart {
  readonly model: ItemModel;
  /** Position en unités de grille ; y est la hauteur de la base de la pièce. */
  readonly at: readonly [number, number, number];
  /** Rotation autour de l'axe vertical, en quarts de tour. */
  readonly turn?: number;
  readonly scale?: readonly [number, number, number];
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
  /** Accessoire : se pose sur un meuble à plateau, jamais au sol. */
  readonly accessory: boolean;
  /** Fenêtre : se fixe dans un mur du fond (rotation 0 : mur du fond, 1 : mur de gauche). */
  readonly wall: boolean;
  readonly paint: readonly string[];
  /** Équipement pour chat (litière, gamelle, arbre à chat), sinon `null`. */
  readonly petNeed: PetNeed | null;
}

const kenney = (model: FurnitureModel): ItemModel => ({ source: 'kenney', model });
const primitive = (model: MissingAssetId): ItemModel => ({ source: 'primitive', model });
const part = (
  model: ItemModel,
  at: readonly [number, number, number],
  options: Pick<ItemPart, 'turn' | 'scale'> = {},
): ItemPart => ({ model, at, ...options });

/** Hauteur des plateaux et plans de travail Kenney (après l'échelle commune du kit). */
const DESK_TOP = 0.77;
const TRESTLE_TOP = 0.69;
const TV_CABINET_TOP = 0.62;
const STANDING_TOP = 1.1;
const BOOKCASE_TOP = 1.58;
/** Épaisseur du tapis de souris (`mousePad`) et agrandissement de la souris Kenney posée dessus. */
const MOUSE_PAD = 0.012;
const MOUSE_SCALE: readonly [number, number, number] = [1.35, 1.35, 1.35];

type SimItemId = (typeof FURNITURE_CATALOG)[number]['id'];

/** Habillage de chaque objet de la simulation (le typage oblige à n'en oublier aucun). */
const LOOKS: Record<SimItemId, ItemLook> = {
  // Bureau de dev complet : écran, clavier, souris.
  desk: {
    category: 'work',
    model: kenney('desk'),
    height: 0.75,
    use: 'desk',
    parts: [
      part(kenney('computerScreen'), [-0.35, DESK_TOP, -0.15]),
      part(kenney('computerKeyboard'), [-0.35, DESK_TOP, 0.17]),
      // La souris, un peu agrandie, sur un tapis sombre qui la détache du plateau.
      part(primitive('mousePad'), [0.08, DESK_TOP, 0.15]),
      part(kenney('computerMouse'), [0.08, DESK_TOP + MOUSE_PAD, 0.15], { scale: MOUSE_SCALE }),
    ],
    surface: [
      [0.3, DESK_TOP, -0.18],
      [0.55, DESK_TOP, 0.12],
      [0.75, DESK_TOP, -0.18],
    ],
  },
  // Le bureau du garage : tréteaux, un portable avec sa souris et des ramen.
  'ikea-desk': {
    category: 'work',
    model: kenney('tableCross'),
    height: 0.65,
    use: 'desk',
    parts: [
      part(kenney('laptop'), [-0.3, TRESTLE_TOP, 0], { turn: 0 }),
      part(primitive('mousePad'), [0.14, TRESTLE_TOP, 0.12]),
      part(kenney('computerMouse'), [0.14, TRESTLE_TOP + MOUSE_PAD, 0.12], { scale: MOUSE_SCALE }),
      part(primitive('ramen'), [0.45, TRESTLE_TOP, 0.05]),
    ],
    surface: [
      [0.12, TRESTLE_TOP, -0.22],
      [-0.68, TRESTLE_TOP, -0.2],
      [0.8, TRESTLE_TOP, -0.15],
    ],
  },
  'standing-desk': {
    category: 'work',
    model: primitive('standingDesk'),
    height: 1.1,
    use: 'desk',
    paint: ['white'],
    surface: [
      [-0.65, STANDING_TOP, -0.12],
      [0.65, STANDING_TOP, -0.12],
    ],
  },
  'ergonomic-chair': { category: 'work', model: kenney('chairDesk'), height: 1.2 },
  'noise-headsets': {
    category: 'work',
    model: primitive('headphones'),
    height: 1.2,
    paint: ['dark'],
  },
  // Bibliothèque garnie de livres sur chaque étagère.
  bookcase: {
    category: 'work',
    model: kenney('bookcaseClosedWide'),
    height: 1.6,
    parts: [
      part(kenney('books'), [-0.45, 0.06, 0]),
      part(kenney('books'), [0.2, 0.06, 0]),
      part(kenney('books'), [0.45, 0.56, 0], { turn: 2 }),
      part(kenney('books'), [-0.3, 1.04, 0]),
    ],
    surface: [
      [-0.45, BOOKCASE_TOP, 0],
      [0.45, BOOKCASE_TOP, 0],
    ],
  },
  'tv-dashboard': {
    category: 'work',
    model: kenney('cabinetTelevision'),
    height: 1.5,
    parts: [part(primitive('metricsScreen'), [0, TV_CABINET_TOP, -0.05])],
  },
  'server-rack': {
    category: 'work',
    model: primitive('serverRack'),
    height: 1.9,
    paint: [],
    surface: [[0, 1.875, 0]],
  },
  // Cafetière à filtre sur un comptoir étroit.
  'coffee-machine': {
    category: 'kitchen',
    model: kenney('kitchenBar'),
    height: 1.25,
    use: 'coffee',
    onTop: [primitive('dripCoffeeMaker')],
  },
  // Machine de barista et son moulin, sur un meuble à tiroirs.
  'premium-coffee-machine': {
    category: 'kitchen',
    model: kenney('kitchenCabinetDrawer'),
    height: 1.35,
    use: 'coffee',
    onTop: [primitive('espressoMachine')],
  },
  fridge: {
    category: 'kitchen',
    model: primitive('drinksFridge'),
    height: 1.85,
    use: 'coffee',
    paint: ['red'],
    surface: [[0, 1.82, -0.04]],
  },
  microwave: {
    category: 'kitchen',
    model: kenney('kitchenCabinet'),
    height: 1.25,
    onTop: [kenney('kitchenMicrowave')],
  },
  // Grande tablée avec deux bancs, pour les déjeuners d'équipe.
  'canteen-table': {
    category: 'kitchen',
    model: kenney('tableCrossCloth'),
    height: 0.7,
    use: 'meeting',
    scale: [1.6, 1, 1.25],
    parts: [
      part(kenney('benchCushionLow'), [0, 0, -0.8], { scale: [3, 1, 1] }),
      part(kenney('benchCushionLow'), [0, 0, 0.8], { scale: [3, 1, 1] }),
    ],
    paint: ['carpet'],
    surface: [
      [-0.9, TRESTLE_TOP, -0.2],
      [0.9, TRESTLE_TOP, -0.2],
      [-0.3, TRESTLE_TOP, 0.22],
      [0.3, TRESTLE_TOP, 0.22],
    ],
  },
  babyfoot: {
    category: 'fun',
    model: primitive('babyfoot'),
    height: 0.9,
    use: 'babyfoot',
    paint: ['wood', 'woodDark'],
  },
  speaker: { category: 'fun', model: kenney('speaker'), height: 1.25 },
  slide: { category: 'fun', model: primitive('slide'), height: 2, paint: ['red'] },
  sofa: { category: 'comfort', model: kenney('loungeSofa'), height: 0.9, use: 'rest' },
  'nap-pod': {
    category: 'comfort',
    model: primitive('napPod'),
    height: 1.2,
    use: 'rest',
    paint: ['blue'],
  },
  plant: { category: 'decor', model: kenney('pottedPlant'), height: 1.3 },
  'small-plant': {
    category: 'decor',
    model: primitive('cactus'),
    height: 0.75,
    paint: ['terracotta'],
  },
  rug: { category: 'decor', model: kenney('rugRound'), height: 0.02 },
  trashcan: { category: 'decor', model: kenney('trashcan'), height: 0.85, paint: ['metal'] },
  // Animaux : de quoi accueillir les chats. Chaque arbre a sa moquette (beige, gris, mauve).
  'litter-open': {
    category: 'pets',
    model: primitive('litterOpen'),
    height: 0.17,
    paint: ['mint'],
  },
  'litter-covered': {
    category: 'pets',
    model: primitive('litterCovered'),
    height: 0.62,
    paint: ['white', 'mint'],
  },
  'litter-robot': {
    category: 'pets',
    model: primitive('litterRobot'),
    height: 0.66,
    paint: ['white'],
  },
  'cat-bowl': { category: 'pets', model: primitive('catBowl'), height: 0.16, paint: ['wood'] },
  'cat-feeder': { category: 'pets', model: primitive('catFeeder'), height: 0.5, paint: ['white'] },
  'cat-tree-small': {
    category: 'pets',
    model: primitive('catTreeSmall'),
    height: 0.96,
    paint: ['plush'],
    perches: [[0, 0.88, 0]],
  },
  'cat-tree-medium': {
    category: 'pets',
    model: primitive('catTreeMedium'),
    height: 1.34,
    paint: ['slate'],
    perches: [
      [-0.5, 1.26, 0],
      [0.5, 0.86, 0],
    ],
  },
  'cat-tree-large': {
    category: 'pets',
    model: primitive('catTreeLarge'),
    height: 1.74,
    paint: ['mauve'],
    perches: [
      [0, 1.66, 0],
      [-1, 0.79, 0],
      [1, 1.18, 0],
    ],
  },
  // Accessoires : petits objets posés sur les meubles à plateau (voir `surface`).
  // Fenêtres percées dans les murs du fond : seul le cadre se repeint.
  'window-small': {
    category: 'window',
    model: primitive('windowSmall'),
    height: 2.2,
    paint: ['dark'],
  },
  'window-medium': {
    category: 'window',
    model: primitive('windowMedium'),
    height: 2.2,
    paint: ['dark'],
  },
  'window-large': {
    category: 'window',
    model: primitive('windowLarge'),
    height: 2.2,
    paint: ['dark'],
  },
  'glass-wall': {
    category: 'window',
    model: primitive('glassWall'),
    height: 2.2,
    paint: ['dark'],
  },
  'desk-lamp': {
    category: 'accessory',
    model: kenney('lampSquareTable'),
    height: 0.58,
    paint: ['lamp'],
  },
  'coffee-mug': { category: 'accessory', model: primitive('mug'), height: 0.14, paint: ['white'] },
  'rubber-duck': {
    category: 'accessory',
    model: primitive('rubberDuck'),
    height: 0.2,
    paint: ['yellow'],
  },
  succulent: { category: 'accessory', model: kenney('plantSmall2'), height: 0.28 },
  'book-stack': {
    category: 'accessory',
    model: kenney('books'),
    height: 0.21,
    paint: ['carpetDarker'],
  },
  'teddy-bear': {
    category: 'accessory',
    model: kenney('bear'),
    height: 0.36,
    scale: [0.4, 0.4, 0.4],
    paint: ['fur'],
  },
  radio: { category: 'accessory', model: kenney('radio'), height: 0.25, scale: [0.55, 0.55, 0.55] },
  'second-screen': {
    category: 'accessory',
    model: kenney('computerScreen'),
    height: 0.4,
    scale: [0.65, 0.65, 0.65],
    paint: ['metalDark'],
  },
  'mini-speaker': {
    category: 'accessory',
    model: kenney('speakerSmall'),
    height: 0.33,
    scale: [0.55, 0.55, 0.55],
  },
  trophy: { category: 'accessory', model: primitive('trophy'), height: 0.32, paint: ['gold'] },
  'desk-headset': {
    category: 'accessory',
    model: primitive('deskHeadset'),
    height: 0.3,
    paint: ['blue'],
  },
  'mini-cactus': {
    category: 'accessory',
    model: primitive('miniCactus'),
    height: 0.23,
    paint: ['terracotta'],
  },
  toaster: {
    category: 'accessory',
    model: kenney('toaster'),
    height: 0.2,
    scale: [0.75, 0.75, 0.75],
    paint: ['metalMedium'],
  },
  blender: {
    category: 'accessory',
    model: kenney('kitchenBlender'),
    height: 0.35,
    scale: [0.75, 0.75, 0.75],
    paint: ['metalMedium'],
  },
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
  accessory: 'accessory' in item && item.accessory === true,
  wall: 'wall' in item && item.wall === true,
  paint: LOOKS[item.id].paint ?? DEFAULT_PAINT,
  petNeed: 'petNeed' in item ? item.petNeed : null,
}));

const byKind = new Map<string, CatalogItem>(CATALOG.map((item) => [item.kind, item]));

export function catalogItem(kind: string): CatalogItem | undefined {
  return byKind.get(kind);
}

/** Emprise d'un objet après rotation (un quart de tour échange largeur et profondeur). */
export function footprint(item: CatalogItem, rotation: number): readonly [number, number] {
  return rotation % 2 === 0 ? item.size : [item.size[1], item.size[0]];
}
