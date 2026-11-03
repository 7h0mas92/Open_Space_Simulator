import {
  ENDLESS,
  STORY_ACTS,
  STORY_SIDE_BONUS,
  STORY_STATS,
  getStoryAct,
  getStoryMission,
  type CampaignResult,
  type CampaignState,
  type CommandResult,
  type GameState,
  type MissionGoal,
  type StoryAct,
  type StoryMission,
  type StoryMissionId,
} from '@oss/shared';
import { generateDev, hireDev } from './devs';
import { endGame } from './endings';
import { phaseIndex } from './furniture';
import {
  addGauge,
  addMoney,
  addUsers,
  notify,
  teamMoral,
  teamSize,
  text,
  type SimContext,
} from './helpers';
import { missingPetNeeds } from './pets';
import { changeRivalUsers, marketShare, rivalUsers, startingRivals } from './rivals';
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

/** La mission courte jouée, ou `undefined` hors mode Histoire et dans la longue partie. */
export function currentMission(state: GameState): StoryMission | undefined {
  const id = state.story?.missionId;
  return id ? getStoryMission(id) : undefined;
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
      // Longue partie : les statistiques repartent de zéro à chaque acte.
      const value = state.stats[goal.stat] - (state.story?.campaign?.statsAtAct[goal.stat] ?? 0);
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
    case 'rivalUsers': {
      const value = state.gauges.users;
      return check(value, value >= rivalUsers(state, goal.rival));
    }
    case 'marketShare': {
      const value = marketShare(state);
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
  if (state.story?.campaign) {
    checkCampaign(state, ctx, state.story.campaign);
    return;
  }
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
  if (state.story?.campaign) return;
  const progress = missionProgress(state);
  if (!progress) return;
  const won = progress.goals.every((g) => g.met) && progress.constraints.every((c) => c.met);
  endMission(state, ctx, progress.mission, won ? null : 'TIME');
}

/* ---------------------------------------------------------------------------------------------
 * Longue partie en actes (« Ctrl+Alt+Fonder », `shared/story/acts.ts`)
 * ------------------------------------------------------------------------------------------- */

/** Statistiques d'un acte au moment où il commence. */
function statsSnapshot(state: GameState): CampaignState['statsAtAct'] {
  const snapshot: Partial<CampaignState['statsAtAct']> = {};
  for (const stat of STORY_STATS) snapshot[stat] = state.stats[stat];
  return snapshot as CampaignState['statsAtAct'];
}

/** Avancement d'une nouvelle histoire : prologue, rien de fait. */
export function emptyCampaign(): CampaignState {
  const zero: Partial<CampaignState['statsAtAct']> = {};
  for (const stat of STORY_STATS) zero[stat] = 0;
  return {
    act: 0,
    done: [],
    missed: [],
    statsAtAct: zero as CampaignState['statsAtAct'],
    rivals: startingRivals(),
    usersHistory: [],
  };
}

/** L'acte en cours, ou `undefined` hors de la longue partie. */
export function currentAct(state: GameState): StoryAct | undefined {
  const campaign = state.story?.campaign;
  return campaign ? getStoryAct(campaign.act) : undefined;
}

/** Où en est un objectif secondaire de l'acte. */
export type SideStatus = 'done' | 'missed' | 'active';

export interface SideProgress {
  readonly mission: StoryMission;
  readonly status: SideStatus;
  readonly goals: GoalProgress[];
  readonly constraints: GoalProgress[];
}

export interface ActProgress {
  readonly act: StoryAct;
  readonly campaign: CampaignState;
  /** Objectif principal (vide au dernier acte : il se termine par une sortie). */
  readonly goals: GoalProgress[];
  readonly side: SideProgress[];
}

function sideStatus(campaign: CampaignState, id: StoryMissionId): SideStatus {
  return campaign.done.includes(id) ? 'done' : campaign.missed.includes(id) ? 'missed' : 'active';
}

/** Avancement de l'acte en cours : objectif principal et objectifs secondaires. */
export function actProgress(state: GameState): ActProgress | null {
  const campaign = state.story?.campaign;
  if (!campaign) return null;
  const act = getStoryAct(campaign.act);
  return {
    act,
    campaign,
    goals: act.goals.map((goal) => goalProgress(state, goal)),
    side: act.side.flatMap((id) => {
      const mission = getStoryMission(id);
      if (!mission) return [];
      return [
        {
          mission,
          status: sideStatus(campaign, id),
          goals: mission.goals.map((goal) => goalProgress(state, goal)),
          constraints: mission.constraints.map((goal) => goalProgress(state, goal)),
        },
      ];
    }),
  };
}

/** Objectifs secondaires de l'acte : remplis (récompense) ou ratés (contrainte enfreinte). */
function checkSideGoals(state: GameState, ctx: SimContext, campaign: CampaignState): void {
  const progress = actProgress(state);
  if (!progress) return;
  for (const side of progress.side) {
    if (side.status !== 'active') continue;
    const params = { fr: side.mission.title.fr, en: side.mission.title.en };
    if (side.constraints.some((c) => !c.met)) {
      campaign.missed.push(side.mission.id);
      notify(
        state,
        ctx,
        'STORY_GOAL',
        text(['Objectif « {fr} » raté.', 'Goal “{en}” failed.'], params),
      );
    } else if (side.goals.every((g) => g.met)) {
      campaign.done.push(side.mission.id);
      notify(
        state,
        ctx,
        'STORY_GOAL',
        text(['Objectif « {fr} » rempli !', 'Goal “{en}” completed!'], params),
      );
      applySideBonus(state, ctx, side.mission.id);
    }
  }
}

/** Coup de pouce de l'histoire pour un objectif secondaire rempli (sans tirage). */
function applySideBonus(state: GameState, ctx: SimContext, id: StoryMissionId): void {
  const bonus = STORY_SIDE_BONUS[id];
  if (bonus.treasury) addMoney(state, bonus.treasury);
  if (bonus.hype) addGauge(state, 'hype', bonus.hype);
  if (bonus.users) addUsers(state, (state.gauges.users * bonus.users) / 100);
  if (bonus.rivals) changeRivalUsers(state, bonus.rivals);
  notify(state, ctx, 'STORY_GOAL', bonus.text);
}

/** Passe à l'acte suivant : les objectifs secondaires pas remplis sont ratés. */
function nextAct(state: GameState, ctx: SimContext, campaign: CampaignState): void {
  const story = state.story;
  if (!story) return;
  for (const id of getStoryAct(campaign.act).side)
    if (!campaign.done.includes(id) && !campaign.missed.includes(id)) campaign.missed.push(id);
  campaign.act += 1;
  campaign.statsAtAct = statsSnapshot(state);
  // Les sprints de l'acte comptent à partir du prochain qui commence.
  story.startSprint = state.stage === 'PLANNING' ? state.sprint : state.sprint + 1;
  const act = getStoryAct(campaign.act);
  notify(
    state,
    ctx,
    'STORY_ACT',
    text(['Acte {number} : {fr}', 'Act {number}: {en}'], {
      number: ROMAN[act.number] ?? String(act.number),
      fr: act.title.fr,
      en: act.title.en,
    }),
  );
}

/** À partir de cet acte (« Le géant »), une sortie termine l'histoire avec succès. */
const GIANT_ACT = STORY_ACTS.findIndex((act) => act.id === 'giant');

/** Numéros des actes en chiffres romains (le prologue n'en a pas). */
export const ROMAN = ['', 'I', 'II', 'III', 'IV'] as const;

/** Arrête l'histoire (la partie se termine comme un « zombie », sauf fin écrite). */
function endCampaign(
  state: GameState,
  ctx: SimContext,
  failure: Exclude<CampaignResult['failure'], null>,
): void {
  const act = currentAct(state);
  if (!act) return;
  const params = { fr: act.title.fr, en: act.title.en, sprint: state.sprint };
  endGame(
    state,
    ctx,
    'ZOMBIE',
    state.valuation,
    null,
    text(
      [
        'Histoire arrêtée au sprint {sprint}, pendant l’acte « {fr} ».',
        'Story stopped in sprint {sprint}, during the act “{en}”.',
      ],
      params,
    ),
  );
  if (state.result) state.result.campaign = { act: act.id, success: false, failure, ending: null };
}

/**
 * Vérifie la longue partie après chaque pas et chaque commande : objectifs secondaires, puis
 * objectif principal (acte suivant). À la fin de la partie, l'issue de la startup dit si
 * l'histoire est réussie : une sortie (Bourse ou rachat) à partir de l'acte « Le géant ».
 */
function checkCampaign(state: GameState, ctx: SimContext, campaign: CampaignState): void {
  if (state.result) {
    if (state.result.campaign) return;
    const free = campaign.freeSeason;
    if (free) {
      // Saison libre : l'histoire est déjà réussie (entrée en Bourse), quelle que soit la suite.
      state.result.campaign = {
        act: getStoryAct(campaign.act).id,
        success: true,
        failure: null,
        ending: 'IPO',
        freeSeasonSprints: Math.max(0, state.sprint - free.fromSprint),
      };
      return;
    }
    const act = getStoryAct(campaign.act);
    const { outcome } = state.result;
    const ending = outcome === 'IPO' || outcome === 'ACQUISITION' ? outcome : null;
    const success = ending !== null && campaign.act >= GIANT_ACT;
    if (success) checkSideGoals(state, ctx, campaign);
    state.result.campaign = {
      act: act.id,
      success,
      failure: success ? null : outcome === 'BANKRUPTCY' ? 'BANKRUPTCY' : ending ? 'SOLD' : 'TIME',
      ending: success ? ending : null,
    };
    return;
  }
  checkSideGoals(state, ctx, campaign);
  const act = getStoryAct(campaign.act);
  if (act.goals.length > 0 && act.goals.every((goal) => goalProgress(state, goal).met))
    nextAct(state, ctx, campaign);
}

/**
 * Date limite de l'acte, vérifiée à la fin de la démo : objectif principal pas rempli, l'histoire
 * s'arrête. Renvoie vrai si la partie est finie. Le dernier acte n'a pas d'autre limite que la
 * fin de la partie (sortie automatique, comme au bout des 18 mois d'une partie normale).
 */
export function campaignDeadline(state: GameState, ctx: SimContext): boolean {
  const act = currentAct(state);
  if (!act || act.goals.length === 0 || state.sprint < act.deadline) return false;
  endCampaign(state, ctx, 'TIME');
  return true;
}

/**
 * Entrée en Bourse pendant l'histoire, à partir de « Le géant » : la fin écrite est atteinte,
 * les objectifs secondaires sont vérifiés une dernière fois, puis la partie continue en Saison
 * libre (plus de date limite, concurrence qui monte, nouvelles startups). Renvoie faux hors de
 * l'histoire ou trop tôt : l'entrée en Bourse termine alors la partie comme d'habitude.
 */
export function startFreeSeason(state: GameState, ctx: SimContext, valuation: number): boolean {
  const campaign = state.story?.campaign;
  if (!campaign || campaign.freeSeason || campaign.act < GIANT_ACT) return false;
  checkSideGoals(state, ctx, campaign);
  for (const id of getStoryAct(campaign.act).side)
    if (!campaign.done.includes(id) && !campaign.missed.includes(id)) campaign.missed.push(id);
  state.valuation = Math.round(valuation);
  campaign.freeSeason = { fromSprint: state.sprint, valuation: state.valuation };
  state.totalSprints = ENDLESS.sprintCap;
  notify(
    state,
    ctx,
    'STORY_END',
    text([
      'Entrée en Bourse ! L’histoire est finie, la Saison libre commence.',
      'IPO! The story is over, the Free season begins.',
    ]),
  );
  return true;
}

/** Saison libre : le joueur termine la partie sur la fin « entrée en Bourse ». */
export function endStory(state: GameState, ctx: SimContext): CommandResult {
  const free = state.story?.campaign?.freeSeason;
  if (!free) return { ok: false, error: 'NOT_ELIGIBLE' };
  if (state.stage === 'ENDED') return { ok: false, error: 'WRONG_STAGE' };
  endGame(state, ctx, 'IPO', state.valuation);
  return { ok: true };
}
