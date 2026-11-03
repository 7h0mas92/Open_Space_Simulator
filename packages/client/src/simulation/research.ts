import {
  RESEARCH,
  getResearchNode,
  researchAllows,
  researchBlock,
  type CommandResult,
  type GameState,
  type ResearchKey,
  type ResearchState,
} from '@oss/shared';
import { notify, text, type SimContext } from './helpers';

/*
 * Arbre R&D des objets (constantes et rattachements dans `shared/sim/research.ts`).
 *
 * Seule la longue partie du mode Histoire a un arbre (`state.story.campaign.research`) : partout
 * ailleurs `researchOf` renvoie `undefined` et rien n'est verrouillé. Aucun tirage : les points
 * se comptent à la démo à partir de l'état, le rejeu retombe sur le même arbre.
 */

/** L'arbre de la partie, ou `undefined` hors de la longue partie (et dans ses vieilles sauvegardes). */
export function researchOf(state: GameState): ResearchState | undefined {
  return state.story?.campaign?.research;
}

/** Le contenu est-il débloqué par l'arbre ? (Toujours vrai sans arbre.) */
export function researchUnlocked(state: GameState, key: ResearchKey): boolean {
  return researchAllows(researchOf(state), key);
}

/** Commande `RESEARCH_NODE` : prend un niveau de l'arbre contre des points d'innovation. */
export function researchNode(state: GameState, ctx: SimContext, nodeId: string): CommandResult {
  const research = researchOf(state);
  const campaign = state.story?.campaign;
  if (!research || !campaign) return { ok: false, error: 'NOT_ELIGIBLE' };
  if (state.stage === 'ENDED') return { ok: false, error: 'WRONG_STAGE' };
  const node = getResearchNode(nodeId);
  if (!node) return { ok: false, error: 'NOT_FOUND' };
  switch (researchBlock(research, campaign.act, node)) {
    case 'owned':
      return { ok: false, error: 'NOT_ELIGIBLE' };
    case 'previous':
    case 'act':
      return { ok: false, error: 'LOCKED' };
    case 'points':
      return { ok: false, error: 'NOT_ENOUGH_POINTS' };
    case null:
      break;
  }
  research.points -= RESEARCH.cost[node.level];
  research.nodes.push(node.id);
  notify(
    state,
    ctx,
    'RESEARCH_DONE',
    text(['R&D : « {fr} » est débloqué.', 'R&D: “{en}” unlocked.'], {
      fr: node.name.fr,
      en: node.name.en,
    }),
  );
  return { ok: true };
}

/** Variation des utilisateurs sur le dernier sprint, d'après un historique (null : trop court). */
function lastGain(history: readonly number[]): number | null {
  const last = history[history.length - 1];
  const before = history[history.length - 2];
  return last === undefined || before === undefined ? null : last - before;
}

/**
 * Le joueur a-t-il gagné plus d'utilisateurs que chaque rival en jeu sur ce sprint ? Il faut au
 * moins un rival présent depuis deux démos, sinon il n'y a personne à battre.
 */
export function beatRivalsThisSprint(state: GameState): boolean {
  const campaign = state.story?.campaign;
  if (!campaign) return false;
  const mine = lastGain(campaign.usersHistory);
  if (mine === null) return false;
  const theirs = campaign.rivals
    .filter((rival) => rival.alive)
    .map((rival) => lastGain(rival.history))
    .filter((gain): gain is number => gain !== null);
  return theirs.length > 0 && theirs.every((gain) => mine > gain);
}

/**
 * Démo : points d'innovation des features livrées, des objectifs remplis depuis la dernière démo
 * et du sprint gagné face aux rivaux. Appelé après le sprint des rivaux.
 */
export function researchSprint(state: GameState, ctx: SimContext, shipped: number): void {
  const research = researchOf(state);
  const campaign = state.story?.campaign;
  if (!research || !campaign) return;
  const goals = Math.max(0, campaign.done.length - research.goalsCounted);
  research.goalsCounted = campaign.done.length;
  const gained =
    shipped * RESEARCH.perFeature +
    goals * RESEARCH.perGoal +
    (beatRivalsThisSprint(state) ? RESEARCH.beatRivals : 0);
  if (gained <= 0) return;
  research.points += gained;
  research.earned += gained;
  notify(
    state,
    ctx,
    'RESEARCH_POINTS',
    text(
      [
        '+{gained} points d’innovation ({points} à dépenser en R&D).',
        '+{gained} innovation points ({points} to spend on R&D).',
      ],
      { gained, points: research.points },
    ),
  );
}
