import {
  OFFICE_SIZE,
  PHASES,
  getFurniture,
  type CommandResult,
  type EntityId,
  type FurnitureDefinition,
  type GameState,
  type Phase,
} from '@oss/shared';
import { addComponent, createEntity, destroyEntity, query } from './ecs';
import { addMoney, devIds } from './helpers';

/** Rang d'une phase (GARAGE = 0, SEED = 1...) pour les comparer. */
export function phaseIndex(phase: Phase): number {
  return PHASES.indexOf(phase);
}

/** Part du prix remboursée à la revente. */
export const RESALE_RATIO = 0.5;

interface Footprint {
  x: number;
  y: number;
  width: number;
  depth: number;
}

function footprint(item: FurnitureDefinition, x: number, y: number, rotation: number): Footprint {
  const turned = rotation % 2 === 1;
  return { x, y, width: turned ? item.depth : item.width, depth: turned ? item.width : item.depth };
}

function overlaps(a: Footprint, b: Footprint): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.depth && b.y < a.y + a.depth;
}

/** Vérifie qu'un objet tient dans le bureau sans chevaucher les autres. */
export function canPlace(
  state: GameState,
  item: FurnitureDefinition,
  x: number,
  y: number,
  rotation: number,
  ignoreId?: EntityId,
): boolean {
  const office = OFFICE_SIZE[state.phase];
  const area = footprint(item, x, y, rotation);
  if (area.x + area.width > office.width || area.y + area.depth > office.depth) return false;
  for (const id of query(state, 'furniture')) {
    if (id === ignoreId) continue;
    const placed = state.components.furniture[id];
    const definition = placed ? getFurniture(placed.itemId) : undefined;
    if (!placed || !definition) continue;
    if (overlaps(area, footprint(definition, placed.x, placed.y, placed.rotation))) return false;
  }
  return true;
}

function countOf(state: GameState, itemId: string): number {
  return query(state, 'furniture').filter((id) => state.components.furniture[id]?.itemId === itemId)
    .length;
}

/** Ajoute un objet sans le payer (aménagement de départ). */
export function placeFurniture(
  state: GameState,
  itemId: string,
  x: number,
  y: number,
  rotation: number,
  price = 0,
): EntityId {
  const id = createEntity(state);
  addComponent(state, id, 'furniture', { itemId, x, y, rotation, purchasePrice: price });
  return id;
}

export function buyFurniture(
  state: GameState,
  itemId: string,
  x: number,
  y: number,
  rotation: number,
): CommandResult {
  const item = getFurniture(itemId);
  if (!item) return { ok: false, error: 'NOT_FOUND' };
  if (phaseIndex(state.phase) < phaseIndex(item.minPhase)) return { ok: false, error: 'LOCKED' };
  if (countOf(state, itemId) >= item.maxCount) return { ok: false, error: 'NOT_ELIGIBLE' };
  if (state.gauges.treasury < item.price) return { ok: false, error: 'NOT_ENOUGH_MONEY' };
  if (!canPlace(state, item, x, y, rotation)) return { ok: false, error: 'INVALID_PLACEMENT' };
  addMoney(state, -item.price);
  placeFurniture(state, itemId, x, y, rotation, item.price);
  return { ok: true };
}

export function moveFurniture(
  state: GameState,
  furnitureId: EntityId,
  x: number,
  y: number,
  rotation: number,
): CommandResult {
  const placed = state.components.furniture[furnitureId];
  const item = placed ? getFurniture(placed.itemId) : undefined;
  if (!placed || !item) return { ok: false, error: 'NOT_FOUND' };
  if (!canPlace(state, item, x, y, rotation, furnitureId))
    return { ok: false, error: 'INVALID_PLACEMENT' };
  placed.x = x;
  placed.y = y;
  placed.rotation = rotation;
  return { ok: true };
}

export function sellFurniture(state: GameState, furnitureId: EntityId): CommandResult {
  const placed = state.components.furniture[furnitureId];
  if (!placed) return { ok: false, error: 'NOT_FOUND' };
  addMoney(state, placed.purchasePrice * RESALE_RATIO);
  destroyEntity(state, furnitureId);
  return { ok: true };
}

/** Effets cumulés du mobilier, recalculés à chaque pas de simulation. */
export interface OfficeEffects {
  coffeeRestock: number;
  moral: number;
  teamProductivity: number;
  quality: number;
  hypePerDay: number;
  stabilityPerDay: number;
  debtPerDay: number;
  restBonus: number;
  babyfoot: boolean;
  /** Bonus individuels attribués aux devs présents au bureau, dans l'ordre d'arrivée. */
  seatProductivity: Record<EntityId, number>;
  seatEnergySaving: Record<EntityId, number>;
  meetingShielded: Record<EntityId, boolean>;
}

/** Distribue des bonus "par poste" (meilleurs d'abord) aux devs présents au bureau. */
function distribute(bonuses: number[], devs: EntityId[]): Record<EntityId, number> {
  const sorted = [...bonuses].sort((a, b) => b - a);
  const result: Record<EntityId, number> = {};
  devs.forEach((id, index) => {
    result[id] = sorted[index] ?? 0;
  });
  return result;
}

export function computeOfficeEffects(state: GameState): OfficeEffects {
  const effects: OfficeEffects = {
    coffeeRestock: 0,
    moral: 0,
    teamProductivity: 0,
    quality: 0,
    hypePerDay: 0,
    stabilityPerDay: 0,
    debtPerDay: 0,
    restBonus: 0,
    babyfoot: false,
    seatProductivity: {},
    seatEnergySaving: {},
    meetingShielded: {},
  };
  const productivitySeats: number[] = [];
  const energySeats: number[] = [];
  let shieldSeats = 0;
  for (const id of query(state, 'furniture')) {
    const placed = state.components.furniture[id];
    const item = placed ? getFurniture(placed.itemId) : undefined;
    if (!item) continue;
    const e = item.effects;
    effects.coffeeRestock += e.coffeeRestock ?? 0;
    effects.moral += e.moral ?? 0;
    effects.teamProductivity += e.teamProductivity ?? 0;
    effects.quality += e.quality ?? 0;
    effects.hypePerDay += e.hypePerDay ?? 0;
    effects.stabilityPerDay += e.stabilityPerDay ?? 0;
    effects.debtPerDay += e.debtPerDay ?? 0;
    effects.restBonus += e.restBonus ?? 0;
    effects.babyfoot ||= e.babyfoot ?? false;
    const seats = e.seats ?? 1;
    for (let i = 0; i < seats; i++) {
      if (e.seatProductivity) productivitySeats.push(e.seatProductivity);
      if (e.seatEnergySaving) energySeats.push(e.seatEnergySaving);
    }
    if (e.meetingShield) shieldSeats += seats;
  }
  const inOffice = devIds(state).filter((id) => !(id in state.components.remote));
  effects.seatProductivity = distribute(productivitySeats, inOffice);
  effects.seatEnergySaving = distribute(energySeats, inOffice);
  inOffice.forEach((id, index) => {
    effects.meetingShielded[id] = index < shieldSeats;
  });
  return effects;
}
