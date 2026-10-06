import {
  BALANCE,
  TEAM_MAX,
  type EntityId,
  type GameState,
  type LocalizedText,
  type Notification,
  type NotificationKind,
} from '@oss/shared';
import type { CardLibrary } from '../events/library';
import { query } from './ecs';
import type { OfficeEffects } from './furniture';
import type { Rng } from './rng';

/** Ce que chaque système reçoit en plus de l'état : le hasard, les cartes, la boîte d'envoi. */
export interface SimContext {
  rng: Rng;
  cards: CardLibrary;
  /** Notifications émises pendant le pas en cours (transmises au rendu et au Slack). */
  outbox: Notification[];
  /** Effets du mobilier, recalculés au début de chaque pas. */
  office: OfficeEffects;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

type TextParam = string | number | LocalizedText;

/**
 * Texte bilingue à partir d'une paire [fr, en]. Les `{clé}` sont remplacées par
 * `params` ; un paramètre peut lui-même être traduit (montant formaté par langue).
 */
export function text(
  pair: readonly [string, string],
  params: Record<string, TextParam> = {},
): LocalizedText {
  const fill = (template: string, locale: 'fr' | 'en') =>
    template.replace(/\{(\w+)\}/g, (match, key: string) => {
      const value = params[key];
      if (value === undefined) return match;
      return typeof value === 'object' ? value[locale] : String(value);
    });
  return { fr: fill(pair[0], 'fr'), en: fill(pair[1], 'en') };
}

/** Émet une notification : gardée dans l'état (historique court) et envoyée au rendu. */
export function notify(
  state: GameState,
  ctx: SimContext,
  kind: NotificationKind,
  message: LocalizedText,
  entityId: EntityId | null = null,
): void {
  const notification: Notification = { tick: state.tick, kind, text: message, entityId };
  state.notifications.push(notification);
  const overflow = state.notifications.length - BALANCE.history.notificationsKept;
  if (overflow > 0) state.notifications.splice(0, overflow);
  ctx.outbox.push(notification);
}

/** Ajoute une ligne à l'historique d'un dev (fiche détaillée). */
export function addDevLog(state: GameState, devId: EntityId, message: LocalizedText): void {
  const log = state.components.devLog[devId];
  if (!log) return;
  log.push({ sprint: state.sprint, text: message });
  const overflow = log.length - BALANCE.history.devLogKept;
  if (overflow > 0) log.splice(0, overflow);
}

/** Identifiants des devs de l'équipe (entités avec une identité). */
export function devIds(state: GameState): EntityId[] {
  return query(state, 'identity');
}

export function teamSize(state: GameState): number {
  return devIds(state).length;
}

export function teamMax(state: GameState): number {
  return TEAM_MAX[state.phase];
}

/** Moral moyen de l'équipe (100 si l'équipe est vide : personne ne se plaint). */
export function teamMoral(state: GameState): number {
  const ids = devIds(state);
  if (ids.length === 0) return 100;
  let total = 0;
  for (const id of ids) total += state.components.mood[id]?.moral ?? 0;
  return total / ids.length;
}

export function hasRole(state: GameState, role: string): boolean {
  return devIds(state).some((id) => state.components.identity[id]?.role === role);
}

export function devsWithRole(state: GameState, role: string): EntityId[] {
  return devIds(state).filter((id) => state.components.identity[id]?.role === role);
}

type BoundedGauge = 'coffee' | 'debt' | 'stability' | 'hype';

/** Modifie une jauge bornée entre 0 et 100. */
export function addGauge(state: GameState, gauge: BoundedGauge, delta: number): void {
  state.gauges[gauge] = clamp(state.gauges[gauge] + delta, 0, 100);
}

/** Variation de trésorerie, comptée dans le bilan du sprint. */
export function addMoney(state: GameState, delta: number): void {
  state.gauges.treasury += delta;
  if (delta >= 0) state.tracker.revenue += delta;
  else state.tracker.expenses -= delta;
}

/** Variation d'utilisateurs ; les pertes sont comptées dans le bilan du sprint. */
export function addUsers(state: GameState, delta: number): void {
  const before = state.gauges.users;
  state.gauges.users = Math.max(0, before + delta);
  const lost = before - state.gauges.users;
  if (lost > 0) state.tracker.usersLost += lost;
}

export function changeMoral(state: GameState, devId: EntityId, delta: number): void {
  const mood = state.components.mood[devId];
  if (mood) mood.moral = clamp(mood.moral + delta, 0, 100);
}

/** Formate un montant en euros lisible : « 1,2 M€ » en français, « €1.2M » en anglais. */
export function formatMoney(amount: number, locale: 'fr' | 'en'): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const units: [number, string, string][] = [
    [1e9, 'Md€', 'B'],
    [1e6, 'M€', 'M'],
    [1e3, 'k€', 'k'],
  ];
  for (const [size, fr, en] of units) {
    if (abs >= size) {
      const value = (abs / size).toFixed(size === 1e3 ? 0 : 1);
      return locale === 'fr' ? `${sign}${value.replace('.', ',')} ${fr}` : `${sign}€${value}${en}`;
    }
  }
  return locale === 'fr' ? `${sign}${Math.round(abs)} €` : `${sign}€${Math.round(abs)}`;
}

/** Montant formaté dans les deux langues, pour les paramètres de `text()`. */
export function moneyText(amount: number): LocalizedText {
  return { fr: formatMoney(amount, 'fr'), en: formatMoney(amount, 'en') };
}

export type { CardLibrary };
