import { getStoryMission, type GameState, type MissionGoal, type StoryMission } from '@oss/shared';
import { generateDev, hireDev } from './devs';
import { endGame } from './endings';
import { phaseIndex } from './furniture';
import { teamMoral, teamSize, text, type SimContext } from './helpers';
import { missingPetNeeds } from './pets';
import { serverRoomStatuses } from './serverRoom';
import { hasUnlock } from './unlocks';

/*
 * Mode Histoire (campagne dans `shared/story/campaign.ts`) : point de départ de la mission,
 * suivi de ses objectifs et de ses contraintes, fin de la mission. Les objectifs ne font que lire
 * l'état : le rejeu côté serveur retrouve exactement la même issue (vérification de la
 * progression). Aucun tirage aléatoire ici, sauf les devs du point de départ.
 *
 * On y trouve aussi les récompenses débloquées par la campagne et utilisées dans les autres
 * modes (`state.unlocks`) : bonus de départ et contenus en vente.
 */

/** La mission jouée, ou `undefined` hors mode Histoire. */
export function currentMission(state: GameState): StoryMission | undefined {
  return state.story ? getStoryMission(state.story.missionId) : undefined;
}

/** Bonus de départ des récompenses (appliqué à la création d'une partie hors mission). */
export function applyStartPerks(state: GameState): void {
  if (hasUnlock(state, 'perk-network')) state.gauges.hype = Math.min(100, state.gauges.hype + 10);
}

/** Cafetière du garage : une machine à expresso avec la récompense « expresso dès le garage ». */
export function startingCoffeeMaker(state: GameState): string {
  return hasUnlock(state, 'perk-espresso') ? 'espresso-machine' : 'drip-coffee-maker';
}

/**
 * Point de départ de la mission : phase, levées déjà faites, jauges, part du capital et
 * équipe. Le bureau est celui du garage : le joueur aménage lui-même son nouvel espace.
 */
export function setupMission(state: GameState, ctx: SimContext): void {
  const mission = currentMission(state);
  if (!mission) return;
  const { setup } = mission;
  state.totalSprints = mission.sprints;
  state.phase = setup.phase;
  state.fundingRounds = setup.fundingRounds;
  state.gauges.treasury = setup.treasury;
  state.totalRaised = setup.treasury;
  state.gauges.users = setup.users;
  state.ownership = setup.ownership;
  if (setup.hype !== undefined) state.gauges.hype = setup.hype;
  if (setup.debt !== undefined) state.gauges.debt = setup.debt;
  if (setup.stability !== undefined) state.gauges.stability = setup.stability;
  state.tracker.usersAtStart = setup.users;
  state.tracker.hypeAtStart = state.gauges.hype;
  for (const role of setup.team) {
    const dev = generateDev(ctx.rng, role);
    hireDev(state, ctx, dev, dev.askingSalary);
  }
  state.stats.maxUsers = setup.users;
}

/** Sprints terminés depuis le début de la mission (celui de la démo en cours compte). */
export function completedSprints(state: GameState): number {
  const done = state.stage === 'DEMO' || state.stage === 'ENDED' ? state.sprint : state.sprint - 1;
  return Math.max(0, done - (state.story?.startSprint ?? 1) + 1);
}

/** Où en est un objectif : sa valeur actuelle, la cible et s'il est rempli. */
export interface GoalProgress {
  readonly goal: MissionGoal;
  /** Valeur actuelle (1 ou 0 pour un objectif à cocher). */
  readonly value: number;
  readonly met: boolean;
}

function inRange(value: number, min?: number, max?: number): boolean {
  return (min === undefined || value >= min) && (max === undefined || value <= max);
}

/** Chats heureux : tous, si l'équipement est complet ; aucun sinon (ils boudent). */
function happyPets(state: GameState): number {
  return missingPetNeeds(state).length === 0 ? state.pets.length : 0;
}

export function goalProgress(state: GameState, goal: MissionGoal): GoalProgress {
  const check = (value: number, met: boolean): GoalProgress => ({ goal, value, met });
  switch (goal.kind) {
    case 'phase': {
      const reached = state.result?.phaseReached ?? state.phase;
      return check(phaseIndex(reached), phaseIndex(reached) >= phaseIndex(goal.atLeast));
    }
    case 'gauge': {
      const value = state.gauges[goal.gauge];
      return check(value, inRange(value, goal.min, goal.max));
    }
    case 'stat': {
      const value = state.stats[goal.stat];
      return check(value, inRange(value, goal.min, goal.max));
    }
    case 'team': {
      const value = teamSize(state);
      return check(value, value >= goal.min);
    }
    case 'moral': {
      const value = teamMoral(state);
      return check(value, value >= goal.min);
    }
    case 'valuation':
      return check(state.valuation, state.valuation >= goal.min);
    case 'serverRoom': {
      const running = serverRoomStatuses(state).some((room) => room.running);
      return check(running ? 1 : 0, running);
    }
    case 'meetingRoom':
      return check(state.meetingRoom ? 1 : 0, state.meetingRoom !== null);
    case 'pets': {
      const value = happyPets(state);
      return check(value, value >= goal.min);
    }
    case 'sprints': {
      const value = completedSprints(state);
      return check(value, value >= goal.min);
    }
  }
}

/** Progression de la mission : chaque objectif, chaque contrainte. */
export function missionProgress(state: GameState): {
  mission: StoryMission;
  goals: GoalProgress[];
  constraints: GoalProgress[];
} | null {
  const mission = currentMission(state);
  if (!mission) return null;
  return {
    mission,
    goals: mission.goals.map((goal) => goalProgress(state, goal)),
    constraints: mission.constraints.map((goal) => goalProgress(state, goal)),
  };
}

/** Termine la mission : réussie, ou perdue (contrainte enfreinte ou temps écoulé). */
function endMission(
  state: GameState,
  ctx: SimContext,
  mission: StoryMission,
  failure: 'CONSTRAINT' | 'TIME' | null,
): void {
  // L'issue de la startup n'a pas de sens au milieu de l'histoire : la mission arrête la partie,
  // comme un « zombie » (ni faillite, ni sortie). Seul `result.mission` dit si elle est gagnée.
  const success = failure === null;
  const params = { fr: mission.title.fr, en: mission.title.en, sprint: state.sprint };
  const headline = success
    ? text(
        [
          'Mission « {fr} » réussie au sprint {sprint} !',
          'Mission “{en}” completed in sprint {sprint}!',
        ],
        params,
      )
    : text(
        ['Mission « {fr} » ratée au sprint {sprint}.', 'Mission “{en}” failed in sprint {sprint}.'],
        params,
      );
  endGame(state, ctx, 'ZOMBIE', state.valuation, null, headline);
  if (state.result) state.result.mission = { id: mission.id, success, failure };
}

/**
 * Vérifie la mission après chaque pas et chaque commande : contrainte enfreinte, perdue ; tous
 * les objectifs remplis en même temps, gagnée. La faillite est notée à la fin de la partie.
 */
export function checkMission(state: GameState, ctx: SimContext): void {
  const progress = missionProgress(state);
  if (!progress) return;
  if (state.result) {
    // Faillite : perdue. Introduction en Bourse ou rachat accepté par le joueur : la mission
    // s'arrête là, gagnée seulement si ses objectifs sont remplis à ce moment.
    const bankrupt = state.result.outcome === 'BANKRUPTCY';
    const won =
      !bankrupt && progress.goals.every((g) => g.met) && progress.constraints.every((c) => c.met);
    state.result.mission ??= {
      id: progress.mission.id,
      success: won,
      failure: won ? null : bankrupt ? 'BANKRUPTCY' : 'SOLD',
    };
    return;
  }
  if (progress.constraints.some((c) => !c.met))
    endMission(state, ctx, progress.mission, 'CONSTRAINT');
  else if (progress.goals.every((g) => g.met)) endMission(state, ctx, progress.mission, null);
}

/** Fin du temps imparti : les objectifs sont vérifiés une dernière fois après la démo. */
export function missionTimeUp(state: GameState, ctx: SimContext): void {
  const progress = missionProgress(state);
  if (!progress) return;
  const won = progress.goals.every((g) => g.met) && progress.constraints.every((c) => c.met);
  endMission(state, ctx, progress.mission, won ? null : 'TIME');
}
