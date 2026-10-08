import {
  BALANCE,
  SEASONS,
  birthdayFromKey,
  calendarStartDays,
  isBirthday,
  isBirthdayParty,
  seasonsAt,
  type Birthday,
  type EntityId,
  type GameState,
} from '@oss/shared';
import { addDevLog, changeMoral, devIds, notify, text, type SimContext } from '../helpers';
import type { SimClock } from '../time';

/**
 * Le calendrier de la partie : anniversaires des devs et périodes à thème (Halloween, Noël…).
 * Les dates viennent de la graine (voir `calendar.ts` dans `shared`), jamais de l'horloge réelle.
 */

/** Jour réel (en jours depuis 1970) d'un jour de partie. */
export function calendarDay(state: GameState, gameDay: number): number {
  return calendarStartDays(state.seed) + gameDay;
}

/** Anniversaire d'un dev ; les sauvegardes plus anciennes le tirent de son identifiant. */
export function birthdayOf(state: GameState, id: EntityId): Birthday {
  return state.components.identity[id]?.birthday ?? birthdayFromKey(`${state.seed}:${id}`);
}

/** Devs dont on fête l'anniversaire ce jour de partie. */
export function birthdayPartyIds(state: GameState, gameDay: number): EntityId[] {
  const days = calendarDay(state, gameDay);
  return devIds(state).filter((id) => isBirthdayParty(birthdayOf(state, id), days));
}

function celebrate(state: GameState, ctx: SimContext, id: EntityId, days: number): void {
  const identity = state.components.identity[id];
  if (!identity) return;
  // L'âge augmente le jour même, ou le samedi/dimanche quand la fête est rattrapée lundi.
  identity.age += 1;
  const { name, age } = identity;
  changeMoral(state, id, BALANCE.birthday.moral);
  for (const other of devIds(state)) {
    if (other !== id && !(other in state.components.remote))
      changeMoral(state, other, BALANCE.birthday.teamMoral);
  }
  const caughtUp = !isBirthday(birthdayOf(state, id), days);
  const ghost = id in state.components.remote;
  addDevLog(
    state,
    id,
    text(['A fêté ses {age} ans au bureau.', 'Celebrated turning {age} at the office.'], { age }),
  );
  notify(
    state,
    ctx,
    'DEV_BIRTHDAY',
    ghost
      ? text(
          [
            'C’est l’anniversaire de {name} ({age} ans) ! Gâteau au bureau… sans {name}, en télétravail.',
            'It’s {name}’s birthday ({age})! Cake at the office… without {name}, who works from home.',
          ],
          { name, age },
        )
      : caughtUp
        ? text(
            [
              'Anniversaire de {name} ({age} ans) rattrapé ce lundi : gâteau et cadeaux sur la table !',
              '{name}’s birthday ({age}) is celebrated this Monday: cake and presents on the table!',
            ],
            { name, age },
          )
        : text(
            [
              'C’est l’anniversaire de {name} ({age} ans) ! Gâteau et cadeaux sur la table.',
              'It’s {name}’s birthday ({age})! Cake and presents on the table.',
            ],
            { name, age },
          ),
    id,
  );
}

/** Annonce une période qui commence (ou en cours au début de la partie). */
export function announceSeasons(state: GameState, ctx: SimContext, days: number, onlyNew: boolean) {
  const yesterday = new Set(onlyNew ? seasonsAt(days - 1) : []);
  for (const theme of seasonsAt(days)) {
    if (yesterday.has(theme)) continue;
    notify(
      state,
      ctx,
      'SEASON_STARTED',
      text(['C’est parti : {season} !', 'Here it comes: {season}!'], {
        season: SEASONS[theme].name,
      }),
    );
  }
}

/** Système « calendrier », à minuit : nouvelles périodes et anniversaires du jour. */
export function calendarSystem(state: GameState, ctx: SimContext, clock: SimClock): void {
  if (clock.hour !== 0) return;
  const days = calendarDay(state, clock.day);
  announceSeasons(state, ctx, days, true);
  for (const id of birthdayPartyIds(state, clock.day)) celebrate(state, ctx, id, days);
}
