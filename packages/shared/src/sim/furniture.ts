import type { Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';
import type { PetNeed } from './pets.js';

/**
 * Catalogue des objets du mode construction. Chaque objet a un effet réel sur la
 * simulation. Les identifiants sont ceux de la simulation : le rendu les associe à
 * un modèle Kenney (ou à une forme Three.js si le modèle manque) dans son manifeste.
 */

export interface FurnitureEffects {
  /** Café ajouté chaque matin au réapprovisionnement. */
  coffeeRestock?: number;
  /** Moral gagné chaque jour par chaque dev (effet de groupe). */
  moral?: number;
  /** Multiplicateur de productivité pour toute l'équipe (+0.02 = +2 %). */
  teamProductivity?: number;
  /** Bonus de productivité pour `seats` devs. */
  seatProductivity?: number;
  /** Réduction de la fatigue pour `seats` devs (0.15 = −15 %). */
  seatEnergySaving?: number;
  /** Nombre de devs couverts par les effets "seat" et par les casques antibruit. */
  seats?: number;
  /** Protège `seats` devs du malus des réunions du Product Owner. */
  meetingShield?: boolean;
  /** Récupération d'énergie supplémentaire pendant les pauses. */
  restBonus?: number;
  /** Bonus de qualité de toute l'équipe (+0.03 = +3 %). */
  quality?: number;
  hypePerDay?: number;
  stabilityPerDay?: number;
  debtPerDay?: number;
  /** Rend possible l'activité « babyfoot ». */
  babyfoot?: boolean;
}

export interface FurnitureDefinition {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  price: number;
  /** Emprise au sol sur la grille, avant rotation. */
  width: number;
  depth: number;
  /** Phase à partir de laquelle l'objet est en vente. */
  minPhase: Phase;
  /** Nombre maximum d'exemplaires (les effets ne se cumulent pas au-delà). */
  maxCount: number;
  effects: FurnitureEffects;
  /**
   * Meuble à plateau : nombre d'accessoires qu'on peut poser dessus (lampe, mug, canard…).
   * Les emplacements eux-mêmes (position sur le plateau) sont une affaire de rendu.
   */
  surfaceSlots?: number;
  /** Accessoire : il se pose sur un meuble à plateau, jamais au sol. */
  accessory?: boolean;
  /** Équipement pour chat : il en faut un de chaque sorte posé pour adopter (voir `pets.ts`). */
  petNeed?: PetNeed;
}

/**
 * Couleurs proposées pour le mobilier. Purement esthétique : la simulation retient seulement
 * l'identifiant, le rendu choisit la teinte. `natural` garde les couleurs d'origine du modèle.
 */
export const FURNITURE_COLORS = [
  'natural',
  'white',
  'graphite',
  'walnut',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
] as const;
export type FurnitureColor = (typeof FURNITURE_COLORS)[number];

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

export const FURNITURE_CATALOG = [
  {
    id: 'desk',
    name: t('Bureau', 'Desk'),
    description: t(
      'Un vrai bureau : +4 % de productivité pour un dev.',
      'A real desk: +4% productivity for one dev.',
    ),
    price: 300,
    width: 2,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 40,
    effects: { seatProductivity: 0.04, seats: 1 },
    surfaceSlots: 3,
  },
  {
    id: 'ikea-desk',
    name: t('Bureau IKEA', 'IKEA desk'),
    description: t(
      'Monté sans notice. Il penche un peu : +2 % de productivité.',
      'Assembled without the manual. It wobbles: +2% productivity.',
    ),
    price: 80,
    width: 2,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 40,
    effects: { seatProductivity: 0.02, seats: 1 },
    surfaceSlots: 3,
  },
  {
    id: 'ergonomic-chair',
    name: t('Chaise ergonomique', 'Ergonomic chair'),
    description: t(
      '+Endurance : un dev se fatigue 20 % moins vite.',
      '+Endurance: one dev gets tired 20% slower.',
    ),
    price: 450,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 40,
    effects: { seatEnergySaving: 0.2, seats: 1 },
  },
  {
    id: 'coffee-machine',
    name: t('Cafetière', 'Coffee maker'),
    description: t(
      'Le carburant de base : +25 café chaque matin.',
      'Basic fuel: +25 coffee every morning.',
    ),
    price: 150,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 3,
    effects: { coffeeRestock: 25 },
  },
  {
    id: 'premium-coffee-machine',
    name: t('Machine à café premium', 'Premium coffee machine'),
    description: t(
      'Grains torréfiés par un barista de Brooklyn : +50 café, +moral.',
      'Beans roasted by a Brooklyn barista: +50 coffee, +morale.',
    ),
    price: 2500,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 3,
    effects: { coffeeRestock: 50, moral: 0.15 },
  },
  {
    id: 'plant',
    name: t('Plante verte', 'Potted plant'),
    description: t('Léger +moral. Personne ne l’arrose.', 'Slight +morale. Nobody waters it.'),
    price: 60,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 12,
    effects: { moral: 0.08 },
  },
  {
    id: 'small-plant',
    name: t('Cactus en pot', 'Potted cactus'),
    description: t(
      'Absorbe les ondes négatives, paraît-il. Très léger +moral.',
      'Absorbs bad vibes, apparently. Tiny +morale.',
    ),
    price: 20,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 12,
    effects: { moral: 0.03 },
  },
  {
    id: 'microwave',
    name: t('Micro-ondes', 'Microwave'),
    description: t(
      'Pour les ramen de 22h. +moral, +récupération.',
      'For 10pm ramen. +morale, +rest.',
    ),
    price: 120,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 2,
    effects: { moral: 0.1, restBonus: 0.5 },
  },
  {
    id: 'babyfoot',
    name: t('Babyfoot', 'Foosball table'),
    description: t(
      '+Moral, −Productivité. Indispensable pour recruter.',
      '+Morale, −Productivity. Essential for hiring.',
    ),
    price: 1500,
    width: 2,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 2,
    effects: { moral: 0.6, teamProductivity: -0.03, babyfoot: true },
  },
  {
    id: 'noise-headsets',
    name: t('Portant de casques antibruit', 'Noise-cancelling headset stand'),
    description: t(
      'Trois casques partagés : annulent le malus des réunions pour 3 devs.',
      'Three shared headsets: cancel the meeting penalty for 3 devs.',
    ),
    price: 900,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 10,
    effects: { meetingShield: true, seats: 3 },
  },
  {
    id: 'standing-desk',
    name: t('Bureau debout', 'Standing desk'),
    description: t(
      '+5 % de productivité et −10 % de fatigue pour un dev.',
      '+5% productivity and −10% fatigue for one dev.',
    ),
    price: 800,
    width: 2,
    depth: 1,
    minPhase: 'SERIES_A',
    maxCount: 30,
    effects: { seatProductivity: 0.05, seatEnergySaving: 0.1, seats: 1 },
    surfaceSlots: 2,
  },
  {
    id: 'sofa',
    name: t('Canapé', 'Sofa'),
    description: t(
      'Pour les siestes « de réflexion ». +moral, +récupération.',
      'For "thinking" naps. +morale, +rest.',
    ),
    price: 1200,
    width: 2,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 4,
    effects: { moral: 0.15, restBonus: 1 },
  },
  {
    id: 'bookcase',
    name: t('Bibliothèque', 'Bookcase'),
    description: t(
      'Clean Code, Design Patterns... jamais ouverts : +3 % de qualité.',
      'Clean Code, Design Patterns... never opened: +3% quality.',
    ),
    price: 400,
    width: 2,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 3,
    effects: { quality: 0.03 },
    surfaceSlots: 2,
  },
  {
    id: 'tv-dashboard',
    name: t('Écran de métriques', 'Metrics TV'),
    description: t(
      'Les courbes montent, les investisseurs aussi : +hype, −1 % de prod.',
      'Charts go up, so do investors: +hype, −1% productivity.',
    ),
    price: 1800,
    width: 2,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 2,
    effects: { hypePerDay: 0.08, teamProductivity: -0.01 },
  },
  {
    id: 'speaker',
    name: t('Enceinte lo-fi', 'Lo-fi speaker'),
    description: t(
      'Lo-fi beats to code to : +moral, −1 % de prod.',
      'Lo-fi beats to code to: +morale, −1% productivity.',
    ),
    price: 250,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 2,
    effects: { moral: 0.12, teamProductivity: -0.01 },
  },
  {
    id: 'server-rack',
    name: t('Baie de serveurs', 'Server rack'),
    description: t(
      'Le cloud, mais dans le placard : +stabilité chaque jour.',
      'The cloud, but in a closet: +stability every day.',
    ),
    price: 6000,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 4,
    effects: { stabilityPerDay: 0.25 },
    surfaceSlots: 1,
  },
  {
    id: 'trashcan',
    name: t('Poubelle à code mort', 'Dead code bin'),
    description: t(
      'Symbolique mais efficace : −dette chaque jour.',
      'Symbolic but effective: −debt every day.',
    ),
    price: 90,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 2,
    effects: { debtPerDay: -0.08 },
  },
  {
    id: 'rug',
    name: t('Tapis', 'Rug'),
    description: t('Ça fait « cosy ». Très léger +moral.', 'Feels cosy. Tiny +morale.'),
    price: 150,
    width: 2,
    depth: 2,
    minPhase: 'GARAGE',
    maxCount: 4,
    effects: { moral: 0.04 },
  },
  {
    id: 'fridge',
    name: t('Frigo à boissons', 'Drinks fridge'),
    description: t(
      'Club-Mate à volonté : +15 café, +moral.',
      'Unlimited Club-Mate: +15 coffee, +morale.',
    ),
    price: 700,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 2,
    effects: { coffeeRestock: 15, moral: 0.1 },
    surfaceSlots: 1,
  },
  {
    id: 'nap-pod',
    name: t('Sieste-pod', 'Nap pod'),
    description: t(
      'Siestes high-tech : grosse récupération, +moral.',
      'High-tech naps: big rest bonus, +morale.',
    ),
    price: 9000,
    width: 1,
    depth: 2,
    minPhase: 'UNICORN',
    maxCount: 4,
    effects: { moral: 0.2, restBonus: 2 },
  },
  {
    id: 'slide',
    name: t('Toboggan', 'Slide'),
    description: t(
      'Personne ne l’utilise, mais les photos font le buzz : +moral, +hype.',
      'Nobody uses it, but the photos go viral: +morale, +hype.',
    ),
    price: 25000,
    width: 2,
    depth: 3,
    minPhase: 'UNICORN',
    maxCount: 1,
    effects: { moral: 0.5, hypePerDay: 0.15 },
  },
  {
    id: 'canteen-table',
    name: t('Table de cantine', 'Canteen table'),
    description: t('Déjeuners d’équipe : +moral, +10 café.', 'Team lunches: +morale, +10 coffee.'),
    price: 3000,
    width: 3,
    depth: 2,
    minPhase: 'UNICORN',
    maxCount: 4,
    effects: { moral: 0.2, coffeeRestock: 10 },
    surfaceSlots: 4,
  },
  // --- Animaux : l'équipement à poser avant d'adopter un chat (voir `pets.ts`). ---
  {
    id: 'litter-open',
    name: t('Litière ouverte', 'Open litter tray'),
    description: t(
      'Un bac et du sable. Fait l’affaire, mais toute l’équipe le sait : léger −moral.',
      'A tray and some sand. It works, but the whole team knows it: slight −morale.',
    ),
    price: 60,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 5,
    effects: { moral: -0.02 },
    petNeed: 'litter',
  },
  {
    id: 'litter-covered',
    name: t('Litière fermée', 'Covered litter box'),
    description: t(
      'Avec un toit et une porte battante : plus d’odeur, très léger +moral.',
      'With a roof and a flap door: no more smell, tiny +morale.',
    ),
    price: 220,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 5,
    effects: { moral: 0.02 },
    petNeed: 'litter',
  },
  {
    id: 'litter-robot',
    name: t('Litière robot autonome', 'Self-cleaning robot litter'),
    description: t(
      'Se nettoie seule et envoie des notifications push : +moral, +hype.',
      'Cleans itself and sends push notifications: +morale, +hype.',
    ),
    price: 1200,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 5,
    effects: { moral: 0.06, hypePerDay: 0.01 },
    petNeed: 'litter',
  },
  {
    id: 'cat-bowl',
    name: t('Gamelle double eau et croquettes', 'Double water and food bowl'),
    description: t(
      'Deux bols sur un support : l’eau d’un côté, les croquettes de l’autre.',
      'Two bowls on a stand: water on one side, kibble on the other.',
    ),
    price: 40,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 5,
    effects: { moral: 0.01 },
    petNeed: 'bowl',
  },
  {
    id: 'cat-feeder',
    name: t('Fontaine et distributeur', 'Fountain and feeder'),
    description: t(
      'Croquettes à heure fixe et eau qui coule : les chats ne réveillent plus personne. +moral.',
      'Kibble on schedule and running water: cats stop waking people up. +morale.',
    ),
    price: 380,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 5,
    effects: { moral: 0.04 },
    petNeed: 'bowl',
  },
  {
    id: 'cat-tree-small',
    name: t('Arbre à chat compact', 'Compact cat tree'),
    description: t(
      'Un griffoir et un coussin sur une case : les canapés sont épargnés. Léger +moral.',
      'A scratching post and a cushion on one tile: the sofas are spared. Slight +morale.',
    ),
    price: 180,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 4,
    effects: { moral: 0.03 },
    petNeed: 'tree',
  },
  {
    id: 'cat-tree-medium',
    name: t('Arbre à chat double', 'Double cat tree'),
    description: t(
      'Deux tours, un hamac et une niche sur deux cases. +moral.',
      'Two towers, a hammock and a cubby over two tiles. +morale.',
    ),
    price: 450,
    width: 2,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 4,
    effects: { moral: 0.06 },
    petNeed: 'tree',
  },
  {
    id: 'cat-tree-large',
    name: t('Arbre à chat géant', 'Giant cat tree'),
    description: t(
      'Trois tours, trois étages et une vue sur tout l’open space : +moral, +hype.',
      'Three towers, three levels and a view of the whole office: +morale, +hype.',
    ),
    price: 1100,
    width: 3,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 4,
    effects: { moral: 0.1, hypePerDay: 0.02 },
    petNeed: 'tree',
  },
  // --- Accessoires : posés sur les meubles à plateau (bureaux, bibliothèque, frigo…). ---
  {
    id: 'desk-lamp',
    name: t('Lampe de bureau', 'Desk lamp'),
    description: t(
      'On voit enfin les bugs : +0,5 % de qualité. Se pose sur un meuble.',
      'Bugs are finally visible: +0.5% quality. Goes on furniture.',
    ),
    price: 40,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 6,
    accessory: true,
    effects: { quality: 0.005 },
  },
  {
    id: 'coffee-mug',
    name: t('Mug « It works on my machine »', '"It works on my machine" mug'),
    description: t(
      'Toujours à moitié plein de café froid : +2 café chaque matin.',
      'Always half full of cold coffee: +2 coffee every morning.',
    ),
    price: 15,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 10,
    accessory: true,
    effects: { coffeeRestock: 2 },
  },
  {
    id: 'rubber-duck',
    name: t('Canard en plastique', 'Rubber duck'),
    description: t(
      'Rubber duck debugging : on lui explique le bug, il le résout. −dette chaque jour.',
      'Rubber duck debugging: explain the bug, it fixes it. −debt every day.',
    ),
    price: 10,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 5,
    accessory: true,
    effects: { debtPerDay: -0.02 },
  },
  {
    id: 'succulent',
    name: t('Succulente', 'Succulent'),
    description: t(
      'La seule plante qui survit au code review. Très léger +moral.',
      'The only plant that survives code review. Tiny +morale.',
    ),
    price: 25,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 10,
    accessory: true,
    effects: { moral: 0.02 },
  },
  {
    id: 'book-stack',
    name: t('Pile de livres', 'Stack of books'),
    description: t(
      'Sert surtout à surélever l’écran : +0,4 % de qualité.',
      'Mostly used to raise the monitor: +0.4% quality.',
    ),
    price: 35,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 6,
    accessory: true,
    effects: { quality: 0.004 },
  },
  {
    id: 'teddy-bear',
    name: t('Nounours', 'Teddy bear'),
    description: t('Pour les rétros difficiles. +moral.', 'For tough retrospectives. +morale.'),
    price: 30,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 4,
    accessory: true,
    effects: { moral: 0.03 },
  },
  {
    id: 'radio',
    name: t('Radio vintage', 'Vintage radio'),
    description: t(
      'Les infos tech en continu : +moral, −0,3 % de prod.',
      'Non-stop tech news: +morale, −0.3% productivity.',
    ),
    price: 60,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 3,
    accessory: true,
    effects: { moral: 0.04, teamProductivity: -0.003 },
  },
  {
    id: 'second-screen',
    name: t('Deuxième écran', 'Second monitor'),
    description: t(
      'Un écran pour le code, un pour Slack : +0,4 % de productivité.',
      'One screen for code, one for Slack: +0.4% productivity.',
    ),
    price: 250,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 10,
    accessory: true,
    effects: { teamProductivity: 0.004 },
  },
  {
    id: 'mini-speaker',
    name: t('Petite enceinte Bluetooth', 'Bluetooth speaker'),
    description: t(
      'Se connecte toujours au mauvais téléphone. Léger +moral.',
      'Always pairs with the wrong phone. Slight +morale.',
    ),
    price: 45,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 3,
    accessory: true,
    effects: { moral: 0.02 },
  },
  {
    id: 'trophy',
    name: t('Trophée de hackathon', 'Hackathon trophy'),
    description: t(
      'Gagné en 2019 avec une todo-list en blockchain : +hype.',
      'Won in 2019 with a blockchain to-do list: +hype.',
    ),
    price: 120,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 3,
    accessory: true,
    effects: { hypePerDay: 0.02 },
  },
  {
    id: 'toaster',
    name: t('Grille-pain', 'Toaster'),
    description: t(
      'Odeur de pain grillé dans l’open space : +moral.',
      'Smell of toast across the open space: +morale.',
    ),
    price: 50,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 2,
    accessory: true,
    effects: { moral: 0.03 },
  },
  {
    id: 'desk-headset',
    name: t('Casque antibruit', 'Noise-cancelling headset'),
    description: t(
      'Posé sur le bureau, prêt pour la prochaine réunion : annule son malus pour 1 dev.',
      'Sitting on the desk, ready for the next meeting: cancels its penalty for 1 dev.',
    ),
    price: 320,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 30,
    accessory: true,
    effects: { meetingShield: true, seats: 1 },
  },
  {
    id: 'mini-cactus',
    name: t('Mini-cactus', 'Mini cactus'),
    description: t(
      'Ne pique que ceux qui touchent au clavier des autres. Très léger +moral.',
      'Only pricks people who touch other people’s keyboards. Tiny +morale.',
    ),
    price: 12,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 15,
    accessory: true,
    effects: { moral: 0.015 },
  },
  {
    id: 'blender',
    name: t('Blender à smoothies', 'Smoothie blender'),
    description: t(
      'Kale, gingembre, spiruline. +moral, +3 café (oui, c’est du café).',
      'Kale, ginger, spirulina. +morale, +3 coffee (yes, it counts).',
    ),
    price: 90,
    width: 1,
    depth: 1,
    minPhase: 'SERIES_A',
    maxCount: 2,
    accessory: true,
    effects: { moral: 0.03, coffeeRestock: 3 },
  },
] as const satisfies readonly FurnitureDefinition[];

export type FurnitureId = (typeof FURNITURE_CATALOG)[number]['id'];

const BY_ID = new Map<string, FurnitureDefinition>(
  FURNITURE_CATALOG.map((item) => [item.id, item]),
);

/** Définition d'un objet, ou `undefined` si l'identifiant est inconnu. */
export function getFurniture(id: string): FurnitureDefinition | undefined {
  return BY_ID.get(id);
}
