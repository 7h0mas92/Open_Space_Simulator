/**
 * IA visuelle des chats du bureau : où ils marchent et ce qu'ils font.
 *
 * La simulation sait seulement combien de chats vivent dans l'open space et s'ils sont bien
 * installés. Tout le reste est du spectacle : un chat flâne, mange à la gamelle, passe à la
 * litière (on ne le voit plus s'il s'agit d'une litière fermée), grimpe dans l'arbre à chat
 * pour y dormir, s'installe sur un bureau ou sur le canapé. La nuit, il dort surtout.
 *
 * Comme pour les personnages, l'IA avance par pas fixes avec un générateur seedé par chat :
 * mêmes instantanés de jeu ⇒ mêmes déplacements. Elle ne modifie jamais l'état du jeu.
 *
 * Deux chats ne se posent jamais au même endroit : une place (gamelle, litière, perchoir,
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
/** Durée des activités, en pas (min, max). */
const DURATIONS: Record<CatActivity, readonly [number, number]> = {
  wander: [10, 40],
  eat: [25, 50],
  litter: [20, 35],
  perch: [80, 220],
  desk: [50, 140],
  nap: [70, 180],
  groom: [20, 45],
};

export const CAT_POSES = ['walk', 'sit', 'sleep', 'eat', 'groom'] as const;
export type CatPose = (typeof CAT_POSES)[number];

type CatActivity = 'wander' | 'eat' | 'litter' | 'perch' | 'desk' | 'nap' | 'groom';

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
  /** Faux quand le chat est caché (dans une litière fermée). */
  readonly visible: boolean;
}

/** Un endroit où un chat va : la case où il arrive à pied, puis où il s'installe. */
interface Spot {
  /** Identifiant de la place, pour la réserver (une gamelle, un perchoir…). */
  readonly key: string;
  readonly cell: Cell;
  /** Position finale (saut sur un meuble), sinon il reste sur la case. */
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
  /** Case au sol d'où il a sauté (il y redescend en partant). */
  ground: Cell | null;
}

const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.z === b.z;
const cellOf = (cat: Cat): Cell => ({ x: Math.round(cat.x), z: Math.round(cat.z) });

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

export class CatWorld {
  private cats: Cat[] = [];
  private grid: NavGrid | null = null;
  private gridKey = '';
  private spots: Record<Exclude<CatActivity, 'wander' | 'groom'>, Spot[]> = {
    eat: [],
    litter: [],
    perch: [],
    desk: [],
    nap: [],
  };
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
      visible: cat.visible,
    }));
  }

  // --- Préparation ------------------------------------------------------------------------

  private indexSpots(items: readonly PlacedItemView[], grid: NavGrid): void {
    const spots: typeof this.spots = { eat: [], litter: [], perch: [], desk: [], nap: [] };
    const reach = (item: PlacedItemView, toward: { x: number; z: number }): Cell | null => {
      const front = accessCell(item);
      if (grid.walkable(front.x, front.z)) return front;
      return grid.nearestWalkable({ x: Math.round(toward.x), z: Math.round(toward.z) });
    };
    for (const item of items) {
      const def = catalogItem(item.kind);
      if (!def || item.host) continue;
      const center = itemPoint(item, [0, 0, 0]);
      if (def.petNeed === 'bowl' || def.petNeed === 'litter') {
        const cell = reach(item, center);
        if (!cell) continue;
        const hidden = def.petNeed === 'litter' && item.kind !== 'litter-open';
        // Dans une litière, le chat s'assoit dedans ; à la gamelle, il mange devant.
        const seat =
          def.petNeed === 'litter' ? { x: center.x, y: hidden ? 0.1 : 0.06, z: center.z } : null;
        spots[def.petNeed === 'bowl' ? 'eat' : 'litter'].push({
          key: item.id,
          cell,
          seat,
          hidden,
          lookAt: center,
        });
      } else if (def.perches) {
        def.perches.forEach((perch, index) => {
          const seat = itemPoint(item, perch);
          const cell = grid.nearestWalkable({ x: Math.round(seat.x), z: Math.round(seat.z) });
          if (cell)
            spots.perch.push({
              key: `${item.id}#${index}`,
              cell,
              seat,
              hidden: false,
              lookAt: accessCell(item),
            });
        });
      } else if (def.use === 'desk' && def.surface?.[0]) {
        // Sur le bureau, à côté du clavier : le meilleur endroit pour une sieste.
        const top = def.surface[0][1];
        const seat = itemPoint(item, [0.35, top, 0]);
        const cell = reach(item, seat);
        if (cell)
          spots.desk.push({ key: item.id, cell, seat, hidden: false, lookAt: accessCell(item) });
      } else if (def.use === 'rest' || item.kind === 'rug') {
        const seat = item.kind === 'rug' ? center : { ...center, y: 0.42 };
        const cell = reach(item, center);
        if (cell)
          spots.nap.push({
            key: item.id,
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
        ground: null,
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

  /** Le chat est posé par terre, immobile et visible, sur cette case. */
  private restsOn(cat: Cat, cell: Cell): boolean {
    return cat.y === 0 && cat.visible && cat.path.length === 0 && sameCell(cellOf(cat), cell);
  }

  /** Un autre chat se repose sur la case, ou s'y rend pour s'y poser (sans meuble). */
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

  private freeSpots(activity: Exclude<CatActivity, 'wander' | 'groom'>, self: Cat): Spot[] {
    return this.spots[activity].filter((spot) => !this.spotTaken(spot, self));
  }

  // --- Comportement -----------------------------------------------------------------------

  private stepCat(cat: Cat): void {
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
      return;
    }
    // L'activité est finie : il redescend au sol et en choisit une autre.
    this.land(cat);
    this.choose(cat);
  }

  /** Choisit la prochaine activité, au hasard pondéré (la nuit, il dort surtout). */
  private choose(cat: Cat): void {
    const night = this.night;
    const weights: [CatActivity, number][] = [
      ['wander', night ? 1 : 4],
      ['groom', 2],
      ['eat', 2],
      ['litter', 1],
      ['perch', night ? 8 : 3],
      ['desk', night ? 0 : 2],
      ['nap', night ? 3 : 2],
    ];
    const free = {
      eat: this.freeSpots('eat', cat),
      litter: this.freeSpots('litter', cat),
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
          cell,
          seat: null,
          hidden: false,
          lookAt: { x: cell.x, z: cell.z + 1 },
        };
    }
    return null;
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

  /** Arrivée : saut sur le meuble s'il y a lieu, puis la posture de l'activité. */
  private settle(cat: Cat): void {
    const spot = cat.spot;
    if (!spot) return;
    cat.facing = Math.atan2(spot.lookAt.x - cat.x, spot.lookAt.z - cat.z);
    if (spot.seat) {
      cat.ground = { x: Math.round(cat.x), z: Math.round(cat.z) };
      cat.x = spot.seat.x;
      cat.y = spot.seat.y;
      cat.z = spot.seat.z;
    }
    cat.visible = !spot.hidden;
    cat.pose =
      cat.activity === 'eat'
        ? 'eat'
        : cat.activity === 'perch' || cat.activity === 'nap' || cat.activity === 'desk'
          ? cat.random.chance(0.7)
            ? 'sleep'
            : 'sit'
          : cat.activity === 'wander'
            ? cat.random.chance(0.5)
              ? 'sit'
              : 'groom'
            : 'sit';
  }

  /** Redescend au sol (après un meuble ou une litière) et redevient visible. */
  private land(cat: Cat): void {
    cat.visible = true;
    cat.spot = null;
    cat.path = [];
    const here = cellOf(cat);
    if (cat.y === 0 && this.grid?.walkable(here.x, here.z) && !this.cellTaken(here, cat)) {
      cat.x = Math.round(cat.x);
      cat.z = Math.round(cat.z);
      cat.ground = null;
      return;
    }
    const from = cat.ground ?? cellOf(cat);
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
