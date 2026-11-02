import {
  CommandSchema,
  TIME,
  getFurniture,
  type Command,
  type CommandResult,
  type GameState,
  type LoggedCommand,
  type Notification,
} from '@oss/shared';
import { eventSystem } from '../events/draw';
import type { CardLibrary } from '../events/library';
import { checkAchievements } from './achievements';
import { applyCommand } from './commands';
import { endGame } from './endings';
import { computeOfficeEffects, type OfficeEffects } from './furniture';
import type { SimContext } from './helpers';
import { migrateLegacyKitchen } from './kitchen';
import { Rng } from './rng';
import { endSprint } from './sprint';
import { migrateCommand, migrateRenamedItems } from './renamedItems';
import { createEmptyState, setupNewGame, type GameConfig } from './state';
import { activitySystem } from './systems/activity';
import { calendarSystem } from './systems/calendar';
import { dailySystem } from './systems/daily';
import { incidentSystem } from './systems/incidents';
import { coffeeSystem, energySystem } from './systems/needs';
import { remoteSystem } from './systems/remote';
import { absentIds, teamLifeSystem } from './teamLife';
import { teamBuildingSystem } from './teamBuilding';
import { taskFlowSystem } from './taskFlow';
import { workSystem } from './systems/work';
import { getClock, type SimClock } from './time';
import { emergencySale } from './ventures';
import { isSummer, serverHeatSystem } from './serverRoom';
import { cleaningSystem } from './cleaning';
import { checkMission } from './story';
import { migrateLegacyFibre, subscriptionSystem } from './subscriptions';

/** Un système = une fonction qui fait évoluer l'état pendant un tick. */
export type System = (state: GameState, ctx: SimContext, clock: SimClock) => void;

/** Ordre d'exécution des systèmes à chaque tick (l'ordre compte pour le déterminisme). */
export const SYSTEMS: readonly System[] = [
  activitySystem,
  workSystem,
  coffeeSystem,
  teamLifeSystem,
  teamBuildingSystem,
  remoteSystem,
  (state, ctx) => energySystem(state, ctx),
  incidentSystem,
  taskFlowSystem,
  eventSystem,
  dailySystem,
  calendarSystem,
  (state, ctx) => subscriptionSystem(state, ctx),
  (state, ctx) => serverHeatSystem(state, ctx),
  cleaningSystem,
];

export interface DispatchResult {
  result: CommandResult;
  notifications: Notification[];
}

/**
 * La simulation d'une partie. Elle ne connaît ni l'écran, ni l'horloge réelle :
 * on l'avance tick par tick avec `step()` et on la pilote avec `dispatch(commande)`.
 * Le Web Worker, le script d'équilibrage et le serveur l'utilisent de la même façon.
 */
export class Simulation {
  /** Commandes acceptées, avec leur tick : de quoi rejouer la partie. */
  readonly commands: LoggedCommand[];

  /** Cache des effets du mobilier (recalculés seulement quand le bureau ou l'équipe change). */
  private officeCache: { key: string; effects: OfficeEffects } | null = null;

  private constructor(
    readonly state: GameState,
    private readonly cards: CardLibrary,
    commands: LoggedCommand[],
  ) {
    this.commands = commands;
  }

  /** Nouvelle partie à partir d'une graine. */
  static create(config: GameConfig, cards: CardLibrary): Simulation {
    const simulation = new Simulation(createEmptyState(config), cards, []);
    setupNewGame(simulation.state, simulation.context());
    return simulation;
  }

  /** Reprend une partie sauvegardée (l'état doit avoir été validé par le schéma Zod). */
  static restore(state: GameState, cards: CardLibrary, commands: LoggedCommand[] = []): Simulation {
    migrateRenamedItems(state);
    // Vieilles sauvegardes : les combinés meuble + appareil de cuisine deviennent deux objets.
    migrateLegacyKitchen(state);
    // Vieilles sauvegardes : l'abonnement fibre rejoint la liste des abonnements.
    migrateLegacyFibre(state);
    return new Simulation(state, cards, commands);
  }

  /**
   * Toute modification du mobilier ou de l'équipe ajoute une entité (nextEntityId change)
   * ou en retire une (un des deux compteurs change). Les postes vont aux devs présents au
   * bureau : la liste des télétravailleurs fait donc aussi partie de la clé, comme la formule
   * de la salle de réunion, les ordinateurs des bureaux (changés sans nouvelle entité),
   * les abonnements, la salle de chaque équipement serveur (déplaçable d'une salle à l'autre)
   * et l'été (les salles des serveurs chauffent plus).
   */
  private officeEffects(): OfficeEffects {
    const { state } = this;
    const key = `${state.meetingRoom?.format ?? '-'}:${state.pets.map((pet) => pet.id).join(',')}:${state.nextEntityId}:${Object.keys(state.components.furniture).length}:${Object.keys(state.components.identity).length}:${Object.keys(state.components.remote).join(',')}:${absentIds(state, getClock(state).day).join(',')}:${computersKey(state)}:${state.subscriptions.map((s) => s.offer).join(',')}:${serverGearKey(state)}:${isSummer(state) ? 'été' : ''}`;
    if (this.officeCache?.key !== key)
      this.officeCache = { key, effects: computeOfficeEffects(state) };
    return this.officeCache.effects;
  }

  private context(): SimContext {
    return {
      rng: new Rng(this.state.rng),
      cards: this.cards,
      outbox: [],
      office: this.officeEffects(),
    };
  }

  /** La simulation avance-t-elle ? (Non en planification, en démo, ou face à une carte.) */
  get isRunning(): boolean {
    const { stage, events, mode } = this.state;
    return stage === 'EXECUTION' && (events.pending === null || mode === 'HARDCORE');
  }

  /** Avance d'un tick (30 minutes simulées). Renvoie les notifications émises. */
  step(): Notification[] {
    if (!this.isRunning) return [];
    const state = this.state;
    const ctx = this.context();
    const clock = getClock(state);
    for (const system of SYSTEMS) {
      system(state, ctx, clock);
      if (state.stage === 'ENDED') break;
    }
    if (state.stage !== 'ENDED') {
      state.tick += 1;
      state.sprintTick += 1;
      if (state.gauges.treasury < 0 && !emergencySale(state, ctx))
        endGame(state, ctx, 'BANKRUPTCY');
      else if (state.sprintTick >= TIME.ticksPerSprint) endSprint(state, ctx);
    }
    checkMission(state, ctx);
    checkAchievements(state, ctx);
    return ctx.outbox;
  }

  /** Avance jusqu'à un blocage (planification, carte, démo, fin) ou `maxTicks`. */
  runUntilBlocked(maxTicks = TIME.ticksPerSprint): Notification[] {
    const notifications: Notification[] = [];
    for (let i = 0; i < maxTicks && this.isRunning; i++) notifications.push(...this.step());
    return notifications;
  }

  /** Applique une commande du joueur. Les commandes acceptées sont journalisées. */
  dispatch(input: Command): DispatchResult {
    const parsed = CommandSchema.safeParse(input);
    if (!parsed.success)
      return { result: { ok: false, error: 'INVALID_COMMAND' }, notifications: [] };
    const command = migrateCommand(parsed.data);
    const ctx = this.context();
    const result = applyCommand(this.state, ctx, command);
    if (result.ok) {
      this.commands.push({ tick: this.state.tick, command });
      checkMission(this.state, ctx);
      checkAchievements(this.state, ctx);
    }
    return { result, notifications: ctx.outbox };
  }
}

/** Ordinateurs choisis (hors tour sobre), pour invalider le cache des effets du bureau. */
function computersKey(state: GameState): string {
  let key = '';
  for (const [id, item] of Object.entries(state.components.furniture))
    if (item.computer) key += `${id}=${item.computer},`;
  return key;
}

/** Salle de chaque équipement serveur : le déplacer d'une salle à l'autre change les effets. */
function serverGearKey(state: GameState): string {
  let key = '';
  for (const [id, item] of Object.entries(state.components.furniture))
    if (getFurniture(item.itemId)?.serverGear) key += `${id}@${item.hostId ?? ''},`;
  return key;
}
