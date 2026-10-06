/**
 * FAUSSE PARTIE, temporaire : remplace la simulation tant que l'étape 3 n'est pas branchée.
 *
 * Elle produit des `GameView` crédibles et déterministes (graine) pour développer la scène 3D
 * et l'interface : le temps passe, les devs changent d'activité, les tâches avancent, la prod
 * tombe le vendredi à 17h. Les règles sont volontairement simplistes : la vraie économie et
 * l'équilibrage appartiennent à `simulation/`. Ce fichier disparaîtra au branchement.
 */
import { GAME, PHASES, type Phase, type Speed } from '@oss/shared';
import { Random } from '../ai/random';
import { CATALOG, catalogItem, type CatalogItem } from './catalog';
import { officeLayout } from './layout';
import { checkPlacement } from './placement';
import {
  KANBAN_COLUMNS,
  weekday,
  type CandidateView,
  type CommandResult,
  type DevActivity,
  type DevRole,
  type DevView,
  type GameCommand,
  type GameView,
  type Gauges,
  type PlacedItemView,
  type TaskType,
  type TaskView,
} from './types';

/** Minutes de jeu par tick ; 10 ticks par seconde à x1. */
const MINUTES_PER_TICK = 5;
export const MOCK_TICKS_PER_SECOND = 10;
const DAY_START = 8 * 60;
const DAY_END = 21 * 60;
const DAYS_PER_SPRINT = 10;

const NAMES = [
  'Kevin',
  'Jessica',
  'Mathis',
  'Inès',
  'Lucas',
  'Chloé',
  'Hugo',
  'Léa',
  'Nathan',
  'Manon',
  'Yanis',
  'Camille',
  'Enzo',
  'Sarah',
  'Théo',
  'Jade',
  'Bastien',
  'Zoé',
] as const;
export const BIOS = [
  'ninja',
  'tabs',
  'vim',
  'nft',
  'coffee',
  'linkedin',
  'darkmode',
  'regex',
  'podcast',
  'keyboard',
  'crossfit',
  'jira',
] as const;
export const TRAITS = [
  'perfectionist',
  'nightOwl',
  'optimist',
  'grumpy',
  'meetingLover',
  'caffeineAddict',
  'minimalist',
  'hypeBeast',
] as const;
export const TASK_TITLES = [
  'login',
  'darkMode',
  'paymentApi',
  'onboarding',
  'flakyTests',
  'migrateDb',
  'k8s',
  'fixSafari',
  'aiChatbot',
  'exportCsv',
  'refactorAuth',
  'monitoring',
  'notifications',
  'i18n',
] as const;

const ROLE_PROFILES: Record<DevRole, { salary: number; stats: DevView['stats'] }> = {
  SENIOR_BEARD: { salary: 7500, stats: { speed: 50, quality: 90, endurance: 70, ego: 80 } },
  TEN_X: { salary: 9000, stats: { speed: 95, quality: 45, endurance: 60, ego: 95 } },
  INTERN: { salary: 1200, stats: { speed: 35, quality: 30, endurance: 85, ego: 20 } },
  RUSTACEAN: { salary: 6500, stats: { speed: 55, quality: 80, endurance: 65, ego: 70 } },
  DESIGNER: { salary: 5000, stats: { speed: 60, quality: 85, endurance: 60, ego: 60 } },
  PRODUCT_OWNER: { salary: 6000, stats: { speed: 40, quality: 50, endurance: 75, ego: 65 } },
  AI_AGENT: { salary: 2000, stats: { speed: 100, quality: 40, endurance: 100, ego: 10 } },
  GHOST: { salary: 5500, stats: { speed: 70, quality: 70, endurance: 80, ego: 30 } },
};

const TASK_TYPES_BY_TITLE: Record<(typeof TASK_TITLES)[number], TaskType> = {
  login: 'FEATURE',
  darkMode: 'FEATURE',
  paymentApi: 'FEATURE',
  onboarding: 'FEATURE',
  flakyTests: 'BUGFIX',
  migrateDb: 'INFRA',
  k8s: 'INFRA',
  fixSafari: 'BUGFIX',
  aiChatbot: 'FEATURE',
  exportCsv: 'FEATURE',
  refactorAuth: 'REFACTOR',
  monitoring: 'INFRA',
  notifications: 'FEATURE',
  i18n: 'REFACTOR',
};

const IMPACT_BY_TYPE: Record<TaskType, Partial<Gauges>> = {
  FEATURE: { users: 400, hype: 4, debt: 5 },
  REFACTOR: { debt: -8, hype: -2 },
  BUGFIX: { stability: 6, debt: -2 },
  INFRA: { stability: 8, treasury: -3000 },
};

interface MockState {
  seed: number;
  tick: number;
  sprint: number;
  day: number;
  minute: number;
  speed: Speed;
  phase: Phase;
  step: GameView['step'];
  gauges: Gauges;
  history: Gauges[];
  devs: DevView[];
  tasks: TaskView[];
  candidates: CandidateView[];
  items: PlacedItemView[];
  incident: boolean;
  nextId: number;
}

/** Bureau de départ de chaque phase : postes de travail, café, réunion, détente. */
function starterItems(phase: Phase): Omit<PlacedItemView, 'id'>[] {
  const desks = (positions: readonly (readonly [number, number])[]) =>
    positions.map(([x, z]) => ({ kind: 'desk', x, z, rotation: 0 as const }));
  switch (phase) {
    case 'GARAGE':
      return [
        ...desks([
          [1, 1],
          [4, 1],
        ]),
        { kind: 'coffeeMachine', x: 7, z: 0, rotation: 0 },
        { kind: 'plant', x: 0, z: 0, rotation: 0 },
        { kind: 'radio', x: 7, z: 2, rotation: 3 },
      ];
    case 'SEED':
      return [
        ...desks([
          [1, 1],
          [4, 1],
          [7, 1],
          [1, 4],
          [4, 4],
          [7, 4],
        ]),
        { kind: 'coffeeMachine', x: 12, z: 0, rotation: 0 },
        { kind: 'microwave', x: 13, z: 0, rotation: 0 },
        { kind: 'fridge', x: 11, z: 0, rotation: 0 },
        { kind: 'meetingTable', x: 12, z: 7, rotation: 0 },
        { kind: 'plant', x: 0, z: 0, rotation: 0 },
        { kind: 'plant', x: 9, z: 9, rotation: 0 },
        { kind: 'bookcase', x: 1, z: 7, rotation: 0 },
        { kind: 'rug', x: 4, z: 7, rotation: 0 },
      ];
    case 'SERIES_A':
    case 'UNICORN':
    case 'END': {
      const big = phase !== 'SERIES_A';
      const rows = big ? [1, 4, 7, 10, 13] : [1, 4, 7, 10];
      const cols = big ? [1, 4, 7, 10, 13] : [1, 4, 7, 10];
      const desksAt: [number, number][] = [];
      for (const z of rows) for (const x of cols) desksAt.push([x, z]);
      const k = big ? 19 : 14; // abscisse des salles
      return [
        ...desks(desksAt),
        { kind: 'coffeePremium', x: k + 1, z: 0, rotation: 0 },
        { kind: 'coffeeMachine', x: k + 4, z: 0, rotation: 0 },
        { kind: 'fridge', x: k + 5, z: 0, rotation: 0 },
        { kind: 'meetingTable', x: k + 2, z: big ? 8 : 7, rotation: 0 },
        { kind: 'babyfoot', x: k + 1, z: big ? 15 : 12, rotation: 0 },
        { kind: 'sofa', x: k + 4, z: big ? 15 : 12, rotation: 0 },
        { kind: 'plant', x: 0, z: 0, rotation: 0 },
        { kind: 'plant', x: big ? 17 : 12, z: 0, rotation: 0 },
        { kind: 'tv', x: 10, z: big ? 18 : 13, rotation: 2 },
        ...(big
          ? [
              { kind: 'napPod', x: k + 6, z: 17, rotation: 0 as const },
              { kind: 'slide', x: 16, z: 15, rotation: 0 as const },
            ]
          : []),
      ];
    }
  }
}

export class MockGame {
  private state: MockState;
  private readonly random: Random;
  private accumulator = 0;
  private cached: GameView | null = null;

  constructor(seed: number, phase: Phase = 'SEED') {
    this.random = new Random(seed);
    this.state = {
      seed,
      tick: 0,
      sprint: 1,
      day: 0,
      minute: 9 * 60,
      speed: 1,
      phase,
      step: 'PLANNING',
      gauges: {
        treasury: GAME.startingTreasury,
        coffee: 80,
        debt: 10,
        stability: 85,
        hype: 30,
        users: 120,
      },
      history: [],
      devs: [],
      tasks: [],
      candidates: [],
      items: [],
      incident: false,
      nextId: 1,
    };
    this.setPhase(phase);
    const startRoles: DevRole[] =
      phase === 'GARAGE'
        ? ['TEN_X', 'INTERN']
        : ['SENIOR_BEARD', 'TEN_X', 'INTERN', 'PRODUCT_OWNER', 'GHOST'];
    for (const role of startRoles) this.state.devs.push(this.createDev(role));
    this.linkRelations();
    for (const title of TASK_TITLES.slice(0, 8)) this.state.tasks.push(this.createTask(title));
    this.state.candidates = this.createCandidates();
    this.state.history.push(this.state.gauges);
  }

  get view(): GameView {
    if (!this.cached) {
      const s = this.state;
      this.cached = {
        seed: s.seed,
        tick: s.tick,
        time: { sprint: s.sprint, day: s.day, minute: s.minute, speed: s.speed },
        phase: s.phase,
        step: s.step,
        gauges: s.gauges,
        history: [...s.history],
        devs: [...s.devs],
        tasks: [...s.tasks],
        candidates: [...s.candidates],
        items: [...s.items],
        incident: s.incident,
      };
    }
    return this.cached;
  }

  /** Avance la fausse partie de `realSeconds` ; renvoie le nombre de ticks joués. */
  advance(realSeconds: number): number {
    if (this.state.step !== 'EXECUTION' || this.state.speed === 0) return 0;
    this.accumulator += realSeconds * this.state.speed * MOCK_TICKS_PER_SECOND;
    let ticks = 0;
    while (this.accumulator >= 1 && ticks < 40) {
      this.accumulator -= 1;
      this.tick();
      ticks++;
    }
    if (ticks > 0) this.cached = null;
    return ticks;
  }

  /** Change de phase (outil de démonstration : la vraie progression viendra des levées). */
  setPhase(phase: Phase): void {
    this.state.phase = phase;
    this.state.items = starterItems(phase).map((item) => ({ ...item, id: this.id('item') }));
    this.cached = null;
  }

  dispatch(command: GameCommand): CommandResult {
    const result = this.apply(command);
    this.cached = null;
    return result;
  }

  // --- Commandes ---------------------------------------------------------------------------

  private apply(command: GameCommand): CommandResult {
    const s = this.state;
    switch (command.type) {
      case 'setSpeed':
        s.speed = command.speed;
        return { ok: true };
      case 'startSprint':
        s.step = 'EXECUTION';
        if (s.speed === 0) s.speed = 1;
        return { ok: true };
      case 'moveTask': {
        const task = s.tasks.find((t) => t.id === command.taskId);
        if (!task) return { ok: false, reason: 'unknownTask' };
        const others = s.tasks.filter((t) => t.id !== task.id);
        const moved: TaskView = {
          ...task,
          column: command.column,
          assigneeId: command.column === 'BACKLOG' ? null : task.assigneeId,
          progress: command.column === 'DONE' ? 1 : task.progress,
        };
        // Réinsère la tâche à l'index voulu dans sa colonne, en gardant l'ordre des colonnes.
        const result: TaskView[] = [];
        for (const column of KANBAN_COLUMNS) {
          const inColumn = others.filter((t) => t.column === column);
          if (column === command.column) {
            inColumn.splice(Math.max(0, Math.min(command.index, inColumn.length)), 0, moved);
          }
          result.push(...inColumn);
        }
        s.tasks = result;
        return { ok: true };
      }
      case 'assignTask': {
        const task = s.tasks.find((t) => t.id === command.taskId);
        if (!task) return { ok: false, reason: 'unknownTask' };
        s.tasks = s.tasks.map((t) => (t.id === task.id ? { ...t, assigneeId: command.devId } : t));
        return { ok: true };
      }
      case 'hire': {
        const candidate = s.candidates.find((c) => c.id === command.candidateId);
        if (!candidate) return { ok: false, reason: 'unknownCandidate' };
        if (s.devs.length >= officeLayout(s.phase).maxTeam)
          return { ok: false, reason: 'teamFull' };
        s.candidates = s.candidates.filter((c) => c.id !== candidate.id);
        // Plus l'offre est basse, plus le candidat risque de refuser.
        const ratio = command.offer / candidate.askingSalary;
        const acceptance = Math.max(0, Math.min(1, (ratio - 0.7) / 0.35));
        if (!this.random.chance(acceptance)) return { ok: false, reason: 'refused' };
        s.devs.push({ ...candidate.dev, salary: Math.round(command.offer) });
        this.linkRelations();
        return { ok: true };
      }
      case 'fire': {
        if (!s.devs.some((d) => d.id === command.devId)) return { ok: false, reason: 'unknownDev' };
        s.devs = s.devs
          .filter((d) => d.id !== command.devId)
          .map((d) => ({
            ...d,
            morale: Math.max(0, d.morale - 10),
            history: ['colleagueFired', ...d.history],
          }));
        s.tasks = s.tasks.map((t) =>
          t.assigneeId === command.devId ? { ...t, assigneeId: null } : t,
        );
        return { ok: true };
      }
      case 'placeItem': {
        const def = catalogItem(command.kind);
        if (!def) return { ok: false, reason: 'unknownItem' };
        if (PHASES.indexOf(def.minPhase) > PHASES.indexOf(s.phase))
          return { ok: false, reason: 'locked' };
        if (s.gauges.treasury < def.price) return { ok: false, reason: 'tooExpensive' };
        const error = checkPlacement(officeLayout(s.phase), s.items, command);
        if (error) return { ok: false, reason: error };
        s.items = [
          ...s.items,
          {
            id: this.id('item'),
            kind: command.kind,
            x: command.x,
            z: command.z,
            rotation: command.rotation,
          },
        ];
        s.gauges = { ...s.gauges, treasury: s.gauges.treasury - def.price };
        return { ok: true };
      }
      case 'moveItem': {
        const item = s.items.find((i) => i.id === command.itemId);
        if (!item) return { ok: false, reason: 'unknownItem' };
        const error = checkPlacement(officeLayout(s.phase), s.items, {
          kind: item.kind,
          x: command.x,
          z: command.z,
          rotation: item.rotation,
          ignoreId: item.id,
        });
        if (error) return { ok: false, reason: error };
        s.items = s.items.map((i) => (i.id === item.id ? { ...i, x: command.x, z: command.z } : i));
        return { ok: true };
      }
      case 'rotateItem': {
        const item = s.items.find((i) => i.id === command.itemId);
        if (!item) return { ok: false, reason: 'unknownItem' };
        const rotation = ((item.rotation + 1) % 4) as PlacedItemView['rotation'];
        const error = checkPlacement(officeLayout(s.phase), s.items, {
          kind: item.kind,
          x: item.x,
          z: item.z,
          rotation,
          ignoreId: item.id,
        });
        if (error) return { ok: false, reason: error };
        s.items = s.items.map((i) => (i.id === item.id ? { ...i, rotation } : i));
        return { ok: true };
      }
      case 'sellItem': {
        const item = s.items.find((i) => i.id === command.itemId);
        if (!item) return { ok: false, reason: 'unknownItem' };
        const price = catalogItem(item.kind)?.price ?? 0;
        s.items = s.items.filter((i) => i.id !== item.id);
        s.gauges = { ...s.gauges, treasury: s.gauges.treasury + Math.round(price / 2) };
        return { ok: true };
      }
    }
  }

  // --- Boucle ------------------------------------------------------------------------------

  private tick(): void {
    const s = this.state;
    s.tick++;
    s.minute += MINUTES_PER_TICK;

    if (s.minute % 30 === 0) this.reassignActivities();
    if (s.minute % 60 === 0) this.progressTasks();

    // Vendredi 17h : la prod tombe (une fois sur deux), jusqu'à 18h30.
    if (weekday(s.day) === 4 && s.minute === 17 * 60 && this.random.chance(0.5)) {
      s.incident = true;
      s.gauges = { ...s.gauges, stability: Math.max(0, s.gauges.stability - 25) };
    }
    if (s.incident && s.minute >= 18 * 60 + 30) s.incident = false;

    if (s.minute >= DAY_END) this.endDay();
  }

  private endDay(): void {
    const s = this.state;
    const salaries = s.devs.reduce((sum, dev) => sum + dev.salary, 0) / 21;
    const coffeeBonus = this.itemEffect('coffee');
    const moraleBonus = this.itemEffect('morale');
    s.gauges = {
      treasury: Math.round(s.gauges.treasury - salaries),
      coffee: clamp(s.gauges.coffee - 4 * s.devs.length + coffeeBonus, 0, 100),
      debt: clamp(s.gauges.debt + 0.5, 0, 100),
      stability: clamp(s.gauges.stability + 1 - s.gauges.debt / 50, 0, 100),
      hype: clamp(s.gauges.hype - 0.5, 0, 100),
      users: Math.max(0, Math.round(s.gauges.users * (1 + (s.gauges.stability - 50) / 2000))),
    };
    s.devs = s.devs.map((dev) => ({
      ...dev,
      morale: clamp(
        dev.morale + moraleBonus / 4 - (s.gauges.coffee < 20 ? 3 : 0) + this.random.next() * 4 - 2,
        0,
        100,
      ),
    }));
    s.history.push(s.gauges);
    s.minute = DAY_START;
    s.day++;
    if (s.day >= DAYS_PER_SPRINT) {
      s.day = 0;
      s.sprint = Math.min(GAME.totalSprints, s.sprint + 1);
      s.step = 'PLANNING';
      s.candidates = this.createCandidates();
    }
  }

  private reassignActivities(): void {
    const s = this.state;
    const hour = s.minute / 60;
    s.devs = s.devs.map((dev) => {
      if (dev.role === 'GHOST') return { ...dev, activity: 'REMOTE' };
      let activity: DevActivity;
      const roll = this.random.next();
      if (hour >= 19 || hour < 8.5) activity = roll < 0.85 ? 'LEAVING' : 'WORKING';
      else if (s.incident) activity = roll < 0.5 ? 'YELLING' : 'WORKING';
      else if (dev.role === 'PRODUCT_OWNER' && roll < 0.5) activity = 'MEETING';
      else if ((hour >= 10 && hour < 11) || (hour >= 14 && hour < 15)) {
        activity = roll < 0.35 ? 'MEETING' : roll < 0.5 ? 'COFFEE' : 'WORKING';
      } else if (roll < 0.12) activity = 'COFFEE';
      else if (roll < 0.18) activity = 'CHATTING';
      else if (roll < 0.21) activity = 'ARGUING';
      else if (roll < 0.25 && this.state.items.some((i) => i.kind === 'babyfoot'))
        activity = 'BABYFOOT';
      else if (roll < 0.29 && (dev.morale < 40 || hour > 16)) activity = 'SLEEPING';
      else activity = 'WORKING';
      return { ...dev, activity };
    });
  }

  private progressTasks(): void {
    const s = this.state;
    const working = new Set(
      s.devs.filter((d) => d.activity === 'WORKING' || d.activity === 'REMOTE').map((d) => d.id),
    );
    s.tasks = s.tasks.map((task) => {
      if (task.column !== 'DOING' || !task.assigneeId || !working.has(task.assigneeId)) return task;
      const dev = s.devs.find((d) => d.id === task.assigneeId);
      const speed = (dev?.stats.speed ?? 50) / 100;
      const progress = Math.min(
        1,
        task.progress + ((0.08 * speed * (s.gauges.coffee > 0 ? 1 : 0.33)) / task.size) * 3,
      );
      if (progress >= 1) {
        s.gauges = applyImpact(s.gauges, task.impact);
        return { ...task, progress: 1, column: 'DONE' };
      }
      return { ...task, progress };
    });
  }

  // --- Génération --------------------------------------------------------------------------

  private id(prefix: string): string {
    return `${prefix}-${this.state.nextId++}`;
  }

  private createDev(role: DevRole): DevView {
    const profile = ROLE_PROFILES[role];
    const jitter = (value: number) =>
      clamp(Math.round(value + this.random.next() * 20 - 10), 1, 100);
    return {
      id: this.id('dev'),
      name: this.random.pick(NAMES),
      age: 21 + this.random.int(25),
      role,
      trait: this.random.pick(TRAITS),
      bio: this.random.pick(BIOS),
      stats: {
        speed: jitter(profile.stats.speed),
        quality: jitter(profile.stats.quality),
        endurance: jitter(profile.stats.endurance),
        ego: jitter(profile.stats.ego),
      },
      salary: Math.round(profile.salary * (0.9 + this.random.next() * 0.2)),
      level: 1 + this.random.int(3),
      morale: 60 + this.random.int(30),
      activity: role === 'GHOST' ? 'REMOTE' : 'WORKING',
      relations: {},
      history: ['hired'],
      look: this.random.int(18),
    };
  }

  /** Donne à chaque dev une affinité avec chaque collègue (sans écraser l'existante). */
  private linkRelations(): void {
    const devs = this.state.devs;
    this.state.devs = devs.map((dev) => {
      const relations: Record<string, number> = { ...dev.relations };
      for (const other of devs) {
        if (other.id !== dev.id && relations[other.id] === undefined) {
          relations[other.id] = Math.round(this.random.next() * 160 - 80);
        }
      }
      return { ...dev, relations };
    });
  }

  private createTask(title: (typeof TASK_TITLES)[number]): TaskView {
    const type = TASK_TYPES_BY_TITLE[title];
    return {
      id: this.id('task'),
      title,
      type,
      size: this.random.pick([1, 2, 3, 5, 8]),
      column: 'BACKLOG',
      assigneeId: null,
      progress: 0,
      impact: IMPACT_BY_TYPE[type],
    };
  }

  private createCandidates(): CandidateView[] {
    const roles: DevRole[] = [
      'SENIOR_BEARD',
      'TEN_X',
      'INTERN',
      'RUSTACEAN',
      'DESIGNER',
      'PRODUCT_OWNER',
      'AI_AGENT',
      'GHOST',
    ];
    return [0, 1, 2].map(() => {
      const dev = this.createDev(this.random.pick(roles));
      return { id: this.id('candidate'), dev, askingSalary: Math.round(dev.salary * 1.1) };
    });
  }

  private itemEffect(effect: 'coffee' | 'morale'): number {
    return this.state.items.reduce((sum, item) => {
      const def: CatalogItem | undefined = catalogItem(item.kind);
      const value = def?.effects[effect];
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function applyImpact(gauges: Gauges, impact: Partial<Gauges>): Gauges {
  return {
    treasury: gauges.treasury + (impact.treasury ?? 0),
    coffee: clamp(gauges.coffee + (impact.coffee ?? 0), 0, 100),
    debt: clamp(gauges.debt + (impact.debt ?? 0), 0, 100),
    stability: clamp(gauges.stability + (impact.stability ?? 0), 0, 100),
    hype: clamp(gauges.hype + (impact.hype ?? 0), 0, 100),
    users: Math.max(0, gauges.users + (impact.users ?? 0)),
  };
}

/** Pour le catalogue de la boutique : objets disponibles à une phase donnée. */
export function availableItems(phase: Phase): readonly CatalogItem[] {
  return CATALOG.filter((item) => PHASES.indexOf(item.minPhase) <= PHASES.indexOf(phase));
}
