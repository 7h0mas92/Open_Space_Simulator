import {
  EVENT_CARDS,
  type EventCard,
  type GameMode,
  type LoggedCommand,
  type StoryMissionId,
  type StoryRewardId,
} from '@oss/shared';
import { CardLibrary, createBot, playWithBot, Simulation } from '@oss/client/simulation';

/** Joue une partie complète avec un bot, comme un joueur l'aurait fait dans le navigateur. */
export function playGame(
  seed: string,
  mode: GameMode = 'SHIP_IN_3',
  bot: 'balanced' | 'shipper' | 'random' = 'balanced',
  deck: readonly EventCard[] = EVENT_CARDS,
) {
  const cards = new CardLibrary(deck);
  const simulation = Simulation.create({ seed, mode }, cards);
  playWithBot(simulation, createBot(bot, seed), cards);
  const result = simulation.state.result;
  if (!result) throw new Error('La partie de test ne s’est pas terminée');
  return { commands: simulation.commands as LoggedCommand[], result, state: simulation.state };
}

/** Joue une mission du mode Histoire avec un bot (la première mission est gagnée par `balanced`). */
export function playMission(seed: string, mission: StoryMissionId = 'first-commit') {
  const cards = new CardLibrary(EVENT_CARDS);
  const simulation = Simulation.create({ seed, mode: 'STORY', mission }, cards);
  playWithBot(simulation, createBot('balanced', seed), cards);
  return { commands: simulation.commands as LoggedCommand[], state: simulation.state };
}

/**
 * Joue la longue partie du mode Histoire avec un bot jusqu'à ce que l'objectif secondaire soit
 * rempli (la partie est encore en cours).
 */
export function playCampaign(seed: string, goal: StoryMissionId = 'leave-garage') {
  const cards = new CardLibrary(EVENT_CARDS);
  const simulation = Simulation.create({ seed, mode: 'STORY', mission: 'campaign' }, cards);
  playWithBot(simulation, createBot('balanced', seed), cards, (state) =>
    Boolean(state.story?.campaign?.done.includes(goal)),
  );
  return { commands: simulation.commands as LoggedCommand[], state: simulation.state };
}

/** Partie du défi en 3 sprints jouée avec des récompenses du mode Histoire. */
export function playWithUnlocks(seed: string, unlocks: StoryRewardId[]) {
  const cards = new CardLibrary(EVENT_CARDS);
  const simulation = Simulation.create({ seed, mode: 'SHIP_IN_3', unlocks }, cards);
  playWithBot(simulation, createBot('balanced', seed), cards);
  const result = simulation.state.result;
  if (!result) throw new Error('La partie de test ne s’est pas terminée');
  return { commands: simulation.commands as LoggedCommand[], result, state: simulation.state };
}
