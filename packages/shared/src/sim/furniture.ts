import type { Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';
import type { PetNeed } from './pets.js';
import type { ServerGearKind } from './serverRoom.js';

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
  /** Nombre de devs couverts par les effets "seat" et par les écouteurs à réduction de bruit. */
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
  /**
   * Serveur d'une salle qui tourne : part de la facture d'hébergement épargnée (0.06 = -6 %),
   * plafonnée au total (voir `HOSTING_SAVING_MAX` dans `serverRoom.ts`).
   */
  hostingSaving?: number;
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
  /**
   * Meuble à plateau : combien de ses emplacements, en commençant par le premier, sont assez
   * grands pour un appareil électroménager (micro-ondes, cafetière…). Tous ceux d'un meuble de
   * cuisine, aucun par défaut.
   */
  applianceSlots?: number;
  /** Accessoire : il se pose sur un meuble à plateau, jamais au sol. */
  accessory?: boolean;
  /**
   * Appareil électroménager : un accessoire encombrant, posé seulement sur un emplacement prévu
   * pour lui (voir `applianceSlots`), surtout sur les meubles de cuisine.
   */
  appliance?: boolean;
  /** Équipement pour chat : il en faut un de chaque sorte posé pour adopter (voir `pets.ts`). */
  petNeed?: PetNeed;
  /**
   * Fenêtre : elle se fixe dans un des deux murs du fond, jamais au sol. `width` est sa largeur
   * en cases le long du mur ; la rotation dit lequel : 0 pour le mur du fond (y = 0), 1 pour le
   * mur de gauche (x = 0). Elle ne gêne pas le mobilier posé devant.
   */
  wall?: boolean;
  /**
   * Poste de travail à écran : l'écran se choisit à part (modèle, taille, pied ou bras, voir
   * `monitors.ts`). Sans choix, c'est l'écran bureautique livré avec le bureau.
   */
  monitor?: boolean;
  /**
   * Projecteur : un accessoire que le joueur allume ou éteint. Ses effets ne comptent que s'il
   * est allumé et projette sur un écran déroulé (voir `projection.ts`).
   */
  projector?: boolean;
  /**
   * Écran de projection déroulant : posé au sol, la toile sort de son caisson quand un projecteur
   * allumé le vise. Enroulé, il ne donne aucun effet.
   */
  projectionScreen?: boolean;
  /**
   * Mur fin posé au sol, sur une case, comme les cloisons du plan : plein (`solid`, à
   * mi-hauteur) ou vitré du sol au plafond (`glass`). La rotation dit son sens : 0 le long de x,
   * 1 le long de z. Il bloque le passage ; le rendu le raccorde aux murs voisins.
   */
  partition?: 'solid' | 'glass';
  /**
   * Fixé au plafond : il occupe une case en hauteur et ne gêne ni le mobilier ni les passages.
   * Seuls les autres objets du plafond l'empêchent d'être posé.
   */
  ceiling?: boolean;
  /**
   * Salle des serveurs : un local vitré posé au sol. Ses emplacements (`surfaceSlots`)
   * n'accueillent que du matériel serveur, et ce matériel ne se pose nulle part ailleurs.
   */
  serverRoom?: boolean;
  /**
   * Matériel de la salle des serveurs (accessoire) : sa famille. Ses effets ne comptent que si
   * sa salle tourne (serveur, réseau et climatisation installés, voir `serverRoom.ts`).
   */
  serverGear?: ServerGearKind;
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
    monitor: true,
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
    // Au garage, la cafetière trône sur le bureau, entre le portable et les ramen.
    applianceSlots: 1,
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
  // --- Plantes d'intérieur : des petites, des grandes et des grosses (formes dans `plants.ts`). ---
  {
    id: 'snake-plant',
    name: t('Sansevieria', 'Snake plant'),
    description: t(
      'Survit à tout, même au stagiaire qui l’arrose au Red Bull. Léger +moral.',
      'Survives anything, even the intern who waters it with Red Bull. Slight +morale.',
    ),
    price: 45,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 12,
    effects: { moral: 0.05 },
  },
  {
    id: 'pothos',
    name: t('Pothos sur sellette', 'Pothos on a stand'),
    description: t(
      'Ses lianes poussent plus vite que la roadmap. Léger +moral.',
      'Its vines grow faster than the roadmap. Slight +morale.',
    ),
    price: 70,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 12,
    effects: { moral: 0.06 },
  },
  {
    id: 'bonsai',
    name: t('Bonsaï', 'Bonsai'),
    description: t(
      'Taillé à la pince à épiler pendant les builds de 40 minutes : +moral, +0,4 % de qualité.',
      'Trimmed with tweezers during 40-minute builds: +morale, +0.4% quality.',
    ),
    price: 140,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 6,
    effects: { moral: 0.03, quality: 0.004 },
  },
  {
    id: 'fiddle-leaf-fig',
    name: t('Figuier lyre', 'Fiddle-leaf fig'),
    description: t(
      'La grande plante de toutes les photos de bureaux sur LinkedIn : +moral, +hype.',
      'The tall plant in every office photo on LinkedIn: +morale, +hype.',
    ),
    price: 380,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 8,
    effects: { moral: 0.12, hypePerDay: 0.005 },
  },
  {
    id: 'kentia-palm',
    name: t('Palmier kentia', 'Kentia palm'),
    description: t(
      'Deux mètres de vacances au coin de l’open space : +moral, +récupération.',
      'Two metres of holiday in the corner of the office: +morale, +rest.',
    ),
    price: 550,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 8,
    effects: { moral: 0.12, restBonus: 0.2 },
  },
  {
    id: 'olive-tree',
    name: t('Olivier centenaire', 'Ancient olive tree'),
    description: t(
      'Cent ans, venu de Provence en camion : il en a vu d’autres. +moral, +récupération.',
      'A hundred years old, trucked in from Provence: it has seen worse. +morale, +rest.',
    ),
    price: 900,
    width: 1,
    depth: 1,
    minPhase: 'SERIES_A',
    maxCount: 6,
    effects: { moral: 0.15, restBonus: 0.3 },
  },
  {
    id: 'planter-box',
    name: t('Jardinière de séparation', 'Planter divider'),
    description: t(
      'Trois cases d’herbes hautes entre deux équipes : moins de bruit, +moral, +0,5 % de prod.',
      'Three tiles of tall grass between two teams: less noise, +morale, +0.5% productivity.',
    ),
    price: 1200,
    width: 3,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 6,
    effects: { moral: 0.18, teamProductivity: 0.005 },
  },
  {
    id: 'giant-monstera',
    name: t('Monstera géante', 'Giant monstera'),
    description: t(
      'Quatre cases de feuilles géantes, on s’y cache pour les visios : +moral, +hype.',
      'Four tiles of huge leaves, people hide in it for video calls: +morale, +hype.',
    ),
    price: 1600,
    width: 2,
    depth: 2,
    minPhase: 'SERIES_A',
    maxCount: 4,
    effects: { moral: 0.3, hypePerDay: 0.02 },
  },
  // --- Meubles de cuisine : des plans de travail où poser l'électroménager (voir plus bas). ---
  {
    id: 'kitchen-drawers',
    name: t('Meuble bas à tiroirs', 'Drawer base cabinet'),
    description: t(
      'Trois tiroirs : couverts, sachets de ketchup et câbles USB orphelins. Léger +moral.',
      'Three drawers: cutlery, ketchup packets and orphan USB cables. Slight +morale.',
    ),
    price: 160,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 12,
    effects: { moral: 0.02 },
    surfaceSlots: 2,
    applianceSlots: 2,
  },
  {
    id: 'kitchen-doors',
    name: t('Meuble bas à portes', 'Door base cabinet'),
    description: t(
      'Deux portes, une étagère, quarante mugs dépareillés. Léger +moral.',
      'Two doors, one shelf, forty mismatched mugs. Slight +morale.',
    ),
    price: 140,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 12,
    effects: { moral: 0.02 },
    surfaceSlots: 2,
    applianceSlots: 2,
  },
  {
    id: 'kitchen-sink',
    name: t('Meuble évier', 'Sink unit'),
    description: t(
      'Un évier, un égouttoir, et enfin des mugs propres : +moral, +récupération.',
      'A sink, a drying rack, and clean mugs at last: +morale, +rest.',
    ),
    price: 650,
    width: 2,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 4,
    effects: { moral: 0.06, restBonus: 0.1 },
    surfaceSlots: 2,
    applianceSlots: 2,
  },
  {
    id: 'kitchen-tall',
    name: t('Colonne à niche', 'Tall cabinet with niche'),
    description: t(
      'Du sol au plafond, avec une niche pour encastrer un appareil. +moral.',
      'Floor to ceiling, with a niche to build an appliance into. +morale.',
    ),
    price: 480,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 6,
    effects: { moral: 0.04 },
    surfaceSlots: 1,
    applianceSlots: 1,
  },
  {
    id: 'kitchen-hutch',
    name: t('Buffet vaisselier', 'Kitchen hutch'),
    description: t(
      'Vitrines de tasses assorties au-dessus du plan de travail : +moral, +hype.',
      'Glass cabinets of matching cups above the worktop: +morale, +hype.',
    ),
    price: 900,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 6,
    effects: { moral: 0.05, hypePerDay: 0.005 },
    surfaceSlots: 2,
    applianceSlots: 2,
  },
  {
    id: 'kitchen-island',
    name: t('Îlot central', 'Kitchen island'),
    description: t(
      'Plan en chêne massif : les meilleures idées naissent autour du café. +moral, +qualité.',
      'Solid oak top: the best ideas happen around the coffee. +morale, +quality.',
    ),
    price: 2200,
    width: 2,
    depth: 1,
    minPhase: 'SERIES_A',
    maxCount: 4,
    effects: { moral: 0.12, quality: 0.005 },
    surfaceSlots: 3,
    applianceSlots: 3,
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
    id: 'earbuds-dock',
    name: t("Station de recharge d'écouteurs", 'Earbuds charging station'),
    description: t(
      'Trois paires d’écouteurs sans fil partagées : annulent le malus des réunions pour 3 devs.',
      'Three shared pairs of wireless earbuds: cancel the meeting penalty for 3 devs.',
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
    monitor: true,
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
  // Écrans de projection : la toile sort du caisson posé au sol quand un projecteur l'éclaire.
  {
    id: 'projection-screen-small',
    name: t('Écran de projection déroulant (petit)', 'Pull-up projection screen (small)'),
    description: t(
      'Toile de 1,5 m qui sort de son caisson quand le projecteur s’allume : +qualité, +hype.',
      '1.5 m screen that rises from its case when the projector is on: +quality, +hype.',
    ),
    price: 450,
    width: 2,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 3,
    projectionScreen: true,
    effects: { quality: 0.006, hypePerDay: 0.02 },
  },
  {
    id: 'projection-screen-medium',
    name: t('Écran de projection déroulant (moyen)', 'Pull-up projection screen (medium)'),
    description: t(
      'Toile de 2,4 m pour les revues de code en grand : +qualité, +hype une fois déroulée.',
      '2.4 m screen for big-screen code reviews: +quality, +hype once unrolled.',
    ),
    price: 1100,
    width: 3,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 3,
    projectionScreen: true,
    effects: { quality: 0.01, hypePerDay: 0.04, moral: 0.02 },
  },
  {
    id: 'projection-screen-large',
    name: t('Écran de projection déroulant (grand)', 'Pull-up projection screen (large)'),
    description: t(
      'Toile de 3,2 m, digne d’une keynote : beaucoup de hype une fois déroulée.',
      '3.2 m screen worthy of a keynote: lots of hype once unrolled.',
    ),
    price: 2400,
    width: 4,
    depth: 1,
    minPhase: 'SERIES_A',
    maxCount: 2,
    projectionScreen: true,
    effects: { quality: 0.015, hypePerDay: 0.07, moral: 0.05 },
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
    // Le micro-ondes sur le frigo, grand classique des cuisines de bureau.
    applianceSlots: 1,
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
    applianceSlots: 2,
  },
  // --- Animaux : l'équipement à poser avant d'adopter un chat (voir `pets.ts`). ---
  // --- Décor des annexes (arcade, jardin, auditorium) : offert à l'ouverture, aussi en vente. ---
  {
    id: 'arcade-cabinet',
    name: t('Borne d’arcade', 'Arcade cabinet'),
    description: t(
      'Un dernier high score avant la démo. +moral, −1 % de prod.',
      'One last high score before the demo. +morale, −1% productivity.',
    ),
    price: 2400,
    width: 1,
    depth: 1,
    minPhase: 'SERIES_A',
    maxCount: 6,
    effects: { moral: 0.25, teamProductivity: -0.01 },
  },
  {
    id: 'pinball',
    name: t('Flipper', 'Pinball machine'),
    description: t(
      'Tilt ! +moral, −1 % de prod, et le bruit des bumpers en fond.',
      'Tilt! +morale, −1% productivity, with bumpers in the background.',
    ),
    price: 3200,
    width: 1,
    depth: 1,
    minPhase: 'SERIES_A',
    maxCount: 3,
    effects: { moral: 0.3, teamProductivity: -0.01 },
  },
  {
    id: 'neon-sign',
    name: t('Enseigne néon', 'Neon sign'),
    description: t(
      'Un anneau rose sur pied, parfait pour les stories : léger +moral, +hype.',
      'A pink ring on a stand, perfect for stories: slight +morale, +hype.',
    ),
    price: 450,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 4,
    effects: { moral: 0.04, hypePerDay: 0.02 },
  },
  {
    id: 'indoor-tree',
    name: t('Arbre d’intérieur', 'Indoor tree'),
    description: t(
      'Un vrai arbre dans un grand pot : +moral, meilleures pauses.',
      'A real tree in a big pot: +morale, better breaks.',
    ),
    price: 900,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 6,
    effects: { moral: 0.1, restBonus: 0.1 },
  },
  {
    id: 'fountain',
    name: t('Fontaine zen', 'Zen fountain'),
    description: t(
      'Le clapotis couvre les notifications Slack. +moral, +récupération.',
      'The trickle drowns out Slack pings. +morale, +rest.',
    ),
    price: 2800,
    width: 1,
    depth: 1,
    minPhase: 'SERIES_A',
    maxCount: 2,
    effects: { moral: 0.15, restBonus: 0.5 },
  },
  {
    id: 'bench',
    name: t('Banc', 'Bench'),
    description: t(
      'Pour souffler entre deux tickets : +récupération.',
      'Catch your breath between tickets: +rest.',
    ),
    price: 300,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 6,
    effects: { moral: 0.02, restBonus: 0.3 },
  },
  {
    id: 'stage',
    name: t('Petite scène', 'Small stage'),
    description: t(
      'Pour les all-hands et les talks du vendredi : +hype, léger +moral.',
      'For all-hands and Friday talks: +hype, slight +morale.',
    ),
    price: 3500,
    width: 1,
    depth: 1,
    minPhase: 'SERIES_A',
    maxCount: 1,
    effects: { hypePerDay: 0.05, moral: 0.05 },
  },
  {
    id: 'lectern',
    name: t('Pupitre de conférence', 'Lectern'),
    description: t(
      'On y pose ses notes, on y lit ses slides : +hype, +qualité.',
      'Notes on it, slides read from it: +hype, +quality.',
    ),
    price: 700,
    width: 1,
    depth: 1,
    minPhase: 'SERIES_A',
    maxCount: 2,
    effects: { hypePerDay: 0.02, quality: 0.003 },
  },
  {
    id: 'auditorium-screen',
    name: t('Écran géant d’auditorium', 'Auditorium screen'),
    description: t(
      'Toujours allumé, toujours sur la roadmap : +hype, +qualité.',
      'Always on, always showing the roadmap: +hype, +quality.',
    ),
    price: 4000,
    width: 2,
    depth: 1,
    minPhase: 'SERIES_A',
    maxCount: 1,
    effects: { hypePerDay: 0.06, quality: 0.01 },
  },
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
  // --- Fenêtres : percées dans les murs du fond. Les locaux n'en ont aucune au départ. ---
  {
    id: 'window-small',
    name: t('Petite fenêtre', 'Small window'),
    description: t(
      'Un hublot sur la ville, une case de large : léger +moral.',
      'A porthole onto the city, one tile wide: slight +morale.',
    ),
    price: 800,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 16,
    wall: true,
    effects: { moral: 0.02 },
  },
  {
    id: 'window-medium',
    name: t('Fenêtre', 'Window'),
    description: t(
      'Deux cases de lumière naturelle. On voit enfin s’il fait jour : +moral.',
      'Two tiles of daylight. You can finally tell if it is day: +morale.',
    ),
    price: 1500,
    width: 2,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 16,
    wall: true,
    effects: { moral: 0.04 },
  },
  {
    id: 'window-large',
    name: t('Grande fenêtre', 'Large window'),
    description: t(
      'Trois cases de vue sur les tours voisines : +moral.',
      'Three tiles of view on the towers next door: +morale.',
    ),
    price: 2500,
    width: 3,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 16,
    wall: true,
    effects: { moral: 0.06 },
  },
  {
    id: 'glass-wall',
    name: t('Baie vitrée', 'Glass wall'),
    description: t(
      'Vitre de building du sol au plafond, deux cases : +moral, et les photos LinkedIn sont superbes.',
      'Floor-to-ceiling building glass, two tiles: +morale, and the LinkedIn photos look amazing.',
    ),
    price: 5000,
    width: 2,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 16,
    wall: true,
    effects: { moral: 0.06, hypePerDay: 0.005 },
  },
  // --- Murs fins : des cloisons à poser soi-même, case par case, raccordées aux murs voisins. ---
  {
    id: 'thin-wall',
    name: t('Mur fin', 'Thin wall'),
    description: t(
      'Une cloison à mi-hauteur, posée case par case : moins de bruit, +0,05 % de productivité.',
      'A half-height partition, placed tile by tile: less noise, +0.05% productivity.',
    ),
    price: 150,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 80,
    partition: 'solid',
    effects: { teamProductivity: 0.0005 },
  },
  {
    id: 'glass-partition',
    name: t('Mur fin vitré', 'Glass partition'),
    description: t(
      'Du verre du sol au plafond : on s’isole sans se cacher. Léger +moral.',
      'Floor-to-ceiling glass: you get some quiet without hiding. Slight +morale.',
    ),
    price: 450,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 80,
    partition: 'glass',
    effects: { moral: 0.01 },
  },
  // --- Électroménager : posé sur un meuble de cuisine (ou le frigo), jamais au sol. ---
  {
    id: 'drip-coffee-maker',
    name: t('Cafetière à filtre', 'Drip coffee maker'),
    description: t(
      'Le carburant de base : +25 café chaque matin. Se pose sur un meuble de cuisine.',
      'Basic fuel: +25 coffee every morning. Goes on a kitchen cabinet.',
    ),
    price: 150,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 3,
    accessory: true,
    appliance: true,
    effects: { coffeeRestock: 25 },
  },
  {
    id: 'espresso-machine',
    name: t('Machine à expresso premium', 'Premium espresso machine'),
    description: t(
      'Grains torréfiés par un barista de Brooklyn, moulus devant toi : +50 café, +moral.',
      'Beans roasted by a Brooklyn barista, ground on the spot: +50 coffee, +morale.',
    ),
    price: 2500,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 3,
    accessory: true,
    appliance: true,
    effects: { coffeeRestock: 50, moral: 0.15 },
  },
  {
    id: 'microwave-oven',
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
    accessory: true,
    appliance: true,
    effects: { moral: 0.1, restBonus: 0.5 },
  },
  {
    id: 'kettle',
    name: t('Bouilloire', 'Kettle'),
    description: t(
      'Thé vert pour ceux qui ne boivent pas de café (si, ça compte) : +6 café, léger +moral.',
      'Green tea for the non-coffee people (yes, it counts): +6 coffee, slight +morale.',
    ),
    price: 45,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 3,
    accessory: true,
    appliance: true,
    effects: { coffeeRestock: 6, moral: 0.02 },
  },
  {
    id: 'rice-cooker',
    name: t('Cuiseur à riz', 'Rice cooker'),
    description: t(
      'Riz chaud à toute heure, compagnon officiel des mises en prod tardives : +récupération.',
      'Hot rice at any hour, official sidekick of late deploys: +rest.',
    ),
    price: 90,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 2,
    accessory: true,
    appliance: true,
    effects: { moral: 0.03, restBonus: 0.3 },
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
    id: 'projector',
    name: t('Vidéoprojecteur', 'Video projector'),
    description: t(
      'Allumé, il déroule l’écran posé en face : +moral, léger -productivité.',
      'Switched on, it unrolls the screen it faces: +morale, slight -productivity.',
    ),
    price: 700,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 3,
    accessory: true,
    projector: true,
    effects: { moral: 0.03, teamProductivity: -0.004 },
  },
  {
    id: 'ceiling-projector',
    name: t('Vidéoprojecteur de plafond', 'Ceiling projector'),
    description: t(
      'Accroché au plafond, il ne prend ni bureau ni sol. Allumé, il déroule l’écran en face.',
      'Hung from the ceiling, it takes no desk or floor space. On, it unrolls the screen it faces.',
    ),
    price: 1300,
    width: 1,
    depth: 1,
    minPhase: 'GARAGE',
    maxCount: 3,
    ceiling: true,
    projector: true,
    effects: { moral: 0.03, teamProductivity: -0.004 },
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
    id: 'desk-earbuds',
    name: t('Écouteurs sans fil à réduction de bruit', 'Noise-cancelling wireless earbuds'),
    description: t(
      'Leur étui ouvert sur le bureau, prêts pour la prochaine réunion : annulent son malus pour 1 dev.',
      'Case open on the desk, ready for the next meeting: they cancel its penalty for 1 dev.',
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
  // --- Salle des serveurs : le local, puis le matériel qu'on y installe (voir `serverRoom.ts`). ---
  {
    id: 'server-closet',
    name: t('Local serveurs', 'Server closet'),
    description: t(
      'Un placard vitré au sol technique : 4 emplacements pour le matériel serveur.',
      'A glass closet with a raised floor: 4 slots for server hardware.',
    ),
    price: 4000,
    width: 2,
    depth: 2,
    minPhase: 'SEED',
    maxCount: 1,
    effects: {},
    surfaceSlots: 4,
    serverRoom: true,
  },
  {
    id: 'server-room',
    name: t('Salle des serveurs', 'Server room'),
    description: t(
      'Une vraie salle climatisée, badge à l’entrée : 8 emplacements pour le matériel serveur.',
      'A real air-conditioned room with a badge reader: 8 slots for server hardware.',
    ),
    price: 12000,
    width: 4,
    depth: 3,
    minPhase: 'SERIES_A',
    maxCount: 1,
    effects: {},
    surfaceSlots: 8,
    serverRoom: true,
  },
  {
    id: 'rack-server',
    name: t('Baie de serveurs 1U', '1U server rack'),
    description: t(
      'Six serveurs qui ronronnent : +stabilité, -6 % de facture d’hébergement.',
      'Six purring servers: +stability, -6% hosting bill.',
    ),
    price: 3000,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 8,
    accessory: true,
    serverGear: 'server',
    effects: { stabilityPerDay: 0.15, hostingSaving: 0.06 },
  },
  {
    id: 'blade-server',
    name: t('Châssis de serveurs lames', 'Blade server chassis'),
    description: t(
      'Trente-deux lames dans une armoire : +stabilité, -12 % de facture d’hébergement.',
      'Thirty-two blades in one cabinet: +stability, -12% hosting bill.',
    ),
    price: 9000,
    width: 1,
    depth: 1,
    minPhase: 'SERIES_A',
    maxCount: 6,
    accessory: true,
    serverGear: 'server',
    effects: { stabilityPerDay: 0.3, hostingSaving: 0.12 },
  },
  {
    id: 'gpu-server',
    name: t('Serveur GPU', 'GPU server'),
    description: t(
      'Pour entraîner « notre propre IA » : +1,5 % de productivité, +hype. Chauffe beaucoup.',
      'To train “our own AI”: +1.5% productivity, +hype. Runs very hot.',
    ),
    price: 15000,
    width: 1,
    depth: 1,
    minPhase: 'SERIES_A',
    maxCount: 4,
    accessory: true,
    serverGear: 'server',
    effects: { teamProductivity: 0.015, hypePerDay: 0.05, hostingSaving: 0.03 },
  },
  {
    id: 'network-switch',
    name: t('Switch réseau 48 ports', '48-port network switch'),
    description: t(
      'Relie les serveurs entre eux, avec des câbles de toutes les couleurs. +stabilité.',
      'Links the servers together with cables of every colour. +stability.',
    ),
    price: 800,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 4,
    accessory: true,
    serverGear: 'network',
    effects: { stabilityPerDay: 0.04 },
  },
  {
    id: 'fibre-router',
    name: t('Box fibre pro', 'Business fibre router'),
    description: t(
      'Le point d’arrivée de la fibre : indispensable à l’abonnement. Compte comme du réseau.',
      'Where the fibre comes in: required for the subscription. Counts as networking.',
    ),
    price: 600,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 2,
    accessory: true,
    serverGear: 'network',
    effects: { stabilityPerDay: 0.02 },
  },
  {
    id: 'precision-cooling',
    name: t('Climatisation de précision', 'Precision air conditioner'),
    description: t(
      'Garde la salle à 21 °C. Sans elle, les serveurs surchauffent et ne servent à rien.',
      'Keeps the room at 21 °C. Without it the servers overheat and do nothing.',
    ),
    price: 3500,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 4,
    accessory: true,
    serverGear: 'cooling',
    effects: { stabilityPerDay: 0.02 },
  },
  {
    id: 'ups-unit',
    name: t('Onduleur', 'UPS'),
    description: t(
      'Vingt minutes de batterie quand quelqu’un débranche la multiprise. +stabilité.',
      'Twenty minutes of battery when someone unplugs the power strip. +stability.',
    ),
    price: 2000,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 4,
    accessory: true,
    serverGear: 'power',
    effects: { stabilityPerDay: 0.1 },
  },
  {
    id: 'backup-nas',
    name: t('Baie de sauvegarde', 'Backup storage array'),
    description: t(
      'Des sauvegardes qu’on a vraiment testées : +stabilité, -dette chaque jour.',
      'Backups that were actually tested: +stability, -debt every day.',
    ),
    price: 2500,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 3,
    accessory: true,
    serverGear: 'storage',
    effects: { stabilityPerDay: 0.05, debtPerDay: -0.05 },
  },
  {
    id: 'firewall',
    name: t('Pare-feu', 'Firewall'),
    description: t(
      'Bloque les attaques et Slack le vendredi. +stabilité, les investisseurs adorent : +hype.',
      'Blocks attacks, and Slack on Fridays. +stability, investors love it: +hype.',
    ),
    price: 1800,
    width: 1,
    depth: 1,
    minPhase: 'SEED',
    maxCount: 2,
    accessory: true,
    serverGear: 'security',
    effects: { stabilityPerDay: 0.06, hypePerDay: 0.02 },
  },
  {
    id: 'fire-suppression',
    name: t('Extinction automatique au gaz', 'Gas fire suppression'),
    description: t(
      'Deux bouteilles prêtes à étouffer le moindre incendie. +stabilité, l’équipe dort mieux.',
      'Two cylinders ready to smother any fire. +stability, the team sleeps better.',
    ),
    price: 4000,
    width: 1,
    depth: 1,
    minPhase: 'SERIES_A',
    maxCount: 2,
    accessory: true,
    serverGear: 'security',
    effects: { stabilityPerDay: 0.05, moral: 0.02 },
  },
] as const satisfies readonly FurnitureDefinition[];

export type FurnitureId = (typeof FURNITURE_CATALOG)[number]['id'];

/**
 * Anciens combinés « meuble + appareil » (avant la cuisine séparée) : chacun devient un meuble
 * de cuisine avec l'appareil posé dessus, au même endroit et avec le même effet de jeu.
 * Sert uniquement à charger les vieilles sauvegardes.
 */
export const LEGACY_KITCHEN_ITEMS: Readonly<
  Record<string, { readonly cabinet: FurnitureId; readonly appliance: FurnitureId }>
> = {
  'coffee-machine': { cabinet: 'kitchen-doors', appliance: 'drip-coffee-maker' },
  'premium-coffee-machine': { cabinet: 'kitchen-drawers', appliance: 'espresso-machine' },
  microwave: { cabinet: 'kitchen-doors', appliance: 'microwave-oven' },
};

const BY_ID = new Map<string, FurnitureDefinition>(
  FURNITURE_CATALOG.map((item) => [item.id, item]),
);

/**
 * Objets renommés : les casques antibruit sont devenus des écouteurs sans fil. Les anciennes
 * sauvegardes et les journaux de commandes (replays, scores) gardent les anciens identifiants ;
 * la simulation les traduit au chargement et à chaque commande.
 */
export const LEGACY_FURNITURE_IDS: Readonly<Record<string, FurnitureId>> = {
  'noise-headsets': 'earbuds-dock',
  'desk-headset': 'desk-earbuds',
};

/** Identifiant actuel d'un objet (celui d'origine s'il n'a jamais été renommé). */
export function currentFurnitureId(id: string): string {
  return LEGACY_FURNITURE_IDS[id] ?? id;
}

/** Définition d'un objet, ou `undefined` si l'identifiant est inconnu. */
export function getFurniture(id: string): FurnitureDefinition | undefined {
  return BY_ID.get(currentFurnitureId(id));
}
