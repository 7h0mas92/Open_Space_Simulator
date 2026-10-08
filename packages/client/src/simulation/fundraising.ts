import {
  BALANCE,
  INVESTOR_ARCHETYPES,
  ROLE_PROFILES,
  TEAM_MAX,
  PITCH_ARGUMENTS,
  getInvestor,
  getPitchArgument,
  type CommandResult,
  type GameState,
  type Phase,
  type PitchCategory,
} from '@oss/shared';
import { computeValuation, monthlyExpenses } from './economy';
import {
  addGauge,
  addMoney,
  clamp,
  moneyText,
  notify,
  teamMoral,
  teamSize,
  text,
  type SimContext,
} from './helpers';
import { log10Approx, softSigmoid } from './math';

/** Nombre d'arguments proposés à chaque manche. */
const OPTIONS_PER_ROUND = 3;

/** Intérêt de départ de l'investisseur : la hype ouvre les portes. */
export function initialInterest(state: GameState): number {
  return (state.gauges.hype - 50) / 25;
}

/**
 * Force d'un argument (de −1.5 à +2 environ) : il faut des utilisateurs pour parler de
 * traction, un code propre pour parler de technique, une équipe heureuse pour parler d'équipe.
 */
export function argumentStrength(
  state: GameState,
  ctx: SimContext,
  argumentId: string,
  category: PitchCategory,
): number {
  const { users, debt, stability, hype } = state.gauges;
  switch (argumentId) {
    case 'retention':
      return (stability - 50) / 25;
    case 'uptime':
      return (stability - 60) / 20;
    case 'live-demo':
      return ctx.rng.chance(stability / 100) ? 2 : -1.5;
  }
  switch (category) {
    case 'TRACTION':
      return log10Approx(users) / 2 - 1;
    case 'TECH':
      return (60 - debt) / 30;
    case 'TEAM':
      return (teamMoral(state) - 50) / 25 + teamSize(state) / 10;
    case 'VISION':
      return (hype - 40) / 30;
    case 'BUZZWORD':
      return ctx.rng.range(-1, 2);
  }
}

function drawOptions(state: GameState, ctx: SimContext, exclude: readonly string[]): string[] {
  const pool = PITCH_ARGUMENTS.filter((argument) => !exclude.includes(argument.id)).map(
    (a) => a.id,
  );
  return ctx.rng.shuffle(pool).slice(0, OPTIONS_PER_ROUND);
}

/** Phase atteinte grâce à cette levée : 1re levée Seed, 2e Série A, ensuite on reste. */
function phaseAfterRaise(phase: Phase): Phase {
  return phase === 'GARAGE' ? 'SEED' : phase === 'SEED' ? 'SERIES_A' : phase;
}

/** Salaire chargé moyen d'un dev, pour estimer les embauches à venir. */
const AVERAGE_HIRE_COST =
  Object.values(ROLE_PROFILES).reduce((total, role) => total + role.salary, 0) /
    Object.keys(ROLE_PROFILES).length +
  BALANCE.economy.overheadPerDevMonthly;

/**
 * Montant maximum d'une levée : avec la trésorerie déjà en caisse, les investisseurs
 * financent au plus `maxRunwayMonths` mois de dépenses de la phase suivante (équipe à
 * moitié recrutée). Une levée ne doit pas rendre l'argent sans importance pour le reste
 * de la partie, et enchaîner les levées n'empile pas les millions.
 */
export function maxRaise(state: GameState): number {
  const next = phaseAfterRaise(state.phase);
  const { fixedCostsMonthly } = BALANCE.economy;
  const hires = Math.max(0, Math.ceil(TEAM_MAX[next] / 2) - teamSize(state));
  const projected =
    monthlyExpenses(state) -
    fixedCostsMonthly[state.phase] +
    fixedCostsMonthly[next] +
    hires * AVERAGE_HIRE_COST;
  const target = projected * BALANCE.fundraising.maxRunwayMonths;
  return Math.round(Math.max(target * 0.25, target - Math.max(0, state.gauges.treasury)));
}

/** Ouvre le mini-jeu de pitch (pendant la planification). */
export function startPitch(state: GameState, ctx: SimContext): CommandResult {
  if (state.stage !== 'PLANNING') return { ok: false, error: 'WRONG_STAGE' };
  if (state.gauges.hype <= 0) return { ok: false, error: 'NO_HYPE' };
  if (
    state.lastPitchSprint !== null &&
    state.sprint - state.lastPitchSprint < BALANCE.fundraising.cooldownSprints
  ) {
    return { ok: false, error: 'COOLDOWN' };
  }
  state.lastPitchSprint = state.sprint;
  state.stage = 'PITCH';
  state.pitch = {
    investor: ctx.rng.pick(INVESTOR_ARCHETYPES),
    round: 0,
    interest: initialInterest(state),
    options: drawOptions(state, ctx, []),
    chosen: [],
    result: null,
  };
  return { ok: true };
}

/** Le joueur avance un argument ; après la dernière manche, l'investisseur décide. */
export function pitchArgument(
  state: GameState,
  ctx: SimContext,
  argumentId: string,
): CommandResult {
  const pitch = state.pitch;
  if (state.stage !== 'PITCH' || !pitch || pitch.result) return { ok: false, error: 'WRONG_STAGE' };
  const argument = getPitchArgument(argumentId);
  if (!argument || !pitch.options.includes(argumentId))
    return { ok: false, error: 'INVALID_CHOICE' };
  const investor = getInvestor(pitch.investor);
  pitch.interest +=
    argumentStrength(state, ctx, argumentId, argument.category) * investor.likes[argument.category];
  pitch.chosen.push(argumentId);
  pitch.round += 1;
  if (pitch.round < BALANCE.fundraising.rounds) {
    pitch.options = drawOptions(state, ctx, pitch.chosen);
    return { ok: true };
  }
  pitch.options = [];
  concludePitch(state, ctx);
  return { ok: true };
}

/** Décision de l'investisseur et calcul de la dilution. */
function concludePitch(state: GameState, ctx: SimContext): void {
  const pitch = state.pitch;
  if (!pitch) return;
  const success = ctx.rng.chance(softSigmoid(pitch.interest));
  if (!success) {
    pitch.result = { success: false, amount: 0, preMoney: 0, dilution: 0 };
    addGauge(state, 'hype', -5);
    notify(
      state,
      ctx,
      'PITCH_FAILED',
      text([
        'L’investisseur « va revenir vers toi ». Il ne reviendra pas.',
        'The investor will "circle back". They won\'t.',
      ]),
    );
    return;
  }
  // Un investisseur conquis accepte une meilleure valorisation (pre-money) et prend plus de parts.
  const { fundraising: f } = BALANCE;
  let preMoney = Math.round(computeValuation(state) * clamp(1 + pitch.interest * 0.15, 0.7, 1.6));
  const share = clamp(
    f.baseDilution + pitch.interest * f.dilutionPerInterest,
    f.minDilution,
    f.maxDilution,
  );
  const amount = Math.min(Math.round((preMoney * share) / (1 - share)), maxRaise(state));
  // Même pour un chèque plafonné, l'investisseur ne prend jamais moins de `minDilution` :
  // il valorise alors la startup un peu moins cher.
  if (amount / (preMoney + amount) < f.minDilution)
    preMoney = Math.round((amount * (1 - f.minDilution)) / f.minDilution);
  const dilution = amount / (preMoney + amount);
  pitch.result = { success: true, amount, preMoney, dilution };
  addMoney(state, amount);
  state.ownership *= 1 - dilution;
  state.totalRaised += amount;
  state.fundingRounds += 1;
  addGauge(state, 'hype', 8);
  notify(
    state,
    ctx,
    'FUNDS_RAISED',
    text(
      [
        'Levée réussie : {amount} pour {share} % du capital !',
        'Funding secured: {amount} for {share}% of the company!',
      ],
      {
        amount: moneyText(amount),
        share: Math.round(dilution * 1000) / 10,
      },
    ),
  );
  // 1re levée : Seed. 2e levée : Série A. La Licorne se gagne à la valorisation.
  const next = phaseAfterRaise(state.phase);
  if (next !== state.phase) {
    state.phase = next;
    notify(
      state,
      ctx,
      'PHASE_UP',
      next === 'SEED'
        ? text([
            'Phase Seed : vous quittez le garage pour un petit open space !',
            'Seed stage: you leave the garage for a small open space!',
          ])
        : text([
            'Phase Série A : babyfoot, plantes et bureaux debout !',
            'Series A: foosball, plants and standing desks!',
          ]),
    );
  }
}

/** Ferme l'écran de pitch et revient à la planification. */
export function closePitch(state: GameState): CommandResult {
  if (state.stage !== 'PITCH') return { ok: false, error: 'WRONG_STAGE' };
  state.stage = 'PLANNING';
  state.pitch = null;
  return { ok: true };
}
