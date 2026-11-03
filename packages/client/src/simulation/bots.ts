import {
  FURNITURE_CATALOG,
  ROLE_PROFILES,
  TEAM_LIFE,
  OUTINGS,
  OUTING_DEFINITIONS,
  getMeetingFormat,
  ROLE_TRADE,
  TRAININGS,
  branchNodes,
  skillsEnabled,
  taskTrade,
  type CardEffects,
  type CleaningPlanId,
  type Command,
  type DevRole,
  type EventCard,
  type FinancingKind,
  type GameState,
  type MeetingFormatId,
  type SkillBranch,
  type SkillId,
  type TaskTrade,
  type TaskType,
  SUPPORT,
  SUPPORT_MAX_AGENTS,
} from '@oss/shared';
import type { CardLibrary } from '../events/library';
import { runwayMonths } from './economy';
import { financingOffers } from './financing';
import { expectedAnswer } from './fundraising';
import { canPlace, findFreeSlot, phaseIndex } from './furniture';
import { devIds, teamMax, teamMoral, teamSize } from './helpers';
import { meetingFormatBlocker } from './meetings';
import { hasSkillTree, skillPoints } from './skills';
import { Rng } from './rng';
import type { Simulation } from './simulation';
import { subscriptionOf } from './subscriptions';
import { tasksInColumn } from './tasks';
import { ticketsToday } from './support';
import { leaveSlots } from './teamLife';
import { retroWinner } from './retro';
import { outingBlocker } from './teamBuilding';
import { activeVentures, investableCash, ventureBlocker, ventureOffers } from './ventures';

/**
 * Joueurs automatiques (« bots »), utilisés par `pnpm balance` pour simuler des milliers
 * de parties sans navigateur, et par les tests. Un bot ne lit que l'état et n'agit que
 * par des commandes, exactement comme un humain. Il a son propre générateur aléatoire,
 * pour ne pas perturber celui de la partie.
 */
export interface Bot {
  readonly name: string;
  /** Commandes à envoyer maintenant (la partie est bloquée : planification, carte, démo...). */
  decide(state: Readonly<GameState>, cards: CardLibrary): Command[];
}

/** Valeur approximative d'un choix de carte, du point de vue d'un joueur raisonnable. */
export function scoreEffects(effects: CardEffects, state: Readonly<GameState>): number {
  let score = 0;
  score += (effects.treasury ?? 0) / Math.max(20_000, state.gauges.treasury / 20);
  score += (effects.hype ?? 0) / 4;
  score += (effects.users ?? 0) / 2;
  score -= (effects.debt ?? 0) / (state.gauges.debt > 50 ? 2 : 4);
  score += (effects.stability ?? 0) / (state.gauges.stability < 40 ? 2 : 4);
  score += (effects.moral ?? 0) / (teamMoral(state) < 40 ? 2 : 4);
  score += (effects.coffee ?? 0) / 10;
  score -= (effects.sprintsLost ?? 0) * 6;
  if (effects.fireDev) score -= 3;
  if (effects.spawnDev) score += teamSize(state) < teamMax(state) ? 1 : 0;
  if (effects.requeue) score -= 1.5;
  return score;
}

function bestChoice(card: EventCard, state: Readonly<GameState>): number {
  let best = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  card.choices.forEach((choice, index) => {
    const score = scoreEffects(choice.effects, state);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

/** Première position libre pour un objet (balayage de la grille). */
export function findFreeSpot(
  state: Readonly<GameState>,
  itemId: string,
): { x: number; y: number } | null {
  const item = FURNITURE_CATALOG.find((candidate) => candidate.id === itemId);
  if (!item) return null;
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 30; x++) {
      if (canPlace(state as GameState, item, x, y, 0)) return { x, y };
    }
  }
  return null;
}

function countFurniture(state: Readonly<GameState>, itemId: string): number {
  return Object.values(state.components.furniture).filter((f) => f.itemId === itemId).length;
}

interface PlanningStyle {
  /** Priorité de chaque type de tâche (plus haut = d'abord). */
  priority: (type: TaskType, state: Readonly<GameState>) => number;
  /** Profils évités au recrutement. */
  avoidRoles: readonly DevRole[];
  /** Mois de trésorerie minimum pour embaucher. */
  hireRunway: number;
  /** Ratio de l'offre par rapport au salaire demandé. */
  offerRatio: number;
  /** Lever des fonds sous ce nombre de mois de trésorerie. */
  pitchRunway: number;
  buysFurniture: boolean;
  /** Crée des filiales dès que possible (et revend ses parts si l'argent manque). */
  invests?: boolean;
  /** Formule voulue pour la salle de réunion (null : salle vide). */
  meetingRoom?: (state: Readonly<GameState>) => MeetingFormatId | null;
  /** Utilise les autres financements (prêt, business angels…) quand l'argent manque. */
  finances?: boolean;
  /** Pose des congés à ceux qui ont 5 jours en réserve (vie d'équipe). */
  booksLeave?: boolean;
  /** Tient la rétrospective et suit le vote de l'équipe. */
  holdsRetro?: boolean;
  /** Réserve une sortie d'équipe quand le moral moyen passe sous 50. */
  teamBuilds?: boolean;
  /** Dépense les points de compétence et paie des formations (arbre de compétences). */
  skills?: boolean;
}

/** Bot « raisonnable », paramétré par un style de jeu. */
class PlannerBot implements Bot {
  constructor(
    readonly name: string,
    private readonly style: PlanningStyle,
  ) {}

  decide(state: Readonly<GameState>, cards: CardLibrary): Command[] {
    const pending = state.events.pending;
    if (pending) {
      const card = cards.get(pending.cardId);
      return [{ type: 'RESOLVE_EVENT', choiceIndex: card ? bestChoice(card, state) : 0 }];
    }
    switch (state.stage) {
      case 'PITCH':
        return this.pitch(state);
      case 'DEMO':
        return [...this.endgame(state), { type: 'END_DEMO' }];
      case 'PLANNING':
        // Augmentation accordée si la trésorerie tient encore la moitié de sa marge d'embauche.
        if (state.raises.pending)
          return [
            {
              type: 'ANSWER_RAISE',
              accept: runwayMonths(state as GameState) >= this.style.hireRunway / 2,
            },
          ];
        // Rétrospective : l'action votée par l'équipe (moral pour tous, bonus au sprint).
        if (this.style.holdsRetro && state.retro.pending?.sprint === state.sprint) {
          const { options, votes } = state.retro.pending;
          return [{ type: 'HOLD_RETRO', action: retroWinner(options, votes) }, ...this.plan(state)];
        }
        return this.plan(state);
      default:
        return [];
    }
  }

  private pitch(state: Readonly<GameState>): Command[] {
    const pitch = state.pitch;
    if (!pitch || pitch.result) return [{ type: 'CLOSE_PITCH' }];
    // Le bot ne triche pas : il estime chaque réponse sans connaître les tirages.
    let best = pitch.options[0] ?? '';
    let bestValue = Number.NEGATIVE_INFINITY;
    for (const id of pitch.options) {
      const value = expectedAnswer(state as GameState, pitch, id);
      if (value > bestValue) {
        bestValue = value;
        best = id;
      }
    }
    return [{ type: 'PITCH_ARGUMENT', argumentId: best }];
  }

  private endgame(state: Readonly<GameState>): Command[] {
    // Mode illimité : les bots visent la distance, ils ne vendent pas et n'entrent pas en Bourse.
    if (state.mode === 'ENDLESS') return [];
    const offer = state.acquisitionOffer;
    if (
      offer &&
      (offer.amount > state.valuation * 1.1 ||
        (state.sprint >= state.totalSprints - 3 && state.phase !== 'UNICORN'))
    ) {
      return [{ type: 'ANSWER_ACQUISITION', accept: true }];
    }
    if (
      state.phase === 'UNICORN' &&
      state.gauges.stability >= 50 &&
      state.sprint >= state.totalSprints - 6
    ) {
      return [{ type: 'LAUNCH_IPO' }];
    }
    return [];
  }

  private plan(state: Readonly<GameState>): Command[] {
    const commands: Command[] = [];
    const { style } = this;
    const runway = runwayMonths(state as GameState);

    // 1. Levée de fonds quand la trésorerie baisse (ou pour sortir du garage).
    const cooldownOk = state.lastPitchSprint === null || state.sprint - state.lastPitchSprint >= 3;
    // On lève aussi pour passer à la phase suivante quand l'équipe est au complet.
    const blockedByPhase =
      teamSize(state) >= teamMax(state) && (state.phase === 'GARAGE' || state.phase === 'SEED');
    const wantsMoney = runway < style.pitchRunway || blockedByPhase;
    if (cooldownOk && wantsMoney && state.gauges.hype > 15) return [{ type: 'START_PITCH' }];
    // Sinon, un financement sans pitch : subvention et prêt d'abord (sans dilution).
    if (style.finances && runway < style.pitchRunway) commands.push(...this.finance(state));

    // 2. Filiales : un projet audacieux, sinon prudent, si la trésorerie le permet.
    if (style.invests) commands.push(...this.invest(state, runway));

    // 2 bis. Salle de réunion : la formule voulue, si on a de la marge.
    const format = style.meetingRoom?.(state) ?? null;
    if (format && format !== state.meetingRoom?.format && runway > 9) {
      const blocker = meetingFormatBlocker(state as GameState, getMeetingFormat(format));
      if (blocker === null) commands.push({ type: 'FIT_MEETING_ROOM', format });
    }

    // 2 ter. Congés : une semaine à ceux qui ont 5 jours en réserve, s'il reste une place.
    if (style.booksLeave) commands.push(...leaveBookings(state));

    // 2 quater. Team building : la meilleure sortie possible quand le moral flanche.
    if (style.teamBuilds) commands.push(...teamOuting(state, runway));

    // 3. Recrutement.
    if (teamSize(state) < teamMax(state) && runway > style.hireRunway) {
      const candidate = state.candidates
        .filter(
          (c) =>
            c.status === 'OPEN' &&
            (state.mode === 'INTERNS_ONLY' || !style.avoidRoles.includes(c.identity.role)),
        )
        .sort((a, b) => b.stats.speed + b.stats.quality - (a.stats.speed + a.stats.quality))[0];
      if (candidate)
        commands.push({
          type: 'MAKE_OFFER',
          candidateId: candidate.id,
          salary: Math.round(candidate.askingSalary * style.offerRatio),
        });
    }

    // 4. Mobilier utile, et un abonnement de ménage à la mesure de l'équipe.
    if (style.buysFurniture) {
      commands.push(...this.furniture(state));
      const plan = sensibleCleaningPlan(state);
      if (plan && plan !== subscriptionOf(state, 'cleaning')?.offer.id && runway > 6)
        commands.push({ type: 'SUBSCRIBE', offer: plan });
      const agents = sensibleSupportAgents(state);
      if (agents !== state.support.agents)
        commands.push({ type: 'SET_SUPPORT', agents, duty: state.support.duty });
    }

    // 5. Kanban : on remplit TODO selon la capacité estimée de chaque métier (un 10x ou une
    // IA abattent plus de travail qu'un dev moyen ; la designeuse ne code pas).
    const capacity: Record<TaskTrade, number> = { DEV: 0, DESIGN: 0, PRODUCT: 0, QA: 0 };
    for (const id of devIds(state)) {
      const role = state.components.identity[id]?.role;
      const trade = role ? ROLE_TRADE[role] : null;
      if (role && trade) capacity[trade] += 9 * ROLE_PROFILES[role].speedMultiplier;
    }
    const planned: Record<TaskTrade, number> = { DEV: 0, DESIGN: 0, PRODUCT: 0, QA: 0 };
    for (const id of [
      ...tasksInColumn(state as GameState, 'TODO'),
      ...tasksInColumn(state as GameState, 'IN_PROGRESS'),
    ]) {
      const task = state.components.task[id];
      if (task) planned[taskTrade(task)] += task.size;
    }
    const backlog = tasksInColumn(state as GameState, 'BACKLOG').sort((a, b) => {
      const ta = state.components.task[a];
      const tb = state.components.task[b];
      if (!ta || !tb) return 0;
      return style.priority(tb.type, state) - style.priority(ta.type, state) || ta.size - tb.size;
    });
    for (const id of backlog) {
      const task = state.components.task[id];
      if (!task || style.priority(task.type, state) < 0) continue;
      const trade = taskTrade(task);
      if (planned[trade] >= capacity[trade]) continue;
      commands.push({ type: 'MOVE_TASK', taskId: id, column: 'TODO' });
      planned[trade] += task.size;
    }
    // 6. Arbre de compétences : points dépensés, et un livre ou une formation si on a de la marge.
    if (style.skills) commands.push(...skillCommands(state, runway));
    commands.push({ type: 'START_SPRINT' });
    return commands;
  }

  private invest(state: Readonly<GameState>, runway: number): Command[] {
    const commands: Command[] = [];
    const ventures = activeVentures(state as GameState);
    // Trésorerie en danger : on revend la filiale qui vaut le plus.
    if (runway < 4 && ventures.length > 0) {
      const richest = [...ventures].sort((a, b) => b.valuation - a.valuation)[0];
      if (richest) commands.push({ type: 'SELL_VENTURE', ventureId: richest.id });
      return commands;
    }
    if (ventureBlocker(state as GameState) !== null || runway < 12) return commands;
    const cash = investableCash(state as GameState);
    const offers = ventureOffers(state as GameState).filter((offer) => offer.cost <= cash);
    const pick =
      offers.find((offer) => offer.idea.risk === 'BOLD') ??
      offers.find((offer) => offer.idea.risk === 'SAFE');
    if (pick) commands.push({ type: 'FOUND_VENTURE', ideaId: pick.idea.id });
    return commands;
  }

  private finance(state: Readonly<GameState>): Command[] {
    const order: FinancingKind[] = ['GRANT', 'LOAN', 'CROWDFUNDING', 'BRIDGE'];
    const offer = order
      .map((kind) => financingOffers(state as GameState).find((o) => o.kind === kind))
      .find((o) => o !== undefined && o.blocker === null);
    return offer ? [{ type: 'TAKE_FINANCING', kind: offer.kind }] : [];
  }

  private furniture(state: Readonly<GameState>): Command[] {
    const commands: Command[] = [];
    let budget = state.gauges.treasury * 0.02;
    const buy = (itemId: string) => {
      const item = FURNITURE_CATALOG.find((i) => i.id === itemId);
      if (!item || item.price > budget || phaseIndex(state.phase) < phaseIndex(item.minPhase))
        return;
      if (countFurniture(state, itemId) >= item.maxCount) return;
      const spot = findFreeSpot(state, itemId);
      if (!spot) return;
      budget -= item.price;
      commands.push({ type: 'BUY_FURNITURE', itemId, x: spot.x, y: spot.y, rotation: 0 });
    };
    // Un appareil se pose sur un meuble de cuisine : le bot achète d'abord le meuble, puis
    // l'appareil à la décision suivante.
    const buyAppliance = (itemId: string) => {
      const item = FURNITURE_CATALOG.find((i) => i.id === itemId);
      if (!item || item.price > budget || countFurniture(state, itemId) >= item.maxCount) return;
      const spot = findFreeSlot(state as GameState, itemId);
      if (!spot) {
        buy('kitchen-doors');
        return;
      }
      budget -= item.price;
      commands.push({ type: 'BUY_ACCESSORY', itemId, ...spot, rotation: 0 });
    };
    const team = teamSize(state);
    if (team >= 3 && countFurniture(state, 'espresso-machine') < Math.ceil(team / 6))
      buyAppliance('espresso-machine');
    if (team > countFurniture(state, 'desk') + countFurniture(state, 'ikea-desk')) buy('desk');
    if (Object.values(state.components.identity).some((i) => i.role === 'PRODUCT_OWNER'))
      buy('earbuds-dock');
    if (state.gauges.debt > 30) buy('trashcan');
    if (teamMoral(state) < 60) buy('plant');
    if (state.gauges.stability < 70) buy('server-rack');
    return commands;
  }
}

/** Bot qui joue au hasard : la référence « joueur qui découvre le jeu ». */
class RandomBot implements Bot {
  readonly name = 'random';
  private readonly rng: Rng;

  constructor(seed: string) {
    this.rng = Rng.fromSeed(`bot:${seed}`);
  }

  decide(state: Readonly<GameState>, cards: CardLibrary): Command[] {
    const rng = this.rng;
    const pending = state.events.pending;
    if (pending) {
      const card = cards.get(pending.cardId);
      return [{ type: 'RESOLVE_EVENT', choiceIndex: rng.int(0, (card?.choices.length ?? 1) - 1) }];
    }
    switch (state.stage) {
      case 'PITCH':
        return state.pitch && !state.pitch.result
          ? [{ type: 'PITCH_ARGUMENT', argumentId: rng.pick(state.pitch.options) }]
          : [{ type: 'CLOSE_PITCH' }];
      case 'DEMO':
        if (state.acquisitionOffer && rng.chance(0.3))
          return [{ type: 'ANSWER_ACQUISITION', accept: true }];
        return [{ type: 'END_DEMO' }];
      case 'PLANNING': {
        if (state.raises.pending) return [{ type: 'ANSWER_RAISE', accept: rng.chance(0.5) }];
        if (rng.chance(0.15)) return [{ type: 'START_PITCH' }, { type: 'START_SPRINT' }];
        const commands: Command[] = [];
        const open = state.candidates.filter((c) => c.status === 'OPEN');
        if (open.length > 0 && rng.chance(0.5)) {
          const candidate = rng.pick(open);
          commands.push({
            type: 'MAKE_OFFER',
            candidateId: candidate.id,
            salary: Math.round(candidate.askingSalary * rng.range(0.8, 1.2)),
          });
        }
        for (const id of tasksInColumn(state as GameState, 'BACKLOG')) {
          if (rng.chance(0.4)) commands.push({ type: 'MOVE_TASK', taskId: id, column: 'TODO' });
        }
        commands.push({ type: 'START_SPRINT' });
        return commands;
      }
      default:
        return [];
    }
  }
}

/** Congés qu'un joueur attentif poserait : 5 jours aux devs qui les ont, une semaine libre. */
export function leaveBookings(state: Readonly<GameState>): Command[] {
  const life = state.teamLife;
  if (!life) return [];
  const slots = leaveSlots(state as GameState);
  const firstDay = (state.sprint - 1) * 14;
  const taken = [0, 1].map(
    (week) =>
      Object.values(life.absences).filter(
        (absence) => absence.kind === 'LEAVE' && absence.from === firstDay + week * 7,
      ).length,
  );
  const commands: Command[] = [];
  for (const id of devIds(state)) {
    if ((life.leave[id] ?? 0) < TEAM_LIFE.leaveDaysMax || life.absences[id]) continue;
    const week = taken.findIndex((count) => count < slots);
    if (week !== 0 && week !== 1) break;
    taken[week] = (taken[week] ?? 0) + 1;
    commands.push({ type: 'BOOK_LEAVE', devId: id, week, days: TEAM_LIFE.leaveDaysMax });
  }
  return commands;
}

/** La sortie qu'un joueur attentif réserverait : la plus chère qu'il peut se permettre. */
export function teamOuting(state: Readonly<GameState>, runway: number): Command[] {
  if (teamMoral(state) >= 50 || runway < 6 || teamSize(state) < 2) return [];
  const outing = [...OUTINGS]
    .reverse()
    .find((id) => outingBlocker(state as GameState, OUTING_DEFINITIONS[id]) === null);
  return outing ? [{ type: 'BOOK_TEAM_BUILDING', outing }] : [];
}

const fixPriority = (state: Readonly<GameState>) => state.gauges.stability < 60;

/** Branches préférées d'un profil, dans l'ordre : ce qu'un joueur logique choisirait. */
export function preferredBranches(role: DevRole): SkillBranch[] {
  switch (role) {
    case 'PRODUCT_OWNER':
    case 'DESIGNER':
      return ['HUMAN', 'SPEED', 'TECH'];
    case 'TEN_X':
    case 'AI_AGENT':
    case 'GHOST':
    case 'FRONTEND':
    case 'BACKEND':
    case 'FULLSTACK':
      return ['SPEED', 'TECH', 'HUMAN'];
    default:
      return ['TECH', 'HUMAN', 'SPEED'];
  }
}

/**
 * Choix de compétences d'un bot : chaque point va au premier nœud libre de la branche préférée
 * (le nœud de métier dès qu'il est accessible). Le Crunch est laissé de côté : c'est un pouvoir
 * à déclencher pendant le sprint, et le bot ne joue que quand la partie est bloquée. Puis un
 * livre (ou une formation, avec beaucoup de marge) pour le dev le moins expérimenté.
 */
export function skillCommands(state: Readonly<GameState>, runway: number): Command[] {
  if (!skillsEnabled(state.mode)) return [];
  const commands: Command[] = [];
  const devs = devIds(state).filter((id) => hasSkillTree(state as GameState, id));
  for (const devId of devs) {
    const role = state.components.identity[devId]?.role;
    if (!role) continue;
    const learned = new Set<SkillId>(state.components.skills[devId]?.learned ?? []);
    let points = skillPoints(state as GameState, devId).available;
    while (points > 0) {
      const next = preferredBranches(role)
        .flatMap((branch) => {
          const nodes = branchNodes(branch, role);
          const own = nodes.filter((node) => node.role !== undefined || node.id === 'versatile');
          return [...own, ...nodes.filter((node) => !own.includes(node))];
        })
        .find(
          (node) =>
            !node.active &&
            !learned.has(node.id) &&
            (node.requires === null || learned.has(node.requires)),
        );
      if (!next) break;
      learned.add(next.id);
      points -= 1;
      commands.push({ type: 'LEARN_SKILL', devId, skill: next.id });
    }
  }
  if (devs.length > 0 && runway > 12) {
    const levelOf = (id: string) => state.components.employment[id]?.level ?? 1;
    const student = [...devs]
      .filter((id) => state.components.skills[id]?.trainedSprint !== state.sprint)
      .sort((a, b) => levelOf(a) - levelOf(b))[0];
    const book = TRAININGS[0];
    const course = TRAININGS[1];
    if (student && book && course) {
      const kind = runway > 24 && state.gauges.treasury > course.price * 50 ? course : book;
      commands.push({ type: 'TRAIN_DEV', devId: student, kind: kind.kind });
    }
  }
  return commands;
}

export const BOT_NAMES = [
  'random',
  'shipper',
  'balanced',
  'cautious',
  'investor',
  'organizer',
  'financier',
  'rested',
  'retro',
  'teambuilder',
  'coach',
] as const;
export type BotName = (typeof BOT_NAMES)[number];

const balancedPriority = (type: TaskType, state: Readonly<GameState>) => {
  if (type === 'REFACTO') return state.gauges.debt > 35 ? 4 : 1;
  if (type === 'BUGFIX' || type === 'INFRA') return fixPriority(state) ? 4 : 1;
  return 3;
};

/**
 * Comme « balanced », mais il aménage la salle de réunion avec la formule que `pick` choisit.
 * `pnpm balance` s'en sert pour comparer les formules entre elles.
 */
export function createOrganizerBot(
  name: string,
  pick: (state: Readonly<GameState>) => MeetingFormatId | null,
): Bot {
  return new PlannerBot(name, {
    priority: balancedPriority,
    avoidRoles: ['INTERN'],
    hireRunway: 10,
    offerRatio: 1.05,
    pitchRunway: 10,
    buysFurniture: true,
    meetingRoom: pick,
  });
}

/** La formule qu'un joueur attentif choisirait selon la phase et l'état du bureau. */
export function sensibleMeetingRoom(state: Readonly<GameState>): MeetingFormatId | null {
  const hasPO = Object.values(state.components.identity).some((i) => i.role === 'PRODUCT_OWNER');
  switch (state.phase) {
    case 'GARAGE':
      return null;
    case 'SEED':
      return hasPO ? 'standup' : 'brainstorm';
    case 'SERIES_A':
      return state.gauges.stability < 60
        ? 'war-room'
        : teamMoral(state) < 55
          ? 'zen'
          : 'brainstorm';
    default:
      return state.meetingRoom?.format === 'boardroom' || state.gauges.treasury > 2_000_000
        ? 'boardroom'
        : (state.meetingRoom?.format ?? 'brainstorm');
  }
}

/** L'abonnement de ménage qu'un joueur attentif prendrait : plus de passages avec l'équipe. */
export function sensibleCleaningPlan(state: Readonly<GameState>): CleaningPlanId | null {
  const team = teamSize(state);
  if (team === 0) return null;
  return team <= 2 ? 'cleaning-weekly' : team <= 6 ? 'cleaning-twice' : 'cleaning-daily';
}

/**
 * Les agents de support qu'un joueur attentif garderait : de quoi traiter les tickets du jour et
 * résorber l'attente en une semaine, dans la limite de la phase.
 */
export function sensibleSupportAgents(state: Readonly<GameState>): number {
  const needed = (ticketsToday(state) + state.support.backlog / 5) / SUPPORT.agentCapacity;
  return Math.min(SUPPORT_MAX_AGENTS[state.phase], Math.ceil(needed - 0.25));
}

/** Crée un bot par son nom. `seed` ne sert qu'au bot aléatoire. */
export function createBot(name: BotName, seed: string): Bot {
  switch (name) {
    case 'random':
      return new RandomBot(seed);
    case 'shipper':
      // « Move fast and break things » : que des features, le plus vite possible.
      return new PlannerBot(name, {
        priority: (type) => (type === 'FEATURE' ? 3 : type === 'BUGFIX' ? 0 : -1),
        avoidRoles: ['DESIGNER', 'PRODUCT_OWNER'],
        hireRunway: 6,
        offerRatio: 1.1,
        pitchRunway: 8,
        buysFurniture: false,
      });
    case 'balanced':
      // Garde la dette sous contrôle et répare la prod quand elle vacille.
      return new PlannerBot(name, {
        priority: (type, state) => {
          if (type === 'REFACTO') return state.gauges.debt > 35 ? 4 : 1;
          if (type === 'BUGFIX' || type === 'INFRA') return fixPriority(state) ? 4 : 1;
          return 3;
        },
        avoidRoles: ['INTERN'],
        hireRunway: 10,
        offerRatio: 1.05,
        pitchRunway: 10,
        buysFurniture: true,
      });
    case 'investor':
      // Comme « balanced », mais il crée des filiales dès la Série A.
      return new PlannerBot(name, {
        priority: (type, state) => {
          if (type === 'REFACTO') return state.gauges.debt > 35 ? 4 : 1;
          if (type === 'BUGFIX' || type === 'INFRA') return fixPriority(state) ? 4 : 1;
          return 3;
        },
        avoidRoles: ['INTERN'],
        hireRunway: 10,
        offerRatio: 1.05,
        pitchRunway: 10,
        buysFurniture: true,
        invests: true,
      });
    case 'organizer':
      // Comme « balanced », et il aménage la salle de réunion selon la phase.
      return createOrganizerBot(name, sensibleMeetingRoom);
    case 'financier':
      // Comme « balanced », mais il complète les tours de table par les autres financements.
      return new PlannerBot(name, {
        priority: (type, state) => {
          if (type === 'REFACTO') return state.gauges.debt > 35 ? 4 : 1;
          if (type === 'BUGFIX' || type === 'INFRA') return fixPriority(state) ? 4 : 1;
          return 3;
        },
        avoidRoles: ['INTERN'],
        hireRunway: 10,
        offerRatio: 1.05,
        pitchRunway: 10,
        buysFurniture: true,
        finances: true,
      });
    case 'rested':
      // Comme « balanced », mais il pose les congés de l'équipe au lieu d'attendre qu'ils
      // les réclament.
      return new PlannerBot(name, {
        priority: balancedPriority,
        avoidRoles: ['INTERN'],
        hireRunway: 10,
        offerRatio: 1.05,
        pitchRunway: 10,
        buysFurniture: true,
        booksLeave: true,
      });
    case 'retro':
      // Comme « balanced », mais il tient la rétrospective et suit le vote de l'équipe.
      return new PlannerBot(name, {
        priority: balancedPriority,
        avoidRoles: ['INTERN'],
        hireRunway: 10,
        offerRatio: 1.05,
        pitchRunway: 10,
        buysFurniture: true,
        holdsRetro: true,
      });
    case 'teambuilder':
      // Comme « balanced », mais il emmène l'équipe en sortie quand le moral flanche.
      return new PlannerBot(name, {
        priority: balancedPriority,
        avoidRoles: ['INTERN'],
        hireRunway: 10,
        offerRatio: 1.05,
        pitchRunway: 10,
        buysFurniture: true,
        teamBuilds: true,
      });
    case 'coach':
      // Comme « balanced », mais il fait progresser l'équipe : arbre de compétences et formations.
      return new PlannerBot(name, {
        priority: balancedPriority,
        avoidRoles: ['INTERN'],
        hireRunway: 10,
        offerRatio: 1.05,
        pitchRunway: 10,
        buysFurniture: true,
        skills: true,
      });
    case 'cautious':
      // Code propre, petite équipe, levées tardives.
      return new PlannerBot(name, {
        priority: (type) => (type === 'REFACTO' ? 4 : type === 'FEATURE' ? 2 : 3),
        avoidRoles: ['INTERN', 'TEN_X', 'AI_AGENT'],
        hireRunway: 18,
        offerRatio: 1,
        pitchRunway: 6,
        buysFurniture: true,
      });
  }
}

/** Joue une partie entière avec un bot (ou jusqu'à ce que `until` soit vrai). */
export function playWithBot(
  simulation: Simulation,
  bot: Bot,
  cards: CardLibrary,
  until: (state: Readonly<GameState>) => boolean = () => false,
  maxDecisions = 5000,
): void {
  for (
    let i = 0;
    i < maxDecisions && simulation.state.stage !== 'ENDED' && !until(simulation.state);
    i++
  ) {
    if (simulation.isRunning) {
      simulation.runUntilBlocked();
      continue;
    }
    const commands = bot.decide(simulation.state, cards);
    let progressed = false;
    for (const command of commands)
      progressed = simulation.dispatch(command).result.ok || progressed;
    // Sécurité : si toutes les commandes du bot sont refusées, on force la suite.
    if (!progressed) {
      const fallback: Command = simulation.state.events.pending
        ? { type: 'RESOLVE_EVENT', choiceIndex: 0 }
        : simulation.state.raises.pending
          ? { type: 'ANSWER_RAISE', accept: true }
          : simulation.state.stage === 'PITCH'
            ? { type: 'CLOSE_PITCH' }
            : simulation.state.stage === 'DEMO'
              ? { type: 'END_DEMO' }
              : { type: 'START_SPRINT' };
      simulation.dispatch(fallback);
    }
  }
}
