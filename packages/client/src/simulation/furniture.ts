import {
  OFFICE_SIZE,
  officeWidthWithWings,
  PHASES,
  getFurniture,
  type CommandResult,
  type EntityId,
  type FurnitureColor,
  type FurnitureDefinition,
  type GameState,
  type Phase,
} from '@oss/shared';
import { addComponent, createEntity, destroyEntity, query } from './ecs';
import { addMoney, devIds } from './helpers';
import { meetingFormat } from './meetings';

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
  const width = officeWidthWithWings(office.width, state.ventures.length);
  const area = footprint(item, x, y, rotation);
  if (area.x + area.width > width || area.y + area.depth > office.depth) return false;
  for (const id of query(state, 'furniture')) {
    if (id === ignoreId) continue;
    const placed = state.components.furniture[id];
    const definition = placed ? getFurniture(placed.itemId) : undefined;
    // Les accessoires sont posés sur les meubles : ils n'occupent pas le sol.
    if (!placed || !definition || placed.hostId !== undefined) continue;
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
  color?: FurnitureColor,
): EntityId {
  const id = createEntity(state);
  addComponent(state, id, 'furniture', {
    itemId,
    x,
    y,
    rotation,
    purchasePrice: price,
    ...(color && color !== 'natural' ? { color } : {}),
  });
  return id;
}

/** Vérifications communes à tout achat : objet connu, débloqué, pas au maximum, payable. */
function checkPurchase(state: GameState, item: FurnitureDefinition | undefined): CommandResult {
  if (!item) return { ok: false, error: 'NOT_FOUND' };
  if (phaseIndex(state.phase) < phaseIndex(item.minPhase)) return { ok: false, error: 'LOCKED' };
  if (countOf(state, item.id) >= item.maxCount) return { ok: false, error: 'NOT_ELIGIBLE' };
  if (state.gauges.treasury < item.price) return { ok: false, error: 'NOT_ENOUGH_MONEY' };
  return { ok: true };
}

export function buyFurniture(
  state: GameState,
  itemId: string,
  x: number,
  y: number,
  rotation: number,
  color?: FurnitureColor,
): CommandResult {
  const item = getFurniture(itemId);
  const check = checkPurchase(state, item);
  if (!check.ok || !item) return check;
  if (item.accessory || !canPlace(state, item, x, y, rotation))
    return { ok: false, error: 'INVALID_PLACEMENT' };
  addMoney(state, -item.price);
  placeFurniture(state, itemId, x, y, rotation, item.price, color);
  return { ok: true };
}

/** Accessoires posés sur un meuble. */
function accessoriesOf(state: GameState, hostId: EntityId): EntityId[] {
  return query(state, 'furniture').filter(
    (id) => state.components.furniture[id]?.hostId === hostId,
  );
}

/** L'emplacement `slot` du meuble `hostId` existe-t-il et est-il libre ? */
function canHost(state: GameState, hostId: EntityId, slot: number, ignoreId?: EntityId): boolean {
  const host = state.components.furniture[hostId];
  if (!host || host.hostId !== undefined) return false;
  const slots = getFurniture(host.itemId)?.surfaceSlots ?? 0;
  if (slot >= slots) return false;
  return accessoriesOf(state, hostId).every(
    (id) => id === ignoreId || state.components.furniture[id]?.slot !== slot,
  );
}

/** Achète un accessoire et le pose sur un meuble à plateau. */
export function buyAccessory(
  state: GameState,
  itemId: string,
  hostId: EntityId,
  slot: number,
  rotation: number,
  color?: FurnitureColor,
): CommandResult {
  const item = getFurniture(itemId);
  const check = checkPurchase(state, item);
  if (!check.ok || !item) return check;
  const host = state.components.furniture[hostId];
  if (!host) return { ok: false, error: 'NOT_FOUND' };
  if (!item.accessory || !canHost(state, hostId, slot))
    return { ok: false, error: 'INVALID_PLACEMENT' };
  addMoney(state, -item.price);
  const id = placeFurniture(state, itemId, host.x, host.y, rotation, item.price, color);
  const placed = state.components.furniture[id];
  if (placed) {
    placed.hostId = hostId;
    placed.slot = slot;
  }
  return { ok: true };
}

export function moveAccessory(
  state: GameState,
  furnitureId: EntityId,
  hostId: EntityId,
  slot: number,
  rotation: number,
): CommandResult {
  const placed = state.components.furniture[furnitureId];
  const host = state.components.furniture[hostId];
  if (!placed || !host) return { ok: false, error: 'NOT_FOUND' };
  if (placed.hostId === undefined || !canHost(state, hostId, slot, furnitureId))
    return { ok: false, error: 'INVALID_PLACEMENT' };
  placed.hostId = hostId;
  placed.slot = slot;
  placed.x = host.x;
  placed.y = host.y;
  placed.rotation = rotation;
  return { ok: true };
}

/** Repeint un objet posé (gratuit). */
export function paintFurniture(
  state: GameState,
  furnitureId: EntityId,
  color: FurnitureColor,
): CommandResult {
  const placed = state.components.furniture[furnitureId];
  if (!placed) return { ok: false, error: 'NOT_FOUND' };
  if (color === 'natural') delete placed.color;
  else placed.color = color;
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
  if (placed.hostId !== undefined || !canPlace(state, item, x, y, rotation, furnitureId))
    return { ok: false, error: 'INVALID_PLACEMENT' };
  placed.x = x;
  placed.y = y;
  placed.rotation = rotation;
  // Les accessoires suivent leur meuble (leurs emplacements tournent avec lui).
  for (const id of accessoriesOf(state, furnitureId)) {
    const accessory = state.components.furniture[id];
    if (accessory) {
      accessory.x = x;
      accessory.y = y;
    }
  }
  return { ok: true };
}

export function sellFurniture(state: GameState, furnitureId: EntityId): CommandResult {
  const placed = state.components.furniture[furnitureId];
  if (!placed) return { ok: false, error: 'NOT_FOUND' };
  // Revendre un meuble revend aussi ce qui est posé dessus.
  for (const id of accessoriesOf(state, furnitureId)) {
    addMoney(state, (state.components.furniture[id]?.purchasePrice ?? 0) * RESALE_RATIO);
    destroyEntity(state, id);
  }
  addMoney(state, placed.purchasePrice * RESALE_RATIO);
  destroyEntity(state, furnitureId);
  return { ok: true };
}

/** Nombre de postes de travail (bureaux) posés dans l'open space. */
export function countDesks(state: GameState): number {
  let desks = 0;
  for (const id of query(state, 'furniture')) {
    const placed = state.components.furniture[id];
    const effects = placed ? getFurniture(placed.itemId)?.effects : undefined;
    if (effects?.seatProductivity) desks += effects.seats ?? 1;
  }
  return desks;
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
  /** Postes de travail (bureaux) : au-delà, les devs sans bureau télétravaillent. */
  desks: number;
  /** Bonus individuels attribués aux devs présents au bureau, dans l'ordre d'arrivée. */
  seatProductivity: Record<EntityId, number>;
  seatEnergySaving: Record<EntityId, number>;
  meetingShielded: Record<EntityId, boolean>;
  /** Multiplicateur du malus des réunions du Product Owner (salle de réunion ; 1 sans salle). */
  meetingPenalty: number;
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
    desks: 0,
    seatProductivity: {},
    seatEnergySaving: {},
    meetingShielded: {},
    meetingPenalty: 1,
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
    if (e.seatProductivity) effects.desks += seats;
    for (let i = 0; i < seats; i++) {
      if (e.seatProductivity) productivitySeats.push(e.seatProductivity);
      if (e.seatEnergySaving) energySeats.push(e.seatEnergySaving);
    }
    if (e.meetingShield) shieldSeats += seats;
  }
  // L'aménagement de la salle de réunion s'ajoute au mobilier (bonus et malus).
  const room = meetingFormat(state);
  if (room) {
    const r = room.effects;
    effects.moral += r.moral ?? 0;
    effects.teamProductivity += r.teamProductivity ?? 0;
    effects.quality += r.quality ?? 0;
    effects.hypePerDay += r.hypePerDay ?? 0;
    effects.stabilityPerDay += r.stabilityPerDay ?? 0;
    effects.restBonus += r.restBonus ?? 0;
    effects.meetingPenalty = room.poPenalty;
  }
  const inOffice = devIds(state).filter((id) => !(id in state.components.remote));
  effects.seatProductivity = distribute(productivitySeats, inOffice);
  effects.seatEnergySaving = distribute(energySeats, inOffice);
  inOffice.forEach((id, index) => {
    effects.meetingShielded[id] = index < shieldSeats;
  });
  return effects;
}
