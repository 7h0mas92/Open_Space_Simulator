import {
  FREE_SEASON_NEWCOMER_SPRINTS,
  NEWCOMER_RIVALS,
  RIVALS,
  RIVAL_RULES,
  getRival,
  type CampaignState,
  type EntityId,
  type GameState,
  type RivalAction,
  type RivalId,
  type RivalProfile,
  type RivalState,
} from '@oss/shared';
import { query } from './ecs';
import {
  addGauge,
  addMoney,
  addUsers,
  changeMoral,
  moneyText,
  notify,
  text,
  type SimContext,
} from './helpers';
import { sideRng, type Rng } from './rng';

/*
 * Rivaux de l'histoire « Ctrl+Alt+Fonder » (constantes dans `shared/sim/rivals.ts`).
 *
 * À chaque démo de la longue partie : les rivaux en jeu grandissent, ceux de l'acte arrivent,
 * Gigacorp rachète Synergix, et chacun peut lancer une action contre le joueur. Tout le hasard
 * vient de `<graine>#rival#<sprint>` : le générateur de la partie n'est jamais touché.
 */

function rivalRng(state: GameState): Rng {
  return sideRng(state.seed, 'rival', state.sprint);
}

function newRival(profile: RivalProfile, users = profile.startUsers): RivalState {
  return {
    id: profile.id,
    users,
    valuation: 0,
    hype: 50,
    headcount: 3,
    alive: true,
    boughtBy: null,
    lastAction: null,
    lastActionSprint: null,
    history: [],
  };
}

/** Rivaux présents au début de l'histoire (Synergix ouvre en face dès le prologue). */
export function startingRivals(): RivalState[] {
  return RIVALS.filter((profile) => profile.fromAct === 0).map((profile) => newRival(profile));
}

function pushCapped(history: number[], value: number): void {
  history.push(Math.round(value));
  if (history.length > RIVAL_RULES.historyLength)
    history.splice(0, history.length - RIVAL_RULES.historyLength);
}

/** Rivaux encore en jeu (ni en faillite, ni rachetés). */
export function aliveRivals(state: GameState): RivalState[] {
  return (state.story?.campaign?.rivals ?? []).filter((rival) => rival.alive);
}

/** Part du marché du joueur (0 à 1) face aux rivaux en jeu (1 sans rival). */
export function marketShare(state: GameState): number {
  const others = aliveRivals(state).reduce((sum, rival) => sum + rival.users, 0);
  const total = state.gauges.users + others;
  return total > 0 ? state.gauges.users / total : 1;
}

/** Départs quotidiens d'utilisateurs ajoutés par la concurrence (0 hors histoire). */
export function rivalExtraChurn(state: GameState): number {
  if (!state.story?.campaign || aliveRivals(state).length === 0) return 0;
  return RIVAL_RULES.dailyChurnPerRivalShare * (1 - marketShare(state));
}

/** Arrivées de l'acte : Pivotly à la guerre des prix, Gigacorp (qui rachète Synergix) ensuite. */
function arrivals(state: GameState, sim: SimContext, campaign: CampaignState): void {
  for (const profile of RIVALS) {
    if (profile.fromAct > campaign.act || campaign.rivals.some((r) => r.id === profile.id))
      continue;
    const rival = newRival(profile);
    if (profile.id === 'gigacorp') {
      const synergix = campaign.rivals.find((r) => r.id === 'synergix' && r.alive);
      if (synergix) {
        rival.users += synergix.users;
        synergix.alive = false;
        synergix.boughtBy = 'gigacorp';
      }
    }
    campaign.rivals.push(rival);
    notify(
      state,
      sim,
      'RIVAL_ACTION',
      profile.id === 'gigacorp'
        ? text([
            'Gigacorp rachète Synergix ! Le géant entre sur ton marché.',
            'Gigacorp buys Synergix! The giant enters your market.',
          ])
        : text(['{name} entre sur ton marché.', '{name} enters your market.'], {
            name: profile.name,
          }),
    );
  }
}

/**
 * Saison libre : tous les `FREE_SEASON_NEWCOMER_SPRINTS` sprints, une nouvelle startup attaque
 * le marché, d'autant plus grosse que le joueur est gros (15 % de ses utilisateurs au moins).
 */
function newcomer(state: GameState, sim: SimContext, campaign: CampaignState): void {
  const free = campaign.freeSeason;
  if (!free) return;
  const elapsed = state.sprint - free.fromSprint;
  if (elapsed <= 0 || elapsed % FREE_SEASON_NEWCOMER_SPRINTS !== 0) return;
  const id = NEWCOMER_RIVALS.find((rival) => !campaign.rivals.some((r) => r.id === rival));
  if (!id) return;
  const profile = getRival(id);
  campaign.rivals.push(
    newRival(profile, Math.max(profile.startUsers, Math.round(state.gauges.users * 0.15))),
  );
  notify(
    state,
    sim,
    'RIVAL_ACTION',
    text(
      [
        'Nouvelle concurrente : {name} entre sur ton marché.',
        'New challenger: {name} enters your market.',
      ],
      {
        name: profile.name,
      },
    ),
  );
}

/** Croissance d'un rival sur un sprint (logistique, plus un peu de hasard et son caractère). */
function grow(
  state: GameState,
  sim: SimContext,
  rival: RivalState,
  profile: RivalProfile,
  rng: Rng,
): void {
  let rate = profile.growth + (rng.next() * 2 - 1) * RIVAL_RULES.noise;
  // Synergix copie : quand le joueur passe devant, il accélère.
  if (profile.id === 'synergix' && state.gauges.users > rival.users)
    rate += RIVAL_RULES.copierBoost;
  rival.users = Math.max(0, rival.users + rival.users * rate * (1 - rival.users / profile.cap));
  // Pivotly change de produit tous les deux sprints : ça passe ou ça casse.
  if (profile.id === 'pivotly' && state.sprint % 2 === 0) {
    const [low, high] = RIVAL_RULES.pivotRange;
    rival.users *= low + rng.next() * (high - low);
  }
  rival.hype = Math.max(10, Math.min(95, rival.hype + (rng.next() * 2 - 1) * 8));
  rival.valuation = rival.users * RIVAL_RULES.valuationPerUser * (0.5 + rival.hype / 100);
  rival.headcount = Math.min(400, 3 + Math.round(rival.users / 15_000));
  if (
    profile.id !== 'gigacorp' &&
    rival.users < RIVAL_RULES.bankruptBelow &&
    // Faillite seulement après avoir grandi puis chuté (un rival qui démarre petit survit).
    rival.users < Math.max(...rival.history, 0) * RIVAL_RULES.bankruptDrop
  ) {
    rival.alive = false;
    notify(
      state,
      sim,
      'RIVAL_ACTION',
      text(['{name} fait faillite.', '{name} goes bankrupt.'], { name: profile.name }),
    );
  }
}

/** Le meilleur dev du joueur (plus haut niveau, puis plus petit identifiant). */
function bestDev(state: GameState): EntityId | null {
  let best: EntityId | null = null;
  let level = -1;
  for (const id of query(state, 'employment')) {
    const employment = state.components.employment[id];
    if (employment && employment.level > level) {
      level = employment.level;
      best = id;
    }
  }
  return best;
}

const ACTION_TEXT: Record<RivalAction, readonly [string, string]> = {
  copy: [
    '{name} sort une copie de ta dernière feature, en plus brillant. Hype en baisse.',
    '{name} ships a copy of your latest feature, only shinier. Hype drops.',
  ],
  poach: [
    '{name} essaie de débaucher {dev}. Il hésite, son moral en prend un coup.',
    '{name} tries to poach {dev}. They hesitate, and their morale takes a hit.',
  ],
  lawsuit: [
    '{name} te fait un procès pour « vol d’idée ». Avocats : {amount}.',
    '{name} sues you for “stealing the idea”. Lawyers: {amount}.',
  ],
  priceCut: [
    '{name} casse ses prix. Une partie de tes utilisateurs part voir.',
    '{name} slashes its prices. Some of your users go take a look.',
  ],
  pivot: [
    '{name} pivote encore : « On est maintenant une plateforme d’IA pour les chats. »',
    '{name} pivots again: “We are now an AI platform for cats.”',
  ],
  clone: [
    '{name} sort un clone de ton produit, gratuit pour tout le monde.',
    '{name} releases a clone of your product, free for everyone.',
  ],
  adBlitz: [
    '{name} achète toutes les pubs du métro. Ta hype s’efface un peu.',
    '{name} buys every ad in the subway. Your hype fades a little.',
  ],
};

/** Action d'un rival contre le joueur : ses effets, puis la notification. */
function act(state: GameState, sim: SimContext, rival: RivalState, action: RivalAction): void {
  const { effects } = RIVAL_RULES;
  const profile = getRival(rival.id);
  const params: Record<string, string | { fr: string; en: string }> = { name: profile.name };
  switch (action) {
    case 'copy':
      addGauge(state, 'hype', effects.copyHype);
      break;
    case 'poach': {
      const dev = bestDev(state);
      if (dev === null) return;
      changeMoral(state, dev, effects.poachMoral);
      params.dev = state.components.identity[dev]?.name ?? '?';
      break;
    }
    case 'lawsuit': {
      const amount = Math.min(
        effects.lawsuitMax,
        Math.max(0, state.gauges.treasury) * effects.lawsuitTreasuryShare,
      );
      addMoney(state, -amount);
      params.amount = moneyText(amount);
      break;
    }
    case 'priceCut':
      addUsers(state, state.gauges.users * effects.priceCutUsers);
      break;
    case 'pivot':
      break;
    case 'clone':
      addGauge(state, 'hype', effects.cloneHype);
      addUsers(state, state.gauges.users * effects.cloneUsers);
      break;
    case 'adBlitz':
      addGauge(state, 'hype', effects.adBlitzHype);
      break;
  }
  rival.lastAction = action;
  rival.lastActionSprint = state.sprint;
  notify(state, sim, 'RIVAL_ACTION', text(ACTION_TEXT[action], params));
}

/**
 * Démo de la longue partie : arrivées, croissance, actions des rivaux et historique. Sans effet
 * hors de l'histoire en actes.
 */
export function rivalsSprint(state: GameState, sim: SimContext): void {
  const campaign = state.story?.campaign;
  if (!campaign) return;
  const rng = rivalRng(state);
  arrivals(state, sim, campaign);
  newcomer(state, sim, campaign);
  for (const rival of campaign.rivals) {
    if (!rival.alive) continue;
    const profile = getRival(rival.id);
    grow(state, sim, rival, profile, rng);
    if (!rival.alive) continue;
    pushCapped(rival.history, rival.users);
    if (rng.next() < profile.aggression) act(state, sim, rival, rng.pick(profile.actions));
  }
  pushCapped(campaign.usersHistory, state.gauges.users);
}

/** Utilisateurs d'un rival (0 s'il n'est pas encore arrivé ou n'est plus en jeu). */
export function rivalUsers(state: GameState, id: RivalId): number {
  const rival = state.story?.campaign?.rivals.find((r) => r.id === id);
  return rival?.alive ? rival.users : 0;
}

/** Effet de carte `rivals` : utilisateurs de chaque rival en jeu, en pourcentage. */
export function changeRivalUsers(state: GameState, percent: number): void {
  for (const rival of aliveRivals(state))
    rival.users = Math.max(0, rival.users * (1 + percent / 100));
}
