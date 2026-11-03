import {
  BALANCE,
  SKILLS,
  difficultyOf,
  type EntityId,
  type GameState,
  type LocalizedText,
} from '@oss/shared';
import { forceCard } from '../../events/draw';
import { addGauge, addUsers, devsWithRole, notify, text, type SimContext } from '../helpers';
import { holdCrisisMeeting } from '../meetings';
import { clientsOutage } from '../clients';
import { recordIncident } from '../performance';
import { hasSkill } from '../skills';
import { urgentProdFix } from '../taskFlow';
import type { SimClock } from '../time';

/** Identifiant de la carte « Vendredi 17h04, la prod est down ». */
export const FRIDAY_CARD_ID = 'friday-prod-down';

/**
 * La prod tombe : stabilité, utilisateurs et hype en prennent un coup, et une urgence « Réparer
 * la prod » s'ouvre (avec une réunion de crise si la salle de réunion est aménagée).
 */
export function prodDown(
  state: GameState,
  ctx: SimContext,
  cause: LocalizedText,
  devId: EntityId | null = null,
): void {
  const { stability, hype } = BALANCE;
  addGauge(state, 'stability', -stability.outageLoss);
  addGauge(state, 'hype', -hype.outageLoss);
  addUsers(state, -state.gauges.users * stability.outageUserLoss);
  state.tracker.incidents += 1;
  state.stats.prodOutages += 1;
  if (devId) recordIncident(state, devId);
  notify(state, ctx, 'PROD_DOWN', cause, devId);
  clientsOutage(state, ctx);
  const fixId = urgentProdFix(state, ctx);
  // Salle de réunion aménagée : les personnes concernées s'y réunissent en cellule de crise.
  if (fixId) holdCrisisMeeting(state, ctx, fixId, devId);
}

/**
 * Système « incidents » : le stagiaire casse la prod (5 % par jour), la dette
 * provoque des bugs graves, et le vendredi à 17h la prod a une fâcheuse tendance à tomber.
 */
export function incidentSystem(state: GameState, ctx: SimContext, clock: SimClock): void {
  if (state.stage !== 'EXECUTION' || clock.isWeekend) return;
  const { rng } = ctx;

  if (clock.hour === 12) {
    for (const internId of devsWithRole(state, 'INTERN')) {
      if (state.components.activity[internId]?.kind === 'GONE') continue;
      // « Ne touche plus à main » : même tirage, probabilité plus faible.
      const odds = hasSkill(state, internId, 'hands-off-main')
        ? SKILLS.handsOffMainOdds
        : BALANCE.roles.internBreakProdDaily;
      if (!rng.chance(odds)) continue;
      const name = state.components.identity[internId]?.name ?? '?';
      prodDown(
        state,
        ctx,
        text(
          [
            '{name} a cassé la prod. « Mais ça marchait en local ! »',
            '{name} broke prod. "But it worked on my machine!"',
          ],
          { name },
        ),
        internId,
      );
    }
  }

  if (clock.hour === 15) {
    const debt = state.gauges.debt / 100;
    if (
      rng.chance(BALANCE.stability.debtOutageMax * debt * debt * difficultyOf(state.mode).outages)
    ) {
      prodDown(
        state,
        ctx,
        text([
          'Bug critique en prod : la dette technique a fini par céder.',
          'Critical bug in prod: technical debt finally gave way.',
        ]),
      );
    }
  }

  if (clock.dayOfWeek === 5 && clock.hour === 17) {
    notify(
      state,
      ctx,
      'FRIDAY_17H',
      text([
        'Vendredi, 17h. Personne ne déploie. Personne.',
        'Friday, 5pm. Nobody deploys. Nobody.',
      ]),
    );
    const odds =
      BALANCE.stability.fridayOutageMax *
      (1 - state.gauges.stability / 100) *
      difficultyOf(state.mode).outages;
    if (rng.chance(odds)) {
      state.stats.fridayOutages += 1;
      state.stats.fridayOutageStreak += 1;
      state.stats.maxFridayOutageStreak = Math.max(
        state.stats.maxFridayOutageStreak,
        state.stats.fridayOutageStreak,
      );
      prodDown(
        state,
        ctx,
        text(['Vendredi 17h04 : la prod est down.', 'Friday 5:04pm: prod is down.']),
      );
      forceCard(state, ctx, FRIDAY_CARD_ID);
    } else {
      state.stats.fridayOutageStreak = 0;
    }
  }
}
