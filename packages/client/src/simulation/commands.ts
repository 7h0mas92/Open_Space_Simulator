import { BALANCE, type Command, type CommandResult, type GameState } from '@oss/shared';
import { resolveEvent } from '../events/resolve';
import { fireDev, makeOffer } from './devs';
import { endGame } from './endings';
import { closePitch, pitchArgument, startPitch } from './fundraising';
import {
  buyAccessory,
  buyFurniture,
  moveAccessory,
  moveFurniture,
  paintFurniture,
  placeStored,
  placeStoredAccessory,
  sellFurniture,
  sellStored,
  storeFurniture,
} from './furniture';
import type { SimContext } from './helpers';
import { answerRaise } from './raises';
import { endDemo, startSprint } from './sprint';
import { assignTask, moveTask } from './tasks';
import { foundVenture, sellVenture } from './ventures';

const fail = (error: Extract<CommandResult, { ok: false }>['error']): CommandResult => ({
  ok: false,
  error,
});

/** Étapes pendant lesquelles on peut gérer l'équipe et le Kanban. */
function isManaging(state: GameState): boolean {
  return state.stage === 'PLANNING' || state.stage === 'EXECUTION';
}

/**
 * Applique une commande du joueur. Une commande refusée ne modifie JAMAIS l'état :
 * c'est indispensable pour que le rejeu d'une partie soit fidèle.
 */
export function applyCommand(state: GameState, ctx: SimContext, command: Command): CommandResult {
  if (state.stage === 'ENDED') return fail('GAME_OVER');
  switch (command.type) {
    case 'START_SPRINT':
      return startSprint(state, ctx);
    case 'MOVE_TASK':
      return isManaging(state)
        ? moveTask(state, command.taskId, command.column, command.index)
        : fail('WRONG_STAGE');
    case 'ASSIGN_TASK':
      return isManaging(state)
        ? assignTask(state, command.taskId, command.devId)
        : fail('WRONG_STAGE');
    case 'RESOLVE_EVENT':
      return resolveEvent(state, ctx, command.choiceIndex);
    case 'MAKE_OFFER':
      return isManaging(state)
        ? makeOffer(state, ctx, command.candidateId, command.salary)
        : fail('WRONG_STAGE');
    case 'FIRE_DEV':
      return state.stage === 'PITCH' ? fail('WRONG_STAGE') : fireDev(state, ctx, command.devId);
    case 'BUY_FURNITURE':
      return state.stage === 'PITCH'
        ? fail('WRONG_STAGE')
        : buyFurniture(
            state,
            command.itemId,
            command.x,
            command.y,
            command.rotation,
            command.color,
          );
    case 'BUY_ACCESSORY':
      return state.stage === 'PITCH'
        ? fail('WRONG_STAGE')
        : buyAccessory(
            state,
            command.itemId,
            command.hostId,
            command.slot,
            command.rotation,
            command.color,
          );
    case 'MOVE_ACCESSORY':
      return state.stage === 'PITCH'
        ? fail('WRONG_STAGE')
        : moveAccessory(state, command.furnitureId, command.hostId, command.slot, command.rotation);
    case 'PAINT_FURNITURE':
      return state.stage === 'PITCH'
        ? fail('WRONG_STAGE')
        : paintFurniture(state, command.furnitureId, command.color);
    case 'MOVE_FURNITURE':
      return state.stage === 'PITCH'
        ? fail('WRONG_STAGE')
        : moveFurniture(state, command.furnitureId, command.x, command.y, command.rotation);
    case 'SELL_FURNITURE':
      return state.stage === 'PITCH'
        ? fail('WRONG_STAGE')
        : sellFurniture(state, command.furnitureId);
    case 'STORE_FURNITURE':
      return state.stage === 'PITCH'
        ? fail('WRONG_STAGE')
        : storeFurniture(state, command.furnitureId);
    case 'PLACE_STORED':
      return state.stage === 'PITCH'
        ? fail('WRONG_STAGE')
        : placeStored(state, command.itemId, command.color, command.x, command.y, command.rotation);
    case 'PLACE_STORED_ACCESSORY':
      return state.stage === 'PITCH'
        ? fail('WRONG_STAGE')
        : placeStoredAccessory(
            state,
            command.itemId,
            command.color,
            command.hostId,
            command.slot,
            command.rotation,
          );
    case 'SELL_STORED':
      return state.stage === 'PITCH'
        ? fail('WRONG_STAGE')
        : sellStored(state, command.itemId, command.color);
    case 'START_PITCH':
      return startPitch(state, ctx);
    case 'PITCH_ARGUMENT':
      return pitchArgument(state, ctx, command.argumentId);
    case 'CLOSE_PITCH':
      return closePitch(state);
    case 'END_DEMO':
      return endDemo(state, ctx);
    case 'ANSWER_ACQUISITION': {
      const offer = state.acquisitionOffer;
      if (!offer) return fail('NOT_FOUND');
      if (state.stage !== 'PLANNING' && state.stage !== 'DEMO') return fail('WRONG_STAGE');
      if (command.accept) endGame(state, ctx, 'ACQUISITION', offer.amount, offer.buyer);
      else state.acquisitionOffer = null;
      return { ok: true };
    }
    case 'ANSWER_RAISE':
      return answerRaise(state, ctx, command.accept);
    case 'LAUNCH_IPO':
      if (state.stage !== 'PLANNING' && state.stage !== 'DEMO') return fail('WRONG_STAGE');
      if (state.phase !== 'UNICORN' || state.gauges.stability < BALANCE.phases.ipoMinStability) {
        return fail('NOT_ELIGIBLE');
      }
      endGame(state, ctx, 'IPO', state.valuation * 1.2);
      return { ok: true };
    case 'FOUND_VENTURE':
      return foundVenture(state, ctx, command.ideaId);
    case 'SELL_VENTURE':
      return sellVenture(state, ctx, command.ventureId);
  }
}
