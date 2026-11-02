import { BALANCE, type GameState, type LocalizedText, type Outcome } from '@oss/shared';
import { BUYERS } from './data/flavor';
import { moneyText, notify, text, type SimContext } from './helpers';

/** Phrase partageable de l'écran de fin, complétée par le bilan des filiales. */
function headline(
  state: GameState,
  outcome: Outcome,
  amount: number,
  buyer: LocalizedText | null,
): LocalizedText {
  const base = mainHeadline(state, outcome, amount, buyer);
  const main =
    state.mode === 'ENDLESS'
      ? concat(
          base,
          text(
            [
              ' Mode illimité : {sprint} sprints tenus.',
              ' Endless mode: {sprint} sprints survived.',
            ],
            { sprint: state.sprint },
          ),
        )
      : base;
  const founded = state.ventures.length;
  if (founded === 0) return main;
  const suffix =
    founded === 1
      ? text([' Le groupe a aussi créé 1 filiale.', ' The group also founded 1 subsidiary.'])
      : text(
          [
            ' Le groupe a aussi créé {count} filiales.',
            ' The group also founded {count} subsidiaries.',
          ],
          {
            count: founded,
          },
        );
  return concat(main, suffix);
}

function concat(a: LocalizedText, b: LocalizedText): LocalizedText {
  return { fr: a.fr + b.fr, en: a.en + b.en };
}

function mainHeadline(
  state: GameState,
  outcome: Outcome,
  amount: number,
  buyer: LocalizedText | null,
): LocalizedText {
  const params = {
    amount: moneyText(amount),
    sprint: state.sprint,
    burnouts: state.stats.burnouts,
    quits: state.stats.resignations,
    buyer: buyer ?? '',
  };
  switch (outcome) {
    case 'BANKRUPTCY':
      return text(
        [
          'Ma startup a fait faillite au sprint {sprint} et {quits} devs ont démissionné.',
          'My startup went bankrupt in sprint {sprint} and {quits} devs quit.',
        ],
        params,
      );
    case 'IPO':
      return text(
        [
          'Ma startup est entrée en Bourse à {amount} et {burnouts} devs ont fait un burn-out.',
          'My startup went public at {amount} and {burnouts} devs burned out.',
        ],
        params,
      );
    case 'ACQUISITION':
      return text(
        [
          'Ma startup a été rachetée {amount} par {buyer} et {burnouts} devs ont fait un burn-out.',
          'My startup was acquired for {amount} by {buyer} and {burnouts} devs burned out.',
        ],
        params,
      );
    case 'ZOMBIE':
      return text(
        [
          'Ma startup est devenue un zombie : vivante, mais sans croissance, après {sprint} sprints.',
          'My startup became a zombie: alive, but not growing, after {sprint} sprints.',
        ],
        params,
      );
  }
}

/** Termine la partie avec une issue et une valorisation finale. */
export function endGame(
  state: GameState,
  ctx: SimContext,
  outcome: Outcome,
  valuation = state.valuation,
  buyer: LocalizedText | null = null,
  /** Phrase de fin imposée (mode Histoire : « Mission réussie… »). */
  headlineOverride?: LocalizedText,
): void {
  if (state.stage === 'ENDED') return;
  const phaseReached = state.phase;
  state.stage = 'ENDED';
  state.phase = 'END';
  state.events.pending = null;
  state.pitch = null;
  const finalValuation = outcome === 'BANKRUPTCY' ? 0 : Math.round(valuation);
  state.result = {
    outcome,
    phaseReached,
    sprint: state.sprint,
    valuation: finalValuation,
    ownership: state.ownership,
    headline: headlineOverride ?? headline(state, outcome, finalValuation, buyer),
  };
  notify(state, ctx, 'GAME_OVER', state.result.headline);
}

/**
 * Fin des 18 mois (ou des 3 sprints du défi) : Licorne → IPO, Série A → rachat (à prix
 * cassé), Seed → rachat si la valorisation dépasse 100 M€, sinon « zombie ». En défi « 3 sprints », il faut avoir livré au moins 5 features.
 */
export function endOfTime(state: GameState, ctx: SimContext): void {
  if (state.mode === 'SHIP_IN_3') {
    if (state.stats.featuresShipped >= 5)
      endGame(state, ctx, 'ACQUISITION', state.valuation, text(ctx.rng.pick(BUYERS)));
    else endGame(state, ctx, 'ZOMBIE');
    return;
  }
  switch (state.phase) {
    case 'UNICORN':
      endGame(state, ctx, 'IPO', state.valuation);
      break;
    case 'SERIES_A':
      endGame(state, ctx, 'ACQUISITION', state.valuation * 0.8, text(ctx.rng.pick(BUYERS)));
      break;
    case 'SEED':
      if (state.valuation >= BALANCE.phases.seedAcquisitionValuation) {
        endGame(state, ctx, 'ACQUISITION', state.valuation * 0.7, text(ctx.rng.pick(BUYERS)));
      } else {
        endGame(state, ctx, 'ZOMBIE');
      }
      break;
    default:
      endGame(state, ctx, 'ZOMBIE');
  }
}
