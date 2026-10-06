import { EVENT_CARDS, type EventCard, type GameMode, type LoggedCommand } from '@oss/shared';
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
