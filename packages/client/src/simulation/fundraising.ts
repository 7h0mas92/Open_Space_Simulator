import {
  ANNEXES,
  ANNEX_KINDS,
  ANNEX_NAMES,
  BALANCE,
  EARLY_INVESTORS,
  FUNDING_TIERS,
  INVESTOR_ARCHETYPES,
  LATE_INVESTOR_TIER,
  PITCH_ARGUMENTS,
  PITCH_CATEGORIES,
  PITCH_QUESTIONS,
  ROLE_PROFILES,
  TEAM_MAX,
  annexCount,
  endlessRaiseShare,
  freeSeasonStart,
  difficultyOf,
  fundingTier,
  fundingTierIndex,
  getInvestor,
  getPitchArgument,
  type CommandResult,
  type FundingTier,
  type GameState,
  type Phase,
  type PitchArgumentDefinition,
  type PitchCategory,
  type PitchState,
} from '@oss/shared';
import { computeValuation, monthlyExpenses, monthlyRevenue, runwayMonths } from './economy';
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
import { Rng } from './rng';

/*
 * Levée de fonds : chaque tour de table (Seed, Série A, Série B…) est plus exigeant que le
 * précédent (`FUNDING_TIERS`) : plus de questions, plus d'arguments parmi lesquels choisir,
 * une barre plus haute, des réponses hors sujet plus chères et des bluffs plus souvent
 * démasqués.
 *
 * Le générateur principal (`ctx.rng`) tire l'investisseur, les arguments proposés et la
 * décision finale, comme avant. Tout ce qui a été ajouté depuis (questions, bluffs) passe
 * par `pitchRng`, un générateur dérivé de la graine et du sprint : la suite des nombres
 * aléatoires de la partie n'est pas décalée.
 */

/** Multiplicateur d'une bonne réponse qui répond à la question posée. */
const ON_TOPIC_BONUS = 1.2;
/** Effet d'un bluff sur l'intérêt : s'il passe, et s'il est démasqué. */
const BLUFF_SUCCESS = 1.8;
const BLUFF_CAUGHT = -2.5;

/** Générateur dédié, reproductible : même graine, même sprint, même clé ⇒ même tirage. */
function pitchRng(state: GameState, key: string): Rng {
  return Rng.fromSeed(`${state.seed}#pitch#${state.sprint}#${key}`);
}

/** Tour de table du pitch en cours (ou du prochain pitch). */
export function currentTier(state: GameState): FundingTier {
  return state.pitch
    ? (FUNDING_TIERS[state.pitch.tier] ?? fundingTier(0))
    : fundingTier(state.fundingRounds);
}

/** Intérêt de départ de l'investisseur : la hype ouvre les portes. */
export function initialInterest(state: GameState): number {
  return (state.gauges.hype - 50) / 25;
}

/**
 * Force attendue d'un argument (de −1.5 à +2 environ), sans tirage au sort : il faut des
 * utilisateurs pour parler de traction, un code propre pour parler de technique, une équipe
 * heureuse pour parler d'équipe. Les arguments des grands tours demandent de vrais chiffres.
 * Pour la démo en direct, les buzzwords et les bluffs, c'est l'espérance du tirage.
 */
export function expectedStrength(
  state: GameState,
  argument: PitchArgumentDefinition,
  tier: FundingTier,
): number {
  const { users, debt, stability, hype } = state.gauges;
  if (argument.bluff)
    return (1 - tier.bluffCaught) * BLUFF_SUCCESS + tier.bluffCaught * BLUFF_CAUGHT;
  switch (argument.id) {
    case 'retention':
      return (stability - 50) / 25;
    case 'uptime':
      return (stability - 60) / 20;
    case 'live-demo':
      return (stability / 100) * 3.5 - 1.5;
    case 'unit-economics': {
      const expenses = monthlyExpenses(state);
      const ratio = expenses > 0 ? monthlyRevenue(state) / expenses : 1;
      return clamp((ratio - 0.6) * 2.5, -1.5, 2);
    }
    case 'path-to-profit': {
      const runway = runwayMonths(state);
      return runway === Number.POSITIVE_INFINITY ? 2 : clamp((runway - 12) / 8, -1.5, 1.5);
    }
    case 'tech-moat':
      return clamp((45 - debt) / 20, -1.5, 2);
    case 'leadership':
      return clamp(teamSize(state) / 8 - 1 + (teamMoral(state) - 60) / 40, -1.5, 2);
    case 'market-share':
      return clamp((log10Approx(users) - 4.5) / 1.2, -1.5, 2);
  }
  switch (argument.category) {
    case 'TRACTION':
      return log10Approx(users) / 2 - 1;
    case 'TECH':
      return (60 - debt) / 30;
    case 'TEAM':
      return (teamMoral(state) - 50) / 25 + teamSize(state) / 10;
    case 'VISION':
      return (hype - 40) / 30;
    case 'BUZZWORD':
      return 0.5;
  }
}

/** Force réelle d'un argument : tire la démo en direct, les buzzwords et les bluffs. */
function argumentStrength(
  state: GameState,
  ctx: SimContext,
  argument: PitchArgumentDefinition,
  tier: FundingTier,
  manche: number,
): { strength: number; bluffCaught: boolean } {
  if (argument.bluff) {
    const caught = pitchRng(state, `bluff-${manche}`).chance(tier.bluffCaught);
    return { strength: caught ? BLUFF_CAUGHT : BLUFF_SUCCESS, bluffCaught: caught };
  }
  // Mêmes tirages qu'avant l'ajout des tours de table, sur le générateur principal.
  if (argument.id === 'live-demo')
    return {
      strength: ctx.rng.chance(state.gauges.stability / 100) ? 2 : -1.5,
      bluffCaught: false,
    };
  if (argument.category === 'BUZZWORD')
    return { strength: ctx.rng.range(-1, 2), bluffCaught: false };
  return { strength: expectedStrength(state, argument, tier), bluffCaught: false };
}

/**
 * Effet d'une réponse sur l'intérêt : force × goût de l'investisseur, un bonus quand elle
 * répond à la question posée, une pénalité quand elle est hors sujet.
 */
export function answerDelta(
  strength: number,
  like: number,
  onTopic: boolean,
  tier: FundingTier,
): number {
  const raw = strength * like;
  if (!onTopic) return raw - tier.offTopicPenalty;
  return raw > 0 ? raw * ON_TOPIC_BONUS : raw;
}

/** Valeur attendue d'une réponse, sans tirage (utilisée par les bots de `pnpm balance`). */
export function expectedAnswer(state: GameState, pitch: PitchState, argumentId: string): number {
  const argument = getPitchArgument(argumentId);
  if (!argument) return Number.NEGATIVE_INFINITY;
  const tier = FUNDING_TIERS[pitch.tier] ?? fundingTier(0);
  const like = getInvestor(pitch.investor).likes[argument.category];
  const onTopic = !pitch.question || pitch.question.category === argument.category;
  return answerDelta(expectedStrength(state, argument, tier), like, onTopic, tier);
}

/**
 * Réglage de l'estimation, calé sur des milliers de pitchs simulés (bot qui prend le
 * meilleur argument proposé) : écart de moins de 5 points par tranche de 10 %.
 * Part du meilleur argument du thème (il n'est pas toujours proposé) et dispersion due au
 * hasard (investisseur, questions, arguments proposés).
 */
const ESTIMATE_BEST_SHARE = 0.35;
const ESTIMATE_SPREAD = 1.5;

/**
 * Chance estimée de réussir le prochain tour de table, avant d'entrer dans la salle : la
 * hype de départ, puis, à chaque question, un argument du bon thème (entre la moyenne et le
 * meilleur des arguments de ce thème, car on ne choisit que parmi ceux qui sont proposés),
 * les thèmes étant pondérés par les goûts de l'investisseur. Moyenne sur les investisseurs
 * possibles. Sans tirage : c'est ce que le panneau « Lever des fonds » affiche.
 */
export function estimatePitchChance(state: GameState): number {
  const tierIndex = fundingTierIndex(state.fundingRounds);
  const tier = fundingTier(state.fundingRounds);
  const pool = argumentPool(tierIndex, []).flatMap((id) => getPitchArgument(id) ?? []);
  const investors = tierIndex >= LATE_INVESTOR_TIER ? INVESTOR_ARCHETYPES : EARLY_INVESTORS;
  const start = initialInterest(state) - pitchBar(state, tier);
  let total = 0;
  for (const archetype of investors) {
    const { likes } = getInvestor(archetype);
    let weights = 0;
    let perQuestion = 0;
    for (const category of PITCH_CATEGORIES) {
      const answers = pool
        .filter((argument) => argument.category === category)
        .map((argument) =>
          answerDelta(expectedStrength(state, argument, tier), likes[category], true, tier),
        );
      if (answers.length === 0) continue;
      weights += likes[category];
      const mean = answers.reduce((a, b) => a + b, 0) / answers.length;
      const best = Math.max(...answers);
      perQuestion += likes[category] * (mean + (best - mean) * ESTIMATE_BEST_SHARE);
    }
    const x = start + (tier.manches * perQuestion) / Math.max(weights, 1e-9);
    // Les tirages (investisseur, questions, arguments proposés) dispersent le résultat.
    total +=
      (softSigmoid(x - ESTIMATE_SPREAD) + softSigmoid(x) + softSigmoid(x + ESTIMATE_SPREAD)) / 3;
  }
  return total / investors.length;
}

/**
 * Force moyenne de chaque thème au prochain tour de table (sans les goûts de l'investisseur) :
 * ce qui marchera ou non face aux questions, d'après l'état de la startup.
 */
export function categoryStrengths(state: GameState): Record<PitchCategory, number> {
  const tierIndex = fundingTierIndex(state.fundingRounds);
  const tier = fundingTier(state.fundingRounds);
  const pool = argumentPool(tierIndex, []).flatMap((id) => getPitchArgument(id) ?? []);
  const result = {} as Record<PitchCategory, number>;
  for (const category of PITCH_CATEGORIES) {
    const values = pool
      .filter((argument) => argument.category === category && !argument.bluff)
      .map((argument) => expectedStrength(state, argument, tier));
    result[category] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }
  return result;
}

/** Arguments disponibles à ce tour de table, sauf ceux déjà avancés. */
function argumentPool(tierIndex: number, exclude: readonly string[]): string[] {
  return PITCH_ARGUMENTS.filter(
    (argument) => (argument.minTier ?? 0) <= tierIndex && !exclude.includes(argument.id),
  ).map((argument) => argument.id);
}

/**
 * Arguments proposés à une manche. Si aucun ne répond à la question, le dernier est
 * remplacé par le premier argument du bon thème dans l'ordre du mélange (sans tirage).
 */
function drawOptions(
  ctx: SimContext,
  pitch: Pick<PitchState, 'tier' | 'chosen' | 'question'>,
  count: number,
): string[] {
  const shuffled = ctx.rng.shuffle(argumentPool(pitch.tier, pitch.chosen));
  const options = shuffled.slice(0, count);
  const category = pitch.question?.category;
  const matches = (id: string) => getPitchArgument(id)?.category === category;
  if (category && options.length > 0 && !options.some(matches)) {
    const fallback = shuffled.slice(count).find(matches);
    if (fallback) options[options.length - 1] = fallback;
  }
  return options;
}

/**
 * Question de l'investisseur à une manche : un thème tiré selon ses goûts (jamais deux fois
 * de suite le même), puis une formulation de ce thème.
 */
function askQuestion(
  state: GameState,
  pitch: Pick<PitchState, 'investor' | 'question'>,
  manche: number,
): PitchState['question'] {
  const rng = pitchRng(state, `question-${manche}`);
  const likes = getInvestor(pitch.investor).likes;
  const previous = pitch.question?.category;
  const category =
    rng.weighted(
      PITCH_CATEGORIES.filter((c) => c !== previous),
      (c: PitchCategory) => likes[c],
    ) ?? 'TRACTION';
  const count = PITCH_QUESTIONS.filter((question) => question.category === category).length;
  return { category, index: rng.int(0, Math.max(0, count - 1)) };
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
  // En mode illimité, après les 18 mois, les investisseurs financent de moins en moins.
  const target =
    projected *
    BALANCE.fundraising.maxRunwayMonths *
    endlessRaiseShare(state.mode, state.sprint, freeSeasonStart(state.story));
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
  const tierIndex = fundingTierIndex(state.fundingRounds);
  const tier = fundingTier(state.fundingRounds);
  // Les gros fonds (souverain, crossover) n'arrivent qu'aux grands tours.
  const investor = ctx.rng.pick(
    tierIndex >= LATE_INVESTOR_TIER ? INVESTOR_ARCHETYPES : EARLY_INVESTORS,
  );
  const question = askQuestion(state, { investor, question: null }, 0);
  state.pitch = {
    investor,
    round: 0,
    interest: initialInterest(state),
    options: drawOptions(ctx, { tier: tierIndex, chosen: [], question }, tier.options),
    chosen: [],
    result: null,
    tier: tierIndex,
    manches: tier.manches,
    question,
    log: [],
    walkedOut: false,
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
  const tier = FUNDING_TIERS[pitch.tier] ?? fundingTier(0);
  const { strength, bluffCaught } = argumentStrength(state, ctx, argument, tier, pitch.round);
  const onTopic = !pitch.question || pitch.question.category === argument.category;
  const delta = answerDelta(strength, investor.likes[argument.category], onTopic, tier);
  pitch.interest += delta;
  pitch.chosen.push(argumentId);
  pitch.log.push({ argumentId, delta: Math.round(delta * 100) / 100, onTopic, bluffCaught });
  pitch.round += 1;
  // Aux grands tours, un investisseur qui s'ennuie quitte la salle avant la fin (jamais
  // avant d'avoir entendu deux réponses).
  const walkOut =
    tier.walkOut !== null &&
    pitch.round >= 2 &&
    pitch.interest - pitchBar(state, tier) < tier.walkOut;
  if (pitch.round < pitch.manches && !walkOut) {
    pitch.question = askQuestion(state, pitch, pitch.round);
    pitch.options = drawOptions(ctx, pitch, tier.options);
    return { ok: true };
  }
  pitch.options = [];
  pitch.question = null;
  pitch.walkedOut = walkOut && pitch.round < pitch.manches;
  concludePitch(state, ctx);
  return { ok: true };
}

/** Intérêt que l'investisseur attend à ce tour : plus haut en Hardcore (`difficultyOf`). */
export function pitchBar(state: Readonly<GameState>, tier: FundingTier): number {
  return tier.bar + difficultyOf(state.mode).pitchBar;
}

/** Décision de l'investisseur et calcul de la dilution. */
function concludePitch(state: GameState, ctx: SimContext): void {
  const pitch = state.pitch;
  if (!pitch) return;
  const tier = FUNDING_TIERS[pitch.tier] ?? fundingTier(0);
  // L'investisseur parti, il n'y a rien à décider (et rien à tirer).
  const success =
    !pitch.walkedOut && ctx.rng.chance(softSigmoid(pitch.interest - pitchBar(state, tier)));
  if (!success) {
    pitch.result = { success: false, amount: 0, preMoney: 0, dilution: 0 };
    addGauge(state, 'hype', -5 - pitch.tier);
    notify(
      state,
      ctx,
      'PITCH_FAILED',
      pitch.walkedOut
        ? text([
            'L’investisseur a quitté la salle avant la fin du pitch.',
            'The investor walked out before the end of the pitch.',
          ])
        : text([
            'L’investisseur « va revenir vers toi ». Il ne reviendra pas.',
            'The investor will "circle back". They won\'t.',
          ]),
    );
    return;
  }
  // Un investisseur conquis accepte une meilleure valorisation (pre-money) et prend plus de parts.
  // Intérêt ramené à 3 manches : un long pitch ne doit pas gonfler la valorisation.
  const { fundraising: f } = BALANCE;
  const interest = (pitch.interest * 3) / pitch.manches;
  let preMoney = Math.round(computeValuation(state) * clamp(1 + interest * 0.15, 0.7, 1.6));
  const share = clamp(
    f.baseDilution + interest * f.dilutionPerInterest,
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
  const annexesBefore = annexCount(state.fundingRounds);
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
        'Levée {round} réussie : {amount} pour {share} % du capital !',
        '{round} secured: {amount} for {share}% of the company!',
      ],
      {
        round: tier.name,
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
  // À partir de la Série B, chaque levée ouvre une annexe au bureau.
  const annexes = annexCount(state.fundingRounds);
  const annex = ANNEX_KINDS[annexes - 1];
  if (annexes > annexesBefore && annex) {
    notify(
      state,
      ctx,
      'PHASE_UP',
      text(
        [
          'Le bureau s’agrandit : {annex} ouvre, avec {team} places de plus dans l’équipe !',
          'The office grows: a new {annex} opens, with {team} more seats on the team!',
        ],
        { annex: ANNEX_NAMES[annex], team: ANNEXES.teamPerAnnex },
      ),
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
