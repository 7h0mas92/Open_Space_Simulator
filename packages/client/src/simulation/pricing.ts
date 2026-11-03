import {
  difficultyOf,
  oneTimePrice,
  PRICE_TIER_INFO,
  PRICING_MODEL_INFO,
  pricingChangeHype,
  pricingChangeLoss,
  pricingFactors,
  type CommandResult,
  type GameState,
  type LocalizedText,
  type PriceTier,
  type PricingFactors,
  type PricingModel,
} from '@oss/shared';
import { addGauge, addMoney, addUsers, notify, text, type SimContext } from './helpers';

/*
 * Modèle économique (constantes et règles dans `shared/sim/pricing.ts`) : coefficients de revenu,
 * d'acquisition et de départs appliqués par l'économie, et commande `SET_PRICING`.
 * Aucun tirage aléatoire.
 */

/** Coefficients du réglage en cours. */
export function currentPricing(state: GameState): PricingFactors {
  return pricingFactors(state.pricing.model, state.pricing.tier);
}

/**
 * Nouveaux utilisateurs (démo, croissance organique) : le nombre suit l'acquisition du modèle,
 * et en achat unique chacun paie une fois. Renvoie le nombre d'utilisateurs ajoutés.
 */
export function acquireUsers(state: GameState, base: number): number {
  if (base <= 0) return 0;
  const gained = base * currentPricing(state).acquisition;
  addUsers(state, gained);
  const price = oneTimePrice(state.pricing.model, state.pricing.tier);
  if (price > 0) addMoney(state, gained * price * difficultyOf(state.mode).revenue);
  return gained;
}

/**
 * Change le modèle économique et le niveau de prix, une fois par sprint. Une hausse de prix fait
 * partir des utilisateurs tout de suite et coûte de la hype ; une baisse en rapporte un peu.
 */
export function setPricing(
  state: GameState,
  ctx: SimContext,
  model: PricingModel,
  tier: PriceTier,
): CommandResult {
  if (state.stage === 'PITCH' || state.stage === 'ENDED')
    return { ok: false, error: 'WRONG_STAGE' };
  const pricing = state.pricing;
  if (pricing.model === model && pricing.tier === tier) return { ok: false, error: 'NOT_ELIGIBLE' };
  if (pricing.changedSprint === state.sprint) return { ok: false, error: 'COOLDOWN' };
  const lost = state.gauges.users * pricingChangeLoss(pricing, model, tier);
  if (lost > 0) addUsers(state, -lost);
  addGauge(state, 'hype', pricingChangeHype(pricing, model, tier));
  state.pricing = { model, tier, changedSprint: state.sprint, changes: pricing.changes + 1 };
  const name = PRICING_MODEL_INFO[model].name;
  const level = PRICE_TIER_INFO[tier].name;
  notify(
    state,
    ctx,
    'PRICING_CHANGED',
    lost >= 1
      ? text(
          [
            'Nouveau modèle : {name}, prix {level}. {lost} utilisateurs claquent la porte.',
            'New model: {name}, {level} price. {lost} users walk out.',
          ],
          { name, level, lost: countText(lost) },
        )
      : text(['Nouveau modèle : {name}, prix {level}.', 'New model: {name}, {level} price.'], {
          name,
          level,
        }),
  );
  return { ok: true };
}

/** Nombre arrondi, écrit à la française ou à l'anglaise. */
function countText(value: number): LocalizedText {
  const rounded = Math.round(value);
  return { fr: rounded.toLocaleString('fr-FR'), en: rounded.toLocaleString('en-US') };
}
