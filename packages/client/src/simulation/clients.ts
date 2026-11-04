import {
  CLIENT_BASE_FEE,
  CLIENT_BASE_USERS,
  CLIENT_COMPANIES,
  CLIENT_NEEDS,
  CLIENT_SIZE_INFO,
  CLIENT_SIZES,
  CLIENT_SLOTS,
  CLIENTS,
  contractMonthly,
  difficultyOf,
  type ClientContract,
  type ClientNeed,
  type ClientOffer,
  type CommandResult,
  type GameState,
  type Phase,
} from '@oss/shared';
import { addGauge, addMoney, addUsers, moneyText, notify, text, type SimContext } from './helpers';
import { sideRng, type Rng } from './rng';

/*
 * Clients B2B (constantes et règles dans `shared/sim/clients.ts`) : offres tirées à chaque
 * planification sur une graine à part, signature, avancement à la démo, pannes (SLA), forfaits.
 */

/** Points demandés : les contrats grossissent avec la startup. */
const POINTS_SCALE: Record<Phase, number> = {
  GARAGE: 1,
  SEED: 1.5,
  SERIES_A: 2.5,
  UNICORN: 4,
  END: 4,
};

/** Générateur des offres du sprint : il ne touche jamais celui de la partie. */
function clientRng(state: GameState): Rng {
  return sideRng(state.seed, 'clients', state.sprint);
}

/** Contrats pas encore livrés. */
export function activeContracts(state: GameState): ClientContract[] {
  return state.clients.contracts.filter((contract) => contract.status === 'ACTIVE');
}

/** Places restantes pour signer un nouveau contrat. */
export function freeClientSlots(state: GameState): number {
  return Math.max(0, CLIENT_SLOTS[state.phase] - activeContracts(state).length);
}

/** Ce que paient les clients chaque mois (forfaits et maintenance). */
export function clientsMonthly(state: GameState): number {
  return state.clients.contracts.reduce((total, contract) => total + contractMonthly(contract), 0);
}

/** Forfaits des clients pour `days` jours (plus maigres en Hardcore, comme les revenus). */
export function payClients(state: GameState, days: number): void {
  const monthly = clientsMonthly(state);
  if (monthly > 0) settle(state, (monthly * difficultyOf(state.mode).revenue * days) / 30);
}

/** Tire les offres de la planification (une fois par sprint). */
export function refreshClientOffers(state: GameState): void {
  const clients = state.clients;
  if (clients.offersSprint === state.sprint) return;
  clients.offersSprint = state.sprint;
  clients.offers = [];
  if (state.phase === 'END') return;
  const rng = clientRng(state);
  const busy = new Set(clients.contracts.map((contract) => contract.company));
  const companies = CLIENT_COMPANIES.map((_, index) => index).filter((index) => !busy.has(index));
  for (let n = 0; n < CLIENTS.offersPerSprint && companies.length > 0; n++) {
    const company = companies.splice(rng.int(0, companies.length - 1), 1)[0] ?? 0;
    const sizeRoll = rng.next();
    const size = CLIENT_SIZES[sizeRoll < 0.5 ? 0 : sizeRoll < 0.85 ? 1 : 2] ?? 'SMALL';
    const needRoll = rng.next();
    const need: ClientNeed =
      CLIENT_NEEDS[needRoll < 0.5 ? 0 : needRoll < 0.75 ? 1 : 2] ?? 'FEATURE';
    const info = CLIENT_SIZE_INFO[size];
    const points = Math.round(rng.int(info.points[0], info.points[1]) * POINTS_SCALE[state.phase]);
    const fee = CLIENT_BASE_FEE[state.phase] * info.scale * rng.range(0.85, 1.25);
    const users = CLIENT_BASE_USERS[state.phase] * info.scale * rng.range(0.8, 1.2);
    clients.offers.push({
      id: `client-${state.sprint}-${n}`,
      company,
      size,
      need,
      points,
      sprints: info.sprints,
      monthlyFee: Math.round(fee / 100) * 100,
      users: Math.round(users),
    });
  }
}

function companyName(contract: Pick<ClientOffer, 'company'>): string {
  return CLIENT_COMPANIES[contract.company]?.name ?? '?';
}

/** Paie (ou fait payer) et garde le total des contrats. */
function settle(state: GameState, amount: number): void {
  addMoney(state, amount);
  state.clients.earned += amount;
}

/** Signe une offre : prime tout de suite, échéance dans `sprints` sprints (celui-ci compris). */
export function signClient(state: GameState, ctx: SimContext, offerId: string): CommandResult {
  if (state.stage === 'PITCH' || state.stage === 'ENDED')
    return { ok: false, error: 'WRONG_STAGE' };
  const clients = state.clients;
  const offer = clients.offers.find((o) => o.id === offerId);
  if (!offer) return { ok: false, error: 'NOT_FOUND' };
  if (freeClientSlots(state) === 0) return { ok: false, error: 'NOT_ELIGIBLE' };
  clients.offers = clients.offers.filter((o) => o.id !== offerId);
  clients.contracts.push({
    ...offer,
    status: 'ACTIVE',
    signedSprint: state.sprint,
    dueSprint: state.sprint + offer.sprints - 1,
    progress: 0,
    breaches: 0,
    deliveredSprint: null,
  });
  clients.signed += 1;
  const bonus = offer.monthlyFee * CLIENTS.signingMonths;
  settle(state, bonus);
  notify(
    state,
    ctx,
    'CLIENT_SIGNED',
    text(
      [
        'Contrat signé avec {name} : {bonus} de prime, {fee} par mois.',
        'Deal signed with {name}: {bonus} bonus, {fee} a month.',
      ],
      { name: companyName(offer), bonus: moneyText(bonus), fee: moneyText(offer.monthlyFee) },
    ),
  );
  return { ok: true };
}

/** Le client part : pénalité et hype perdue si le travail n'était pas livré. */
function loseClient(
  state: GameState,
  ctx: SimContext,
  contract: ClientContract,
  reason: 'LATE' | 'DROPPED' | 'OUTAGES',
): void {
  const clients = state.clients;
  clients.contracts = clients.contracts.filter((c) => c.id !== contract.id);
  clients.lost += 1;
  const penalty = contract.status === 'ACTIVE' ? contract.monthlyFee * CLIENTS.penaltyMonths : 0;
  if (penalty > 0) {
    settle(state, -penalty);
    addGauge(state, 'hype', CLIENTS.breakHype);
  }
  const params = { name: companyName(contract), penalty: moneyText(penalty) };
  const message =
    reason === 'LATE'
      ? text(
          [
            'Échéance ratée : {name} rompt le contrat et réclame {penalty} de pénalités.',
            'Deadline missed: {name} cancels the deal and claims {penalty} in penalties.',
          ],
          params,
        )
      : reason === 'DROPPED'
        ? text(
            [
              'Contrat avec {name} rompu : {penalty} de pénalités.',
              'Deal with {name} cancelled: {penalty} in penalties.',
            ],
            params,
          )
        : text(
            [
              'Trop de pannes : {name} s’en va chez un concurrent.',
              'Too many outages: {name} leaves for a competitor.',
            ],
            params,
          );
  notify(state, ctx, 'CLIENT_LOST', message);
}

/**
 * Rompt un contrat : pendant le travail, avec pénalité ; en maintenance, le client part sans
 * frais (plus de forfait, plus de SLA).
 */
export function dropClient(state: GameState, ctx: SimContext, contractId: string): CommandResult {
  if (state.stage === 'PITCH' || state.stage === 'ENDED')
    return { ok: false, error: 'WRONG_STAGE' };
  const contract = state.clients.contracts.find((c) => c.id === contractId);
  if (!contract) return { ok: false, error: 'NOT_FOUND' };
  loseClient(state, ctx, contract, 'DROPPED');
  return { ok: true };
}

/**
 * Démo (ou sprint perdu) : les points livrés du type demandé avancent les contrats, dans l'ordre
 * de signature (un point ne compte que pour un contrat). Livré : prime, utilisateurs, hype et
 * maintenance. Échéance passée : le client part.
 */
export function clientsDemo(
  state: GameState,
  ctx: SimContext,
  shipped: Partial<Record<ClientNeed, number>>,
): void {
  const pool = { ...shipped };
  endMaintenance(state, ctx);
  for (const contract of activeContracts(state)) {
    const available = pool[contract.need] ?? 0;
    const used = Math.min(available, contract.points - contract.progress);
    contract.progress += used;
    pool[contract.need] = available - used;
    if (contract.progress >= contract.points) {
      contract.status = 'DELIVERED';
      contract.deliveredSprint = state.sprint;
      state.clients.delivered += 1;
      const bonus = contract.monthlyFee * CLIENTS.deliveryMonths;
      settle(state, bonus);
      addUsers(state, contract.users);
      addGauge(state, 'hype', CLIENTS.deliveryHype);
      notify(
        state,
        ctx,
        'CLIENT_DELIVERED',
        text(
          [
            'Livré à {name} : {bonus} de prime et {users} nouveaux utilisateurs. Il reste en maintenance.',
            'Delivered to {name}: {bonus} bonus and {users} new users. They stay on maintenance.',
          ],
          {
            name: companyName(contract),
            bonus: moneyText(bonus),
            users: Math.round(contract.users),
          },
        ),
      );
    } else if (state.sprint >= contract.dueSprint) {
      loseClient(state, ctx, contract, 'LATE');
    }
  }
}

/** Fin des contrats de maintenance arrivés à leur terme : le client part content. */
function endMaintenance(state: GameState, ctx: SimContext): void {
  const clients = state.clients;
  const ended = clients.contracts.filter(
    (c) =>
      c.deliveredSprint !== null && state.sprint - c.deliveredSprint >= CLIENTS.maintenanceSprints,
  );
  if (ended.length === 0) return;
  clients.contracts = clients.contracts.filter((c) => !ended.includes(c));
  for (const contract of ended)
    notify(
      state,
      ctx,
      'CLIENT_ENDED',
      text(
        [
          'Fin du contrat avec {name}, client satisfait. « On vous recommandera ! »',
          'Contract with {name} ends, happy customer. "We\'ll recommend you!"',
        ],
        { name: companyName(contract) },
      ),
    );
}

/** Panne de prod : chaque client applique son SLA (pénalité), et part après trop de pannes. */
export function clientsOutage(state: GameState, ctx: SimContext): void {
  for (const contract of [...state.clients.contracts]) {
    contract.breaches += 1;
    if (contract.breaches > CLIENTS.maxBreaches) {
      loseClient(state, ctx, contract, 'OUTAGES');
      continue;
    }
    const penalty = contract.monthlyFee * CLIENTS.slaPenaltyMonths;
    settle(state, -penalty);
    notify(
      state,
      ctx,
      'CLIENT_SLA',
      text(
        [
          'Panne : {name} applique le SLA, {penalty} de pénalité ({count}/{max}).',
          'Outage: {name} enforces the SLA, {penalty} penalty ({count}/{max}).',
        ],
        {
          name: companyName(contract),
          penalty: moneyText(penalty),
          count: contract.breaches,
          max: CLIENTS.maxBreaches,
        },
      ),
    );
  }
}
