import {
  PHASES,
  RESEARCH,
  getResearchNode,
  researchAllows,
  researchBlock,
  type CommandResult,
  type GameState,
  type ResearchGate,
  type ResearchKey,
  type ResearchState,
} from '@oss/shared';
import { notify, text, type SimContext } from './helpers';

/*
 * Arbre R&D des objets (constantes et rattachements dans `shared/sim/research.ts`).
 *
 * L'histoire en actes garde son arbre dans `state.story.campaign.research` (niveaux ouverts par
 * les actes) ; les autres modes dans `state.research` (niveaux ouverts par la phase). Missions
 * courtes et vieilles sauvegardes n'en ont pas : `researchOf` renvoie `undefined` et rien n'est
 * verrouillé. Aucun tirage : les points se comptent à la démo à partir de l'état, le rejeu
 * retombe sur le même arbre.
 */

/** L'arbre de la partie, ou `undefined` sans arbre (missions courtes, vieilles sauvegardes). */
export function researchOf(state: GameState): ResearchState | undefined {
  return state.story?.campaign?.research ?? state.research ?? undefined;
}

/** Étape qui ouvre les niveaux : l'acte dans l'histoire en actes, la phase ailleurs. */
export function researchStage(state: GameState): { stage: number; gate: ResearchGate } {
  const campaign = state.story?.campaign;
  if (campaign?.research) return { stage: campaign.act, gate: 'act' };
  return { stage: Math.min(PHASES.indexOf(state.phase), 3), gate: 'phase' };
}

/** Le contenu est-il débloqué par l'arbre ? (Toujours vrai sans arbre.) */
export function researchUnlocked(state: GameState, key: ResearchKey): boolean {
  return researchAllows(researchOf(state), key);
}

/** Commande `RESEARCH_NODE` : prend un niveau de l'arbre contre des points d'innovation. */
export function researchNode(state: GameState, ctx: SimContext, nodeId: string): CommandResult {
  const research = researchOf(state);
  if (!research) return { ok: false, error: 'NOT_ELIGIBLE' };
  if (state.stage === 'ENDED') return { ok: false, error: 'WRONG_STAGE' };
  const node = getResearchNode(nodeId);
  if (!node) return { ok: false, error: 'NOT_FOUND' };
  const { stage, gate } = researchStage(state);
  switch (researchBlock(research, stage, node, gate)) {
    case 'owned':
      return { ok: false, error: 'NOT_ELIGIBLE' };
    case 'previous':
    case 'act':
    case 'phase':
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

/** Points de la démo propres à l'histoire en actes : objectifs remplis, rivaux battus. */
function campaignPoints(state: GameState, research: ResearchState): number {
  const campaign = state.story?.campaign;
  if (!campaign) return 0;
  const goals = Math.max(0, campaign.done.length - research.goalsCounted);
  research.goalsCounted = campaign.done.length;
  return goals * RESEARCH.perGoal + (beatRivalsThisSprint(state) ? RESEARCH.beatRivals : 0);
}

/** Points de la démo des autres modes : levées de fonds réussies, objectif du sprint atteint. */
function companyPoints(state: GameState, research: ResearchState, objectiveDone: boolean): number {
  const counted = research.roundsCounted ?? 0;
  const rounds = Math.max(0, state.fundingRounds - counted);
  research.roundsCounted = state.fundingRounds;
  return rounds * RESEARCH.perRound + (objectiveDone ? RESEARCH.perObjective : 0);
}

/**
 * Démo : points d'innovation des features livrées, puis selon le mode les objectifs de
 * l'histoire et le sprint gagné face aux rivaux, ou les levées de fonds et l'objectif du sprint.
 * Appelé après le sprint des rivaux et le bilan de l'objectif.
 */
export function researchSprint(
  state: GameState,
  ctx: SimContext,
  shipped: number,
  objectiveDone = false,
): void {
  const research = researchOf(state);
  if (!research) return;
  const gained =
    shipped * RESEARCH.perFeature +
    (state.story?.campaign?.research
      ? campaignPoints(state, research)
      : companyPoints(state, research, objectiveDone));
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
