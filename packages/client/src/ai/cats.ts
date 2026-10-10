/**
 * IA visuelle des chats du bureau : où ils marchent et ce qu'ils font.
 *
 * La simulation sait seulement combien de chats vivent dans l'open space et s'ils sont bien
 * installés. Tout le reste est du spectacle, mais un spectacle crédible : chaque chat a ses
 * besoins (faim, soif, litière, fatigue, envie de jouer) qui montent avec le temps, et il va
 * satisfaire le plus pressant. Il mange ses croquettes puis boit souvent juste après, passe à
 * la litière (on ne le voit plus s'il s'agit d'une litière fermée), joue avec le pompon de
 * l'arbre à chat en sautant d'un plateau à l'autre, puis s'y endort. Le jour, il flâne aussi,
 * fait sa toilette, s'installe sur un bureau ou sur le canapé ; la nuit, il dort surtout.
 *
 * Comme pour les personnages, l'IA avance par pas fixes avec un générateur seedé par chat :
 * mêmes instantanés de jeu ⇒ mêmes déplacements. Elle ne modifie jamais l'état du jeu.
 *
 * Deux chats ne se posent jamais au même endroit : une place (bol, litière, perchoir, pompon,
 * bureau, coussin) est réservée par le chat qui y va, et une case au sol par le chat qui s'y
 * repose ou qui s'y rend. En marchant, un chat contourne ceux qui se reposent par terre.
 */
import { catalogItem, footprint } from '../view/catalog';
import { layoutOf, type Cell } from '../view/layout';
import type { GameView, PetView, PlacedItemView } from '../view/types';
import { findPath } from './astar';
import { accessCell, buildNavGrid, type NavGrid } from './grid';
import { hashString, Random } from './random';

/** Vitesse de marche d'un chat, en cases par seconde (multipliée par la vitesse de jeu). */
export const CAT_SPEED = 3;
/** Durée d'un pas de l'IA, en secondes : la même que celle des personnages. */
const TICK_SECONDS = 0.1;

export const CAT_ACTIVITIES = [
  'wander',
  'groom',
  'eat',
  'drink',
  'litter',
  'play',
  'perch',
  'desk',
  'nap',
] as const;
export type CatActivity = (typeof CAT_ACTIVITIES)[number];
/** Activités qui se passent à une place précise (réservée). */
type PlaceActivity = Exclude<CatActivity, 'wander' | 'groom'>;

/** Durée des activités, en pas (min, max). */
const DURATIONS: Record<CatActivity, readonly [number, number]> = {
  wander: [10, 40],
  groom: [20, 45],
  eat: [30, 60],
  drink: [15, 30],
  litter: [20, 35],
  play: [60, 150],
  perch: [100, 240],
  desk: [60, 150],
  nap: [80, 200],
};

/** Pendant le jeu, il change de place dans l'arbre à chat toutes les N pas (min, max). */
const PLAY_HOP: readonly [number, number] = [15, 35];

export const CAT_POSES = ['walk', 'sit', 'sleep', 'eat', 'drink', 'groom', 'play'] as const;
export type CatPose = (typeof CAT_POSES)[number];

/** Besoins d'un chat, de 0 (satisfait) à 1 (urgent). */
interface Needs {
  hunger: number;
  thirst: number;
  bladder: number;
  tired: number;
  playful: number;
}

/**
 * Hausse des besoins par pas (0,1 s de jeu). Un chat mange environ toutes les 3 min, boit
 * toutes les 2 min et passe à la litière toutes les 4 min de temps réel à x1 ; la nuit, il se
 * fatigue plus vite et n'a presque plus envie de jouer.
 */
const NEED_RATES = {
  hunger: 1 / 1800,
  thirst: 1 / 1200,
  bladder: 1 / 2400,
  tired: { day: 1 / 1500, night: 1 / 500 },
  playful: { day: 1 / 900, night: 1 / 4000 },
  /** Récupération quand il dort ou se repose. */
  rest: 1 / 120,
};

/** Ce que le rendu lit pour chaque chat. */
export interface CatSnapshot {
  readonly id: string;
  /** Position continue en cases (centre de la case = entier) ; `y` : hauteur au-dessus du sol. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Orientation en radians (0 = regarde vers +z). */
  readonly facing: number;
  readonly pose: CatPose;
  /** Ce qu'il fait ou va faire (il peut encore marcher vers sa place). */
  readonly activity: CatActivity;
  /** Faux quand le chat est caché (dans une litière fermée). */
  readonly visible: boolean;
}

/** Un endroit où un chat va : la case où il arrive à pied, puis où il s'installe. */
interface Spot {
  /** Identifiant de la place, pour la réserver (un bol, un perchoir…). */
  readonly key: string;
  /** Meuble de la place : en jouant, le chat saute entre les places d'un même arbre. */
  readonly item: string;
  readonly cell: Cell;
  /** Position finale (saut sur un meuble, place devant un bol), sinon il reste sur la case. */
  readonly seat: { readonly x: number; readonly y: number; readonly z: number } | null;
  /** Il disparaît le temps de l'activité (litière fermée). */
  readonly hidden: boolean;
  /** Point vers lequel il se tourne une fois installé. */
  readonly lookAt: { readonly x: number; readonly z: number };
}

interface Cat {
  readonly id: string;
  readonly random: Random;
  x: number;
  y: number;
  z: number;
  facing: number;
  pose: CatPose;
  visible: boolean;
  path: Cell[];
  activity: CatActivity;
  spot: Spot | null;
  /** Pas restants pour l'activité en cours, une fois arrivé. */
  timer: number;
  /** Pas avant le prochain saut, pendant le jeu. */
  hop: number;
  /** Case au sol d'où il a rejoint sa place (il y redescend en partant) ; `null` : au sol. */
  ground: Cell | null;
  readonly needs: Needs;
}

const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.z === b.z;
const cellOf = (cat: Cat): Cell => ({ x: Math.round(cat.x), z: Math.round(cat.z) });
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Coût ajouté au chemin pour traverser la case d'un chat couché par terre. */
const RESTING_CAT_COST = 6;

/** Position d'un point du repère d'un meuble (centre de l'emprise, avant rotation) dans la scène. */
export function itemPoint(
  item: Pick<PlacedItemView, 'kind' | 'x' | 'z' | 'rotation'>,
  local: readonly [number, number, number],
): { x: number; y: number; z: number } {
  const def = catalogItem(item.kind);
  const [w, d] = def ? footprint(def, item.rotation) : [1, 1];
  const angle = (item.rotation * Math.PI) / 2;
  const [lx, ly, lz] = local;
  return {
    x: item.x + (w - 1) / 2 + lx * Math.cos(angle) + lz * Math.sin(angle),
    y: ly,
    z: item.z + (d - 1) / 2 - lx * Math.sin(angle) + lz * Math.cos(angle),
  };
}

const isNight = (minute: number) => minute < 8 * 60 || minute >= 19 * 60;

const emptySpots = (): Record<PlaceActivity, Spot[]> => ({
  eat: [],
  drink: [],
  litter: [],
  play: [],
  perch: [],
  desk: [],
  nap: [],
});

export class CatWorld {
  private cats: Cat[] = [];
  private grid: NavGrid | null = null;
  private gridKey = '';
  private spots = emptySpots();
  private floor: Cell[] = [];
  private night = false;

  constructor(private readonly seed: number) {}

  /** Met à jour le monde : plan du bureau, objets posés, décorations au sol et chats présents. */
  sync(view: GameView, blocked: readonly Cell[] = []): void {
    this.night = isNight(view.time.minute);
    const key = `${view.phase}|${view.group.wings}|${view.funding.annexes}|${view.items
      .map((i) => `${i.id}:${i.x}:${i.z}:${i.rotation}`)
      .join(',')}|${blocked.map((c) => `${c.x}:${c.z}`).join(',')}`;
    if (key !== this.gridKey) {
      this.gridKey = key;
      const layout = layoutOf(view);
      const grid = buildNavGrid(layout, view.items);
      for (const cell of blocked) grid.block(cell.x, cell.z);
      this.grid = grid;
      this.indexSpots(view.items, grid);
      this.floor = [];
      for (let z = 0; z < grid.depth; z++)
        for (let x = 0; x < grid.width; x++) if (grid.walkable(x, z)) this.floor.push({ x, z });
      // Le décor a changé : chacun redescend au sol et choisit une nouvelle activité.
      for (const cat of this.cats) this.land(cat);
    }
    this.syncCats(view.pets.pets);
  }

  /** Avance d'un pas fixe. */
  step(): void {
    for (const cat of this.cats) this.stepCat(cat);
  }

  snapshot(): CatSnapshot[] {
    return this.cats.map((cat) => ({
      id: cat.id,
      x: cat.x,
      y: cat.y,
      z: cat.z,
      facing: cat.facing,
      pose: cat.pose,
      activity: cat.activity,
      visible: cat.visible,
    }));
  }

  // --- Préparation ------------------------------------------------------------------------

  private indexSpots(items: readonly PlacedItemView[], grid: NavGrid): void {
    const spots = emptySpots();
    const reach = (item: PlacedItemView, toward: { x: number; z: number }): Cell | null => {
      const front = accessCell(item);
      if (grid.walkable(front.x, front.z)) return front;
      return grid.nearestWalkable({ x: Math.round(toward.x), z: Math.round(toward.z) });
    };
    for (const item of items) {
      const def = catalogItem(item.kind);
      if (!def || item.host) continue;
      const center = itemPoint(item, [0, 0, 0]);
      if (def.feeding) {
        // Gamelle : une place devant le bol de croquettes, une devant le bol d'eau.
        const cell = reach(item, center);
        if (!cell) continue;
        for (const need of ['eat', 'drink'] as const) {
          const [x, z] = need === 'eat' ? def.feeding.food : def.feeding.water;
          spots[need].push({
            key: `${item.id}#${need}`,
            item: item.id,
            cell,
            seat: itemPoint(item, [x, 0, z]),
            hidden: false,
            lookAt: itemPoint(item, [x, 0, z - 1]),
          });
        }
      } else if (def.petNeed === 'litter') {
        const cell = reach(item, center);
        if (!cell) continue;
        const hidden = item.kind !== 'litter-open';
        // Dans une litière, le chat s'assoit dedans.
        spots.litter.push({
          key: item.id,
          item: item.id,
          cell,
          seat: { x: center.x, y: hidden ? 0.1 : 0.06, z: center.z },
          hidden,
          lookAt: accessCell(item),
        });
      } else if (def.perches) {
        // Arbre à chat : on s'y repose sur les plateaux, on y joue aussi sous les pompons.
        const front = accessCell(item);
        const places: [readonly [number, number, number], boolean][] = [
          ...def.perches.map((perch): [readonly [number, number, number], boolean] => [
            perch,
            false,
          ]),
          ...(def.toys ?? []).map((toy): [readonly [number, number, number], boolean] => [
            toy,
            true,
          ]),
        ];
        places.forEach(([local, toy], index) => {
          const seat = itemPoint(item, local);
          const cell = grid.nearestWalkable({ x: Math.round(seat.x), z: Math.round(seat.z) });
          if (!cell) return;
          const spot: Spot = {
            key: `${item.id}#${index}`,
            item: item.id,
            cell,
            seat,
            hidden: false,
            // Sous un pompon, il regarde la balle ; sur un plateau, la salle.
            lookAt: toy ? itemPoint(item, [local[0], 0, local[2] - 1]) : front,
          };
          spots.play.push(spot);
          if (!toy) spots.perch.push(spot);
        });
      } else if (def.use === 'desk' && def.surface?.[0]) {
        // Sur le bureau, à côté du clavier : le meilleur endroit pour une sieste.
        const top = def.surface[0][1];
        const seat = itemPoint(item, [0.35, top, 0]);
        const cell = reach(item, seat);
        if (cell)
          spots.desk.push({
            key: item.id,
            item: item.id,
            cell,
            seat,
            hidden: false,
            lookAt: accessCell(item),
          });
      } else if (def.use === 'rest' || item.kind === 'rug') {
        const seat = item.kind === 'rug' ? center : { ...center, y: 0.42 };
        const cell = reach(item, center);
        if (cell)
          spots.nap.push({
            key: item.id,
            item: item.id,
            cell,
            seat: item.kind === 'rug' ? null : seat,
            hidden: false,
            lookAt: center,
          });
      }
    }
    this.spots = spots;
  }

  private syncCats(pets: readonly PetView[]): void {
    const alive = new Set(pets.map((pet) => pet.id));
    this.cats = this.cats.filter((cat) => alive.has(cat.id));
    for (const pet of pets) {
      if (this.cats.some((cat) => cat.id === pet.id)) continue;
      const random = new Random(hashString(`${this.seed}#${pet.id}`));
      const start = this.freeFloor(random, null) ?? { x: 1, z: 1 };
      this.cats.push({
        id: pet.id,
        random,
        x: start.x,
        y: 0,
        z: start.z,
        facing: random.next() * Math.PI * 2,
        pose: 'sit',
        visible: true,
        path: [],
        activity: 'groom',
        spot: null,
        timer: random.int(20),
        hop: 0,
        ground: null,
        // Chacun arrive avec ses propres besoins : ils ne vont pas tous manger en même temps.
        needs: {
          hunger: random.next() * 0.7,
          thirst: random.next() * 0.7,
          bladder: random.next() * 0.7,
          tired: random.next() * 0.5,
          playful: random.next() * 0.7,
        },
      });
    }
    this.cats.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  /** Une case au sol libre au hasard (personne n'y est couché ni ne s'y rend). */
  private freeFloor(random: Random, self: Cat | null): Cell | null {
    const free = this.floor.filter((cell) => !this.cellTaken(cell, self));
    return free.length > 0 ? random.pick(free) : null;
  }

  // --- Réservations -----------------------------------------------------------------------

  /** Le chat est posé par terre (pas sur une place), immobile et visible, sur cette case. */
  private restsOn(cat: Cat, cell: Cell): boolean {
    return (
      cat.ground === null && cat.visible && cat.path.length === 0 && sameCell(cellOf(cat), cell)
    );
  }

  /** Un autre chat se repose sur la case, ou s'y rend pour s'y poser (sans place précise). */
  private cellTaken(cell: Cell, self: Cat | null): boolean {
    return this.cats.some(
      (other) =>
        other !== self &&
        (this.restsOn(other, cell) ||
          (other.spot !== null && other.spot.seat === null && sameCell(other.spot.cell, cell))),
    );
  }

  /** La place est prise : un autre chat y est ou y va, ou quelqu'un est couché devant. */
  private spotTaken(spot: Spot, self: Cat): boolean {
    if (this.cats.some((other) => other !== self && other.spot?.key === spot.key)) return true;
    return spot.seat === null && this.cellTaken(spot.cell, self);
  }

  private freeSpots(activity: PlaceActivity, self: Cat): Spot[] {
    return this.spots[activity].filter((spot) => !this.spotTaken(spot, self));
  }

  // --- Comportement -----------------------------------------------------------------------

  private stepCat(cat: Cat): void {
    this.updateNeeds(cat);
    if (cat.path.length > 0) {
      this.walk(cat);
      return;
    }
    // Arrivé au bout du chemin : il s'installe pour la durée de l'activité.
    if (cat.pose === 'walk') {
      if (cat.spot) this.settle(cat);
      else cat.pose = 'sit';
      return;
    }
    if (cat.timer > 0) {
      cat.timer--;
      if (cat.activity === 'play' && --cat.hop <= 0) this.hopAround(cat);
      return;
    }
    // L'activité est finie : le besoin est satisfait, il redescend au sol et passe à la suite.
    this.satisfy(cat);
    this.land(cat);
    this.choose(cat);
  }

  /** Les besoins montent avec le temps ; la fatigue retombe quand il se repose. */
  private updateNeeds(cat: Cat): void {
    const needs = cat.needs;
    const time = this.night ? 'night' : 'day';
    needs.hunger = clamp01(needs.hunger + NEED_RATES.hunger);
    needs.thirst = clamp01(needs.thirst + NEED_RATES.thirst);
    needs.bladder = clamp01(needs.bladder + NEED_RATES.bladder);
    needs.playful = clamp01(needs.playful + NEED_RATES.playful[time]);
    const resting =
      (cat.pose === 'sleep' || cat.pose === 'sit') &&
      (cat.activity === 'perch' || cat.activity === 'nap' || cat.activity === 'desk');
    needs.tired = clamp01(needs.tired + (resting ? -NEED_RATES.rest : NEED_RATES.tired[time]));
  }

  /** Effet de l'activité qui se termine sur les besoins. */
  private satisfy(cat: Cat): void {
    const needs = cat.needs;
    // Seulement s'il est bien arrivé à sa place (pas en chemin).
    if (cat.spot === null && cat.activity !== 'wander' && cat.activity !== 'groom') return;
    switch (cat.activity) {
      case 'eat':
        needs.hunger = 0;
        // Les croquettes, ça donne soif.
        needs.thirst = clamp01(needs.thirst + 0.35);
        break;
      case 'drink':
        needs.thirst = 0;
        needs.bladder = clamp01(needs.bladder + 0.25);
        break;
      case 'litter':
        needs.bladder = 0;
        break;
      case 'play':
        needs.playful = 0;
        needs.tired = clamp01(needs.tired + 0.3);
        break;
      default:
        break;
    }
  }

  /**
   * Choisit la prochaine activité, au hasard pondéré par ses besoins : plus un besoin est
   * pressant, plus il a de chances de passer avant les autres. La nuit, il dort surtout.
   */
  private choose(cat: Cat): void {
    const night = this.night;
    const { hunger, thirst, bladder, tired, playful } = cat.needs;
    const urgent = (need: number, scale: number) => 0.03 + scale * need ** 3;
    const rest = (0.1 + 10 * tired ** 2) * (night ? 3 : 1);
    const weights: [CatActivity, number][] = [
      ['wander', night ? 0.1 : 0.8],
      ['groom', 0.5],
      ['eat', urgent(hunger, 14)],
      ['drink', urgent(thirst, 14)],
      ['litter', urgent(bladder, 14)],
      ['play', (night ? 0.05 : 1) * (0.05 + 8 * playful ** 2)],
      ['perch', rest * 0.5],
      ['desk', night ? 0 : rest * 0.2],
      ['nap', rest * 0.3],
    ];
    const free = {
      eat: this.freeSpots('eat', cat),
      drink: this.freeSpots('drink', cat),
      litter: this.freeSpots('litter', cat),
      play: this.freeSpots('play', cat),
      perch: this.freeSpots('perch', cat),
      desk: this.freeSpots('desk', cat),
      nap: this.freeSpots('nap', cat),
    };
    const available = weights.filter(
      ([activity, weight]) =>
        weight > 0 && (activity === 'wander' || activity === 'groom' || free[activity].length > 0),
    );
    const total = available.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = cat.random.next() * total;
    let activity: CatActivity = 'wander';
    for (const [candidate, weight] of available) {
      roll -= weight;
      if (roll < 0) {
        activity = candidate;
        break;
      }
    }
    cat.activity = activity;
    const [min, max] = DURATIONS[activity];
    cat.timer = min + cat.random.int(max - min + 1);
    if (activity === 'groom') {
      cat.spot = null;
      cat.pose = 'groom';
      return;
    }
    const spot =
      activity === 'wander' ? this.wanderSpot(cat) : (cat.random.pick(free[activity]) ?? null);
    if (!spot) {
      cat.pose = 'sit';
      return;
    }
    cat.spot = spot;
    this.goTo(cat, spot.cell);
  }

  /** Une case libre pas trop loin, pour flâner. */
  private wanderSpot(cat: Cat): Spot | null {
    for (let attempt = 0; attempt < 6; attempt++) {
      const cell = this.freeFloor(cat.random, cat);
      if (!cell) return null;
      if (Math.abs(cell.x - cat.x) + Math.abs(cell.z - cat.z) <= 8)
        return {
          key: `floor:${cell.x}:${cell.z}`,
          item: '',
          cell,
          seat: null,
          hidden: false,
          lookAt: { x: cell.x, z: cell.z + 1 },
        };
    }
    return null;
  }

  /** En jouant, il saute vers une autre place libre du même arbre à chat. */
  private hopAround(cat: Cat): void {
    const [min, max] = PLAY_HOP;
    cat.hop = min + cat.random.int(max - min + 1);
    const current = cat.spot;
    if (!current) return;
    const options = this.freeSpots('play', cat).filter(
      (spot) => spot.item === current.item && spot.key !== current.key,
    );
    // Toutes les autres places de l'arbre sont prises : il reste où il est.
    if (options.length === 0) return;
    const next = cat.random.pick(options);
    if (!next.seat) return;
    cat.spot = next;
    cat.x = next.seat.x;
    cat.y = next.seat.y;
    cat.z = next.seat.z;
    cat.facing = Math.atan2(next.lookAt.x - cat.x, next.lookAt.z - cat.z);
  }

  private goTo(cat: Cat, goal: Cell): void {
    if (!this.grid) return;
    const start = cellOf(cat);
    const path = findPath(this.grid, start, goal, {
      maxIterations: 4000,
      // Il contourne les chats couchés par terre quand il le peut.
      extraCost: (cell) =>
        this.cats.some((other) => other !== cat && this.restsOn(other, cell))
          ? RESTING_CAT_COST
          : 0,
    });
    cat.path = path ?? [];
    cat.pose = cat.path.length > 0 || path !== null ? 'walk' : 'sit';
    if (path === null) cat.spot = null;
  }

  private walk(cat: Cat): void {
    let next = cat.path[0];
    if (!next) return;
    // Au centre d'une case, si un chat s'est couché depuis sur la suivante, il recalcule son
    // chemin pour le contourner (s'il n'y a pas d'autre passage, il l'enjambe).
    const here = cellOf(cat);
    const centered = cat.x === here.x && cat.z === here.z;
    const goal = cat.path[cat.path.length - 1];
    if (
      centered &&
      goal &&
      !sameCell(next, goal) &&
      this.cats.some((other) => other !== cat && this.restsOn(other, next as Cell))
    ) {
      const spot = cat.spot;
      this.goTo(cat, goal);
      if (cat.path.length > 0) cat.spot = spot;
      next = cat.path[0];
      if (!next) return;
    }
    const dx = next.x - cat.x;
    const dz = next.z - cat.z;
    const distance = Math.hypot(dx, dz);
    const stride = CAT_SPEED * TICK_SECONDS;
    if (distance > 1e-6) cat.facing = Math.atan2(dx, dz);
    if (distance <= stride) {
      cat.x = next.x;
      cat.z = next.z;
      cat.path.shift();
    } else {
      cat.x += (dx / distance) * stride;
      cat.z += (dz / distance) * stride;
    }
    cat.pose = 'walk';
  }

  /** Arrivée : saut sur le meuble ou place devant le bol, puis la posture de l'activité. */
  private settle(cat: Cat): void {
    const spot = cat.spot;
    if (!spot) return;
    if (spot.seat) {
      cat.ground = cellOf(cat);
      cat.x = spot.seat.x;
      cat.y = spot.seat.y;
      cat.z = spot.seat.z;
    }
    cat.facing = Math.atan2(spot.lookAt.x - cat.x, spot.lookAt.z - cat.z);
    cat.visible = !spot.hidden;
    cat.hop = PLAY_HOP[0];
    cat.pose = this.settledPose(cat);
  }

  private settledPose(cat: Cat): CatPose {
    switch (cat.activity) {
      case 'eat':
        return 'eat';
      case 'drink':
        return 'drink';
      case 'play':
        return 'play';
      case 'perch':
      case 'nap':
      case 'desk':
        // Fatigué, il s'endort ; sinon il veille assis, et la nuit il dort presque toujours.
        return cat.random.chance(this.night ? 0.9 : 0.4 + 0.5 * cat.needs.tired) ? 'sleep' : 'sit';
      case 'wander':
        return cat.random.chance(0.5) ? 'sit' : 'groom';
      default:
        return 'sit';
    }
  }

  /** Redescend au sol (après un meuble, un bol ou une litière) et redevient visible. */
  private land(cat: Cat): void {
    cat.visible = true;
    cat.spot = null;
    cat.path = [];
    const here = cellOf(cat);
    if (cat.ground === null && this.grid?.walkable(here.x, here.z) && !this.cellTaken(here, cat)) {
      cat.x = here.x;
      cat.z = here.z;
      cat.y = 0;
      return;
    }
    const from = cat.ground ?? here;
    // Il ne redescend pas sur un autre chat : case libre la plus proche de son point de départ.
    const cell =
      this.grid?.nearestWalkable(from, (c) => !this.cellTaken(c, cat)) ??
      this.grid?.nearestWalkable(from) ??
      from;
    cat.x = cell.x;
    cat.z = cell.z;
    cat.y = 0;
    cat.ground = null;
  }
}
