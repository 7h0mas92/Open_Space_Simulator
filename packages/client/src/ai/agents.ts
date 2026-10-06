/**
 * IA visuelle des personnages : déplacements et postures dans l'open space.
 *
 * La simulation décide CE QUE fait chaque dev (son activité : travailler, café, réunion…).
 * Ce module décide COMMENT on le voit : où il marche (A*), comment il évite ses collègues,
 * quelle posture il prend une fois arrivé et quelle bulle de pensée il affiche.
 *
 * Il avance par pas fixes (`AGENT_TICK_SECONDS`) avec un RNG seedé : même graine et mêmes
 * instantanés de jeu ⇒ mêmes positions. Il ne modifie jamais l'état du jeu.
 */
import { catalogItem } from '../view/catalog';
import { officeLayout, type Cell, type OfficeLayout } from '../view/layout';
import {
  isFridayFive,
  type DevActivity,
  type DevRole,
  type DevView,
  type GameView,
  type PlacedItemView,
} from '../view/types';
import { findPath } from './astar';
import { action, condition, selector, sequence, type BTNode, type Status } from './behaviorTree';
import { accessCell, buildNavGrid, type ItemPlacement, type NavGrid } from './grid';
import { hashString, Random } from './random';
import { pickThought } from './thoughts';

/** Durée d'un pas de l'IA, en secondes (multipliée par la vitesse de jeu). */
export const AGENT_TICK_SECONDS = 0.1;
/** Vitesse de marche, en cases par seconde. */
export const WALK_SPEED = 2.2;
/** Pas d'attente avant de recalculer un chemin bloqué par un collègue. */
const MAX_WAIT_TICKS = 6;
/** Durée d'affichage d'une bulle, en pas. */
const THOUGHT_TICKS = 35;
/** Probabilité par pas qu'un personnage sans bulle se mette à penser. */
const THOUGHT_CHANCE = 0.006;

export const AGENT_POSES = [
  'idle',
  'walk',
  'work',
  'drink',
  'meeting',
  'talk',
  'argue',
  'sleep',
  'yell',
  'play',
] as const;
export type AgentPose = (typeof AGENT_POSES)[number];

/** Ce que le rendu lit pour chaque personnage. */
export interface AgentSnapshot {
  readonly id: string;
  /** Position continue, en cases (centre de la case = entier). */
  readonly x: number;
  readonly z: number;
  /** Orientation en radians (0 = regarde vers +z). */
  readonly facing: number;
  readonly pose: AgentPose;
  readonly visible: boolean;
  readonly thought: string | null;
}

interface Agent {
  readonly id: string;
  readonly random: Random;
  role: DevRole;
  activity: DevActivity;
  morale: number;
  x: number;
  z: number;
  facing: number;
  pose: AgentPose;
  visible: boolean;
  path: Cell[];
  goal: Cell | null;
  /** Point vers lequel se tourner une fois arrivé. */
  lookAt: { x: number; z: number } | null;
  waitTicks: number;
  thought: string | null;
  thoughtTicks: number;
}

interface PointOfInterest {
  readonly item: ItemPlacement;
  readonly access: Cell;
  readonly center: { x: number; z: number };
}

interface BrainContext {
  readonly agent: Agent;
  readonly world: AgentWorld;
}

const cellOf = (agent: Agent): Cell => ({ x: Math.round(agent.x), z: Math.round(agent.z) });
const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.z === b.z;

function itemCenter(item: ItemPlacement): { x: number; z: number } {
  const def = catalogItem(item.kind);
  const [w, d] = def ? (item.rotation % 2 === 0 ? def.size : [def.size[1], def.size[0]]) : [1, 1];
  return { x: item.x + (w - 1) / 2, z: item.z + (d - 1) / 2 };
}

/** Action « aller vers » : calcule le chemin si besoin, avance, réussit à l'arrivée. */
function goTo(name: string, target: (context: BrainContext) => PointOfInterest | Cell | null) {
  return action<BrainContext>(name, ({ agent, world }) => {
    const found = target({ agent, world });
    if (!found) return 'failure';
    const wanted = 'access' in found ? found.access : found;
    const goal = world.freeCellNear(wanted, agent);
    if (!goal) return 'failure';
    agent.lookAt = 'access' in found ? found.center : null;
    return world.moveTowards(agent, goal);
  });
}

function pose(value: AgentPose) {
  return action<BrainContext>(`pose:${value}`, ({ agent }) => {
    agent.pose = value;
    if (agent.lookAt) {
      agent.facing = Math.atan2(agent.lookAt.x - agent.x, agent.lookAt.z - agent.z);
    }
    return 'success';
  });
}

function hide(): BTNode<BrainContext> {
  return action('hide', ({ agent }) => {
    agent.visible = false;
    agent.path = [];
    return 'success';
  });
}

const is = (activity: DevActivity) =>
  condition<BrainContext>(`is:${activity}`, ({ agent }) => agent.activity === activity);

/** L'arbre de comportement commun à tous les personnages. */
export const BRAIN: BTNode<BrainContext> = selector(
  'brain',
  sequence('remote', is('REMOTE'), hide()),
  sequence(
    'leave',
    is('LEAVING'),
    goTo('toExit', ({ world }) => world.layout.entrance),
    hide(),
  ),
  sequence(
    'coffee',
    is('COFFEE'),
    goTo('toCoffee', (c) => c.world.poiFor(c.agent, 'coffee')),
    pose('drink'),
  ),
  sequence(
    'meeting',
    is('MEETING'),
    goTo('toMeeting', (c) => c.world.poiFor(c.agent, 'meeting') ?? c.world.deskOf(c.agent)),
    pose('meeting'),
  ),
  sequence(
    'babyfoot',
    is('BABYFOOT'),
    goTo(
      'toBabyfoot',
      (c) => c.world.poiFor(c.agent, 'babyfoot') ?? c.world.poiFor(c.agent, 'coffee'),
    ),
    pose('play'),
  ),
  sequence(
    'chat',
    is('CHATTING'),
    goTo('toFriend', (c) => c.world.colleagueCell(c.agent, 'friend')),
    pose('talk'),
  ),
  sequence(
    'argue',
    is('ARGUING'),
    goTo('toEnemy', (c) => c.world.colleagueCell(c.agent, 'enemy')),
    pose('argue'),
  ),
  sequence(
    'sleep',
    is('SLEEPING'),
    goTo('toDesk', (c) => c.world.deskOf(c.agent)),
    pose('sleep'),
  ),
  sequence(
    'yell',
    is('YELLING'),
    goTo('toDesk', (c) => c.world.deskOf(c.agent)),
    pose('yell'),
  ),
  sequence(
    'work',
    goTo('toDesk', (c) => c.world.deskOf(c.agent)),
    pose('work'),
  ),
  // Dernier recours (pas de bureau accessible) : attendre sur place.
  pose('idle'),
);

export class AgentWorld {
  layout: OfficeLayout = officeLayout('GARAGE');
  private grid: NavGrid = buildNavGrid(this.layout, []);
  private agents: Agent[] = [];
  private pois = new Map<string, PointOfInterest[]>();
  private desks: PointOfInterest[] = [];
  private devs = new Map<string, DevView>();
  private gridKey = '';
  private incident = false;
  private fridayFive = false;
  private tickCount = 0;

  constructor(private readonly seed: number) {}

  /** Met à jour le monde à partir d'un instantané de jeu. */
  sync(view: GameView): void {
    this.incident = view.incident;
    this.fridayFive = isFridayFive(view.time);
    this.devs = new Map(view.devs.map((dev) => [dev.id, dev]));

    const key = `${view.phase}|${view.items.map((i) => `${i.id}:${i.x}:${i.z}:${i.rotation}`).join(',')}`;
    if (key !== this.gridKey) {
      this.gridKey = key;
      this.layout = officeLayout(view.phase);
      this.grid = buildNavGrid(this.layout, view.items);
      this.indexPointsOfInterest(view.items);
      for (const agent of this.agents) {
        agent.path = [];
        agent.goal = null;
      }
    }

    const alive = new Set(view.devs.map((dev) => dev.id));
    this.agents = this.agents.filter((agent) => alive.has(agent.id));
    for (const dev of view.devs) {
      let agent = this.agents.find((a) => a.id === dev.id);
      if (!agent) {
        agent = this.spawn(dev);
        this.agents.push(agent);
      }
      agent.role = dev.role;
      agent.morale = dev.morale;
      if (agent.activity !== dev.activity) {
        agent.activity = dev.activity;
        agent.goal = null;
        agent.path = [];
      }
    }
    this.agents.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  /** Avance d'un pas fixe. */
  step(): void {
    this.tickCount++;
    for (const agent of this.agents) {
      if (agent.activity !== 'REMOTE' && agent.activity !== 'LEAVING' && !agent.visible) {
        // Retour le lendemain matin : le personnage réapparaît à l'entrée.
        agent.visible = true;
        agent.x = this.layout.entrance.x;
        agent.z = this.layout.entrance.z;
      }
      BRAIN.tick({ agent, world: this });
      this.think(agent);
    }
  }

  get ticks(): number {
    return this.tickCount;
  }

  snapshot(): AgentSnapshot[] {
    return this.agents.map((agent) => ({
      id: agent.id,
      x: agent.x,
      z: agent.z,
      facing: agent.facing,
      pose: agent.pose,
      visible: agent.visible,
      thought: agent.visible ? agent.thought : null,
    }));
  }

  // --- Requêtes utilisées par l'arbre de comportement -------------------------------------

  deskOf(agent: Agent): PointOfInterest | Cell {
    const index = this.agents.filter((a) => a.role !== 'GHOST').indexOf(agent);
    const desk = this.desks[index];
    if (desk) return desk;
    return { x: Math.floor(this.layout.width / 2), z: Math.floor(this.layout.depth / 2) };
  }

  poiFor(agent: Agent, use: string): PointOfInterest | null {
    const list = this.pois.get(use);
    if (!list || list.length === 0) return null;
    // Le plus proche, à égalité le premier par identifiant : déterministe.
    let best: PointOfInterest | null = null;
    let bestDistance = Infinity;
    for (const poi of list) {
      const distance = Math.abs(poi.access.x - agent.x) + Math.abs(poi.access.z - agent.z);
      if (distance < bestDistance) {
        best = poi;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Case à côté du collègue préféré (ou détesté) qui est visible. */
  colleagueCell(agent: Agent, kind: 'friend' | 'enemy'): PointOfInterest | null {
    const relations = this.devs.get(agent.id)?.relations ?? {};
    const others = this.agents.filter((a) => a !== agent && a.visible);
    if (others.length === 0) return null;
    const score = (other: Agent) => (relations[other.id] ?? 0) * (kind === 'friend' ? 1 : -1);
    const target = others.reduce((best, other) => (score(other) > score(best) ? other : best));
    const at = cellOf(target);
    const fakeItem: ItemPlacement = {
      id: target.id,
      kind: 'person',
      x: at.x,
      z: at.z,
      rotation: 0,
    };
    return { item: fakeItem, access: at, center: { x: target.x, z: target.z } };
  }

  /** Case libre la plus proche de `wanted` (un autre personnage arrêté ne la bloque pas). */
  freeCellNear(wanted: Cell, self: Agent): Cell | null {
    if (self.goal && this.grid.walkable(self.goal.x, self.goal.z)) {
      // On garde l'objectif déjà choisi tant qu'il reste proche de la cible.
      if (Math.abs(self.goal.x - wanted.x) + Math.abs(self.goal.z - wanted.z) <= 2)
        return self.goal;
    }
    return this.grid.nearestWalkable(wanted, (cell) => !this.isClaimed(cell, self));
  }

  /** Avance l'agent vers `goal` ; `success` à l'arrivée. */
  moveTowards(agent: Agent, goal: Cell): Status {
    if (!agent.goal || !sameCell(agent.goal, goal)) {
      agent.goal = goal;
      agent.path = this.computePath(agent, goal, false) ?? [];
    }
    const here = cellOf(agent);
    if (agent.path.length === 0) {
      if (sameCell(here, goal) && Math.abs(agent.x - goal.x) + Math.abs(agent.z - goal.z) < 0.05) {
        agent.x = goal.x;
        agent.z = goal.z;
        return 'success';
      }
      // Chemin vide mais pas arrivé : finir le pas en cours vers le centre de la case.
      if (!sameCell(here, goal)) {
        const path = this.computePath(agent, goal, true);
        if (!path) return 'failure';
        agent.path = path;
      } else {
        agent.path = [goal];
      }
    }

    const next = agent.path[0];
    if (!next) return 'running';
    if (this.isOccupied(next, agent) && !sameCell(next, here)) {
      agent.waitTicks++;
      agent.pose = 'idle';
      if (agent.waitTicks > MAX_WAIT_TICKS) {
        agent.waitTicks = 0;
        agent.path = this.computePath(agent, goal, true) ?? [];
      }
      return 'running';
    }
    agent.waitTicks = 0;
    agent.pose = 'walk';

    let budget = WALK_SPEED * AGENT_TICK_SECONDS;
    while (budget > 0 && agent.path.length > 0) {
      const target = agent.path[0];
      if (!target) break;
      const dx = target.x - agent.x;
      const dz = target.z - agent.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 1e-6) agent.facing = Math.atan2(dx, dz);
      if (distance <= budget) {
        agent.x = target.x;
        agent.z = target.z;
        agent.path.shift();
        budget -= distance;
      } else {
        agent.x += (dx / distance) * budget;
        agent.z += (dz / distance) * budget;
        budget = 0;
      }
    }
    return 'running';
  }

  // --- Interne ------------------------------------------------------------------------------

  private spawn(dev: DevView): Agent {
    const random = new Random(this.seed ^ hashString(dev.id));
    const start = this.grid.nearestWalkable(this.layout.entrance) ?? this.layout.entrance;
    return {
      id: dev.id,
      random,
      role: dev.role,
      activity: dev.activity,
      morale: dev.morale,
      x: start.x,
      z: start.z,
      facing: 0,
      pose: 'idle',
      visible: dev.activity !== 'REMOTE',
      path: [],
      goal: null,
      lookAt: null,
      waitTicks: 0,
      thought: null,
      thoughtTicks: 0,
    };
  }

  private indexPointsOfInterest(items: readonly PlacedItemView[]): void {
    this.pois.clear();
    const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const item of sorted) {
      const use = catalogItem(item.kind)?.use;
      if (!use) continue;
      const poi = { item, access: accessCell(item), center: itemCenter(item) };
      const list = this.pois.get(use) ?? [];
      list.push(poi);
      this.pois.set(use, list);
    }
    this.desks = this.pois.get('desk') ?? [];
  }

  private computePath(agent: Agent, goal: Cell, avoid: boolean): Cell[] | null {
    const start = cellOf(agent);
    const from = this.grid.walkable(start.x, start.z) ? start : this.grid.nearestWalkable(start);
    if (!from) return null;
    const path = findPath(this.grid, from, goal, {
      extraCost: avoid ? (cell) => (this.isOccupied(cell, agent) ? 6 : 0) : undefined,
    });
    if (path && !sameCell(from, start)) path.unshift(from);
    return path;
  }

  /** Un autre personnage visible se trouve sur la case. */
  private isOccupied(cell: Cell, self: Agent): boolean {
    return this.agents.some((a) => a !== self && a.visible && sameCell(cellOf(a), cell));
  }

  /** La case est occupée ou réservée comme destination par un autre personnage. */
  private isClaimed(cell: Cell, self: Agent): boolean {
    return this.agents.some(
      (a) =>
        a !== self &&
        a.visible &&
        (sameCell(cellOf(a), cell) || (a.goal !== null && sameCell(a.goal, cell))),
    );
  }

  private think(agent: Agent): void {
    if (agent.thought) {
      if (--agent.thoughtTicks <= 0) agent.thought = null;
      return;
    }
    if (!agent.visible || !agent.random.chance(THOUGHT_CHANCE)) return;
    agent.thought = pickThought(
      {
        activity: agent.activity,
        role: agent.role,
        morale: agent.morale,
        incident: this.incident,
        fridayFive: this.fridayFive,
      },
      agent.random,
    );
    agent.thoughtTicks = THOUGHT_TICKS;
  }
}
