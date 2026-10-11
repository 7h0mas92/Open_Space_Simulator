/**
 * Catalogue des objets du mode construction, vu par le rendu et l'interface.
 *
 * La simulation est seule juge des règles : identifiants, prix, emprise, phase de déblocage et
 * effets viennent de `FURNITURE_CATALOG` (`@oss/shared`). Ce fichier n'y ajoute que l'habillage :
 * le modèle Kenney (ou la forme Three.js si le modèle manque), la hauteur visée, la catégorie
 * de la boutique et le point d'intérêt que l'IA des personnages peut utiliser.
 */
import {
  FURNITURE_CATALOG,
  type LocalizedText,
  type PetNeed,
  type Phase,
  type ServerGearKind,
} from '@oss/shared';
import type { FurnitureModel, MissingAssetId } from '../render/assetManifest';

export type ItemModel =
  | { readonly source: 'kenney'; readonly model: FurnitureModel }
  | { readonly source: 'primitive'; readonly model: MissingAssetId };

export const ITEM_CATEGORIES = [
  'work',
  'comfort',
  'kitchen',
  'appliance',
  'fun',
  'decor',
  'pets',
  'partition',
  'window',
  'accessory',
  'devices',
  'servers',
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
   * Poste de travail : où poser l'ordinateur choisi (voir `COMPUTERS` de la simulation).
   * `keyboard` : le clavier QWERTY, ou le portable qui le remplace [x, plateau, z] ;
   * `tower` : la tour au sol [x, z de l'avant du bureau], sa façade alignée sur ce bord.
   */
  readonly workstation?: {
    readonly keyboard: readonly [number, number, number];
    readonly tower: readonly [number, number];
  };
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
  /**
   * Arbre à chat : pompons sous lesquels un chat joue [x, hauteur, z], dans le repère du meuble.
   * Le chat se dresse devant le socle et tape la balle.
   */
  readonly toys?: readonly (readonly [number, number, number])[];
  /**
   * Gamelle : où le chat se tient pour manger et pour boire [x, z], dans le repère du meuble.
   * Il regarde vers l'arrière du meuble (-z), la tête au-dessus du bol.
   */
  readonly feeding?: {
    readonly food: readonly [number, number];
    readonly water: readonly [number, number];
  };
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
  /** Appareil électroménager : seulement sur les premiers emplacements prévus pour lui. */
  readonly appliance: boolean;
  /** Meuble à plateau : nombre de ses premiers emplacements qui acceptent un appareil. */
  readonly applianceSlots: number;
  /** Fenêtre : se fixe dans un mur du fond (rotation 0 : mur du fond, 1 : mur de gauche). */
  readonly wall: boolean;
  /** Mur fin posé au sol (plein ou vitré), raccordé aux murs voisins, sinon `null`. */
  readonly partition: 'solid' | 'glass' | null;
  /** Fixé au plafond : ne gêne ni le mobilier ni les passages. */
  readonly ceiling: boolean;
  readonly paint: readonly string[];
  /** Équipement pour chat (litière, gamelle, arbre à chat), sinon `null`. */
  readonly petNeed: PetNeed | null;
  /** Salle des serveurs : ses emplacements n'accueillent que le matériel serveur. */
  readonly serverRoom: boolean;
  /** Matériel de la salle des serveurs : sa famille, sinon `null`. */
  readonly serverGear: ServerGearKind | null;
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
/** Plan de travail des meubles de cuisine (voir `render/kitchenFurniture.ts`). */
const COUNTER_TOP = 0.9;
const ISLAND_TOP = 0.92;
const NICHE_FLOOR = 1.02;
/** Dessus du sol technique des salles des serveurs (voir `render/serverRoom.ts`). */
const RAISED_FLOOR = 0.06;
/** Une baie fait 0,55 de large : trois au fond du local, une contre le mur de gauche. */
const CLOSET_SLOTS = [
  [-0.6, RAISED_FLOOR, -0.5],
  [0, RAISED_FLOOR, -0.5],
  [0.6, RAISED_FLOOR, -0.5],
  [-0.6, RAISED_FLOOR, 0.42],
] as const;
/** Deux rangées de quatre baies, l'allée devant la porte. */
const ROOM_SLOTS = [-1.35, -0.45, 0.45, 1.35].flatMap((x) => [
  [x, RAISED_FLOOR, -1.0] as const,
  [x, RAISED_FLOOR, 0.1] as const,
]);
/** Matériel d'une salle des serveurs : armoires non repeignables, sur le sol technique. */
const gear = (model: MissingAssetId, height: number): ItemLook => ({
  category: 'servers',
  model: primitive(model),
  height,
  paint: [],
});

/** Deux places côte à côte sur un meuble bas d'une case, chacune assez large pour un appareil. */
const COUNTER_SLOTS = [
  [-0.2, COUNTER_TOP, -0.03],
  [0.21, COUNTER_TOP, -0.03],
] as const;
/**
 * Épaisseur du tapis de souris (`mousePad`) et taille de la souris Kenney posée dessus : réduite
 * pour rester à l'échelle du clavier QWERTY (environ 7 x 12 cm). Le modèle Kenney part de son
 * origine vers l'arrière : `MOUSE_BACK` le recentre sur le tapis.
 */
const MOUSE_PAD = 0.012;
const MOUSE_SCALE: readonly [number, number, number] = [0.7, 0.7, 0.7];
const MOUSE_BACK = 0.06;

type SimItemId = (typeof FURNITURE_CATALOG)[number]['id'];

/**
 * Chaise posée devant chaque bureau (case d'accès), repeinte à la couleur du bureau : ce n'est
 * pas un objet du catalogue, `office.ts` l'ajoute d'office.
 */
export const DESK_CHAIR: { readonly model: MissingAssetId; readonly paint: readonly string[] } = {
  model: 'officeChair',
  paint: ['chairFabric'],
};

/** Habillage de chaque objet de la simulation (le typage oblige à n'en oublier aucun). */
const LOOKS: Record<SimItemId, ItemLook> = {
  // Bureau de dev : souris. L'écran (`render/monitors.ts`) et l'ordinateur se choisissent à part.
  desk: {
    category: 'work',
    model: primitive('officeDesk'),
    height: 0.75,
    use: 'desk',
    parts: [
      // La souris sur un tapis sombre qui la détache du plateau.
      part(primitive('mousePad'), [0.08, DESK_TOP, 0.15]),
      part(kenney('computerMouse'), [0.08, DESK_TOP + MOUSE_PAD, 0.15 + MOUSE_BACK], {
        scale: MOUSE_SCALE,
      }),
    ],
    // Clavier QWERTY à vraies touches (ou portable), tour sous le plateau entre les genoux et
    // le caisson : ils dépendent de l'ordinateur choisi, `render/office.ts` les ajoute.
    workstation: { keyboard: [-0.35, DESK_TOP, 0.17], tower: [0.08, 0.38] },
    surface: [
      [0.3, DESK_TOP, -0.18],
      [0.55, DESK_TOP, 0.12],
      [0.75, DESK_TOP, -0.18],
    ],
  },
  // Le bureau du garage : tréteaux, un portable avec sa souris et des ramen.
  'ikea-desk': {
    category: 'work',
    model: primitive('trestleDesk'),
    height: 0.65,
    paint: ['birch', 'birchDark'],
    use: 'desk',
    parts: [
      part(kenney('laptop'), [-0.3, TRESTLE_TOP, 0], { turn: 0 }),
      part(primitive('mousePad'), [0.14, TRESTLE_TOP, 0.12]),
      part(kenney('computerMouse'), [0.14, TRESTLE_TOP + MOUSE_PAD, 0.12 + MOUSE_BACK], {
        scale: MOUSE_SCALE,
      }),
      part(primitive('ramen'), [0.45, TRESTLE_TOP, 0.05]),
    ],
    // La première place, au bout du plateau, peut recevoir un appareil (la cafetière du garage).
    surface: [
      [0.76, TRESTLE_TOP, -0.15],
      [-0.68, TRESTLE_TOP, -0.2],
      [0.12, TRESTLE_TOP, -0.22],
    ],
  },
  'standing-desk': {
    category: 'work',
    model: primitive('standingDesk'),
    height: 1.1,
    use: 'desk',
    paint: ['white'],
    // Le même poste que le bureau de dev : clavier QWERTY (ou portable), souris sur son tapis,
    // tour au sol sous le côté gauche du plateau.
    workstation: { keyboard: [0, STANDING_TOP, 0.12], tower: [-0.5, 0.36] },
    parts: [
      part(primitive('mousePad'), [0.43, STANDING_TOP, 0.12]),
      part(kenney('computerMouse'), [0.43, STANDING_TOP + MOUSE_PAD, 0.12 + MOUSE_BACK], {
        scale: MOUSE_SCALE,
      }),
    ],
    surface: [
      [-0.65, STANDING_TOP, -0.12],
      [0.65, STANDING_TOP, -0.12],
    ],
  },
  'ergonomic-chair': {
    category: 'work',
    model: primitive('ergonomicChair'),
    height: 1.2,
    paint: ['chairFabric'],
  },
  'earbuds-dock': {
    category: 'work',
    model: primitive('earbudsDock'),
    height: 1.2,
    paint: ['dark'],
  },
  // Bibliothèque en bois : livres un par un, placard, paniers, plante, cadre et trophée.
  bookcase: {
    category: 'work',
    model: primitive('bookcase'),
    height: 1.6,
    paint: ['wood', 'woodDark'],
    surface: [
      [-0.45, BOOKCASE_TOP, 0],
      [0.45, BOOKCASE_TOP, 0],
    ],
  },
  'tv-dashboard': {
    category: 'work',
    model: primitive('mediaConsole'),
    height: 1.5,
    parts: [part(primitive('metricsScreen'), [0, TV_CABINET_TOP, -0.05])],
  },
  // Écrans de projection : seul le caisson est un gabarit, la toile est animée à part.
  'projection-screen-small': {
    category: 'devices',
    model: primitive('projectionScreenSmall'),
    height: 0.13,
    paint: ['dark'],
  },
  'projection-screen-medium': {
    category: 'devices',
    model: primitive('projectionScreenMedium'),
    height: 0.13,
    paint: ['dark'],
  },
  'projection-screen-large': {
    category: 'devices',
    model: primitive('projectionScreenLarge'),
    height: 0.13,
    paint: ['dark'],
  },
  'server-rack': {
    category: 'work',
    model: primitive('serverRack'),
    height: 1.9,
    paint: [],
    surface: [[0, 1.875, 0]],
  },
  // Frigo à boissons vitré : bandeau lumineux, clayettes de canettes et de bouteilles.
  fridge: {
    category: 'kitchen',
    model: primitive('drinksFridge'),
    height: 1.85,
    use: 'coffee',
    paint: ['red'],
    surface: [[0, 1.82, -0.04]],
  },
  // Meubles de cuisine : plans de travail vides, les appareils se posent dessus.
  'kitchen-drawers': {
    category: 'kitchen',
    model: primitive('drawerCabinet'),
    height: 0.9,
    paint: ['cabinet'],
    surface: COUNTER_SLOTS,
  },
  'kitchen-doors': {
    category: 'kitchen',
    model: primitive('doorCabinet'),
    height: 0.9,
    paint: ['cabinet'],
    surface: COUNTER_SLOTS,
  },
  // Évier sur deux cases : bac et robinet à gauche, deux places à droite.
  'kitchen-sink': {
    category: 'kitchen',
    model: primitive('sinkUnit'),
    height: 1.2,
    paint: ['cabinet'],
    surface: [
      [0.22, COUNTER_TOP, -0.03],
      [0.68, COUNTER_TOP, -0.03],
    ],
  },
  // Colonne : l'appareil s'encastre dans la niche, à hauteur des yeux.
  'kitchen-tall': {
    category: 'kitchen',
    model: primitive('tallCabinet'),
    height: 2.1,
    paint: ['cabinet'],
    surface: [[0, NICHE_FLOOR, 0.02]],
  },
  // Buffet : vitrine haute en retrait, deux places devant la crédence.
  'kitchen-hutch': {
    category: 'kitchen',
    model: primitive('hutchCabinet'),
    height: 2.07,
    paint: ['cabinet'],
    surface: [
      [-0.2, COUNTER_TOP, 0.05],
      [0.21, COUNTER_TOP, 0.05],
    ],
  },
  'kitchen-island': {
    category: 'kitchen',
    model: primitive('kitchenIsland'),
    height: 0.92,
    paint: ['cabinet'],
    surface: [
      [-0.6, ISLAND_TOP, 0],
      [0, ISLAND_TOP, 0],
      [0.6, ISLAND_TOP, 0],
    ],
  },
  // Électroménager : chaque appareil tient dans la moitié d'un plan de travail.
  'drip-coffee-maker': {
    category: 'appliance',
    model: primitive('dripCoffeeMaker'),
    height: 0.46,
    use: 'coffee',
    paint: ['dark'],
  },
  'espresso-machine': {
    category: 'appliance',
    model: primitive('espressoMachine'),
    height: 0.47,
    use: 'coffee',
    paint: ['red'],
  },
  'microwave-oven': {
    category: 'appliance',
    model: primitive('microwaveOven'),
    height: 0.26,
    paint: ['white'],
  },
  kettle: {
    category: 'appliance',
    model: primitive('electricKettle'),
    height: 0.24,
    paint: ['mint'],
  },
  'rice-cooker': {
    category: 'appliance',
    model: primitive('riceCooker'),
    height: 0.24,
    paint: ['ceramic'],
  },
  // Grande tablée en planches, piètement acier et deux bancs capitonnés repeignables.
  'canteen-table': {
    category: 'kitchen',
    model: primitive('canteenTable'),
    height: 0.7,
    use: 'meeting',
    paint: ['cushion'],
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
  // Enceinte colonne en noyer : deux boomers, tweeter, évent et pointes.
  speaker: { category: 'fun', model: primitive('floorSpeaker'), height: 1.25 },
  slide: { category: 'fun', model: primitive('slide'), height: 2, paint: ['red'] },
  // Décor des annexes (`render/annexDecor.ts`), offert à leur ouverture et aussi en vente.
  'arcade-cabinet': {
    category: 'fun',
    model: primitive('arcadeCabinet'),
    height: 1.65,
    paint: [],
  },
  pinball: { category: 'fun', model: primitive('pinballMachine'), height: 1.4, paint: [] },
  stage: { category: 'fun', model: primitive('smallStage'), height: 1.3 },
  lectern: { category: 'fun', model: primitive('lectern'), height: 1.2 },
  'neon-sign': { category: 'decor', model: primitive('neonSign'), height: 2, paint: [] },
  'indoor-tree': {
    category: 'decor',
    model: primitive('indoorTree'),
    height: 2.1,
    paint: ['terracotta'],
  },
  fountain: { category: 'decor', model: primitive('zenFountain'), height: 1.1, paint: [] },
  bench: { category: 'comfort', model: kenney('bench'), height: 0.5 },
  'auditorium-screen': {
    category: 'fun',
    model: primitive('auditoriumScreen'),
    height: 2.05,
    paint: [],
  },
  // Canapé en tissu : coussins, accoudoirs roulés, pieds en bois, coussins décoratifs, plaid.
  sofa: {
    category: 'comfort',
    model: primitive('sofa'),
    height: 0.9,
    use: 'rest',
    paint: ['fabric', 'fabricDark'],
  },
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
  // Plantes d'intérieur dessinées feuille par feuille (`render/plants.ts`) : seul le pot se repeint.
  'snake-plant': {
    category: 'decor',
    model: primitive('snakePlant'),
    height: 0.8,
    paint: ['ceramic'],
  },
  pothos: { category: 'decor', model: primitive('pothos'), height: 0.8, paint: ['terracotta'] },
  bonsai: { category: 'decor', model: primitive('bonsai'), height: 0.9, paint: ['slate'] },
  'fiddle-leaf-fig': {
    category: 'decor',
    model: primitive('fiddleLeafFig'),
    height: 2.05,
    paint: ['concrete'],
  },
  'kentia-palm': {
    category: 'decor',
    model: primitive('kentiaPalm'),
    height: 2,
    paint: ['ceramic'],
  },
  'olive-tree': {
    category: 'decor',
    model: primitive('oliveTree'),
    height: 1.7,
    paint: ['terracotta'],
  },
  'planter-box': {
    category: 'decor',
    model: primitive('planterBox'),
    height: 1.4,
    paint: ['wood', 'woodDark'],
  },
  'giant-monstera': {
    category: 'decor',
    model: primitive('giantMonstera'),
    height: 1.75,
    paint: ['wicker', 'sisal'],
  },
  // Tapis rond à bordure, médaillon et losanges ; plat, on marche dessus.
  rug: { category: 'decor', model: primitive('roundRug'), height: 0.02, paint: ['rug'] },
  // Poubelle à pédale en inox, et la boule de papier qui l'a ratée.
  trashcan: { category: 'decor', model: primitive('pedalBin'), height: 0.85, paint: ['metal'] },
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
  'cat-bowl': {
    category: 'pets',
    model: primitive('catBowl'),
    height: 0.16,
    paint: ['wood'],
    feeding: { food: [0.15, 0.42], water: [-0.15, 0.42] },
  },
  'cat-feeder': {
    category: 'pets',
    model: primitive('catFeeder'),
    height: 0.5,
    paint: ['white'],
    feeding: { food: [-0.18, 0.46], water: [0.18, 0.46] },
  },
  'cat-tree-small': {
    category: 'pets',
    model: primitive('catTreeSmall'),
    height: 0.96,
    paint: ['plush'],
    perches: [[0, 0.88, 0]],
    toys: [[0.24, 0, 0.46]],
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
    toys: [[0.15, 0, 0.46]],
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
    toys: [
      [0.25, 0, 0.46],
      [1.2, 0, 0.48],
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
  // Murs fins posés case par case (voir `render/partitions.ts`) : le plâtre, ou le cadre du
  // vitrage, se repeint.
  'thin-wall': {
    category: 'partition',
    model: primitive('thinWall'),
    height: 1.3,
    paint: ['plaster'],
  },
  'glass-partition': {
    category: 'partition',
    model: primitive('glassPartition'),
    height: 2.2,
    paint: ['metal'],
  },
  // Lampe d'architecte : socle lesté, bras à ressorts, abat-jour penché, ampoule allumée.
  'desk-lamp': {
    category: 'accessory',
    model: primitive('deskLamp'),
    height: 0.58,
    paint: ['mint'],
  },
  'coffee-mug': { category: 'accessory', model: primitive('mug'), height: 0.14, paint: ['white'] },
  'rubber-duck': {
    category: 'accessory',
    model: primitive('rubberDuck'),
    height: 0.2,
    paint: ['yellow'],
  },
  succulent: { category: 'accessory', model: kenney('plantSmall2'), height: 0.28 },
  // Livres reliés de travers, tranches crème ; le livre du dessus se repeint.
  'book-stack': {
    category: 'accessory',
    model: primitive('bookStack'),
    height: 0.21,
    paint: ['purple'],
  },
  'teddy-bear': {
    category: 'accessory',
    model: primitive('teddyBear'),
    height: 0.36,
    paint: ['teddy'],
  },
  radio: { category: 'accessory', model: primitive('retroRadio'), height: 0.25 },
  // Deuxième écran avec un tableau de bord allumé.
  'second-screen': {
    category: 'accessory',
    model: primitive('secondScreen'),
    height: 0.4,
    paint: ['dark'],
  },
  // Vidéoprojecteur suspendu : tige et platine au plafond, boîtier tête en bas.
  'ceiling-projector': {
    category: 'devices',
    model: primitive('ceilingProjector'),
    height: 2.2,
    paint: ['white'],
  },
  // Vidéoprojecteur : posé sur un meuble, tourné vers un écran déroulant.
  projector: {
    category: 'devices',
    model: primitive('videoProjector'),
    height: 0.1,
    paint: ['white'],
  },
  'mini-speaker': { category: 'accessory', model: primitive('miniSpeaker'), height: 0.33 },
  trophy: { category: 'accessory', model: primitive('trophy'), height: 0.32, paint: ['gold'] },
  'desk-earbuds': {
    category: 'accessory',
    model: primitive('deskEarbuds'),
    height: 0.14,
    paint: ['white'],
  },
  'mini-cactus': {
    category: 'accessory',
    model: primitive('miniCactus'),
    height: 0.23,
    paint: ['terracotta'],
  },
  toaster: {
    category: 'appliance',
    model: primitive('chromeToaster'),
    height: 0.2,
    paint: ['chrome'],
  },
  blender: {
    category: 'appliance',
    model: primitive('smoothieBlender'),
    height: 0.35,
    paint: ['red'],
  },
  // Salles des serveurs : sol technique, cloisons vitrées, porte à badge.
  'server-closet': {
    category: 'servers',
    model: primitive('serverCloset'),
    height: 2.1,
    paint: [],
    surface: CLOSET_SLOTS,
  },
  'server-room': {
    category: 'servers',
    model: primitive('serverRoom'),
    height: 2.1,
    paint: [],
    surface: ROOM_SLOTS,
  },
  'rack-server': gear('rackServer', 1.9),
  'blade-server': gear('bladeServer', 1.9),
  'gpu-server': gear('gpuServer', 1.9),
  'network-switch': gear('networkSwitch', 1.6),
  'fibre-router': gear('fibreRouter', 1.2),
  'precision-cooling': gear('precisionCooling', 1.95),
  'ups-unit': gear('upsUnit', 1.05),
  'backup-nas': gear('backupNas', 1.4),
  firewall: gear('firewallUnit', 1.2),
  'fire-suppression': gear('fireSuppression', 1.7),
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
  appliance: 'appliance' in item && item.appliance === true,
  applianceSlots: 'applianceSlots' in item ? item.applianceSlots : 0,
  wall: 'wall' in item && item.wall === true,
  partition: 'partition' in item ? item.partition : null,
  ceiling: 'ceiling' in item && item.ceiling === true,
  paint: LOOKS[item.id].paint ?? DEFAULT_PAINT,
  petNeed: 'petNeed' in item ? item.petNeed : null,
  serverRoom: 'serverRoom' in item && item.serverRoom === true,
  serverGear: 'serverGear' in item ? item.serverGear : null,
}));

const byKind = new Map<string, CatalogItem>(CATALOG.map((item) => [item.kind, item]));

export function catalogItem(kind: string): CatalogItem | undefined {
  return byKind.get(kind);
}

/** Emprise d'un objet après rotation (un quart de tour échange largeur et profondeur). */
export function footprint(item: CatalogItem, rotation: number): readonly [number, number] {
  return rotation % 2 === 0 ? item.size : [item.size[1], item.size[0]];
}
