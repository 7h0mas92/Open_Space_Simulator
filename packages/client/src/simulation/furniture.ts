import {
  INVENTORY_MAX,
  OFFICE_SIZE,
  officeWidthWithWings,
  officeDepthWithAnnexes,
  annexCount,
  annexDecorItem,
  PHASES,
  DEFAULT_MONITOR,
  getFurniture,
  getMonitor,
  monitorEffects,
  monitorPrice,
  sameMonitor,
  getComputer,
  hasComputer,
  type CommandResult,
  type ComputerId,
  type EntityId,
  type FurnitureColor,
  type FurnitureDefinition,
  type GameState,
  type MonitorChoice,
  type MonitorSetup,
  type Phase,
} from '@oss/shared';
import { addComponent, createEntity, destroyEntity, query } from './ecs';
import { addMoney, devIds } from './helpers';
import { meetingFormat } from './meetings';
import { petEffects } from './pets';
import { projectionEffects } from './projection';
import { floorEffects } from './floors';
import { serverGearEffects } from './serverRoom';
import { subscriptionEffects } from './subscriptions';
import { wallEffects } from './walls';
import { colorUnlocked, hasUnlock } from './unlocks';

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
  const depth = officeDepthWithAnnexes(office.depth, annexCount(state.fundingRounds));
  const area = footprint(item, x, y, rotation);
  if (area.x + area.width > width || area.y + area.depth > depth) return false;
  // Une fenêtre est fixée contre le mur du fond (rotation 0) ou le mur de gauche (rotation 1).
  const wall = item.wall === true;
  if (wall && !(rotation === 0 ? y === 0 : rotation === 1 && x === 0)) return false;
  // Un objet du plafond passe au-dessus du mobilier.
  const ceiling = item.ceiling === true;
  for (const id of query(state, 'furniture')) {
    if (id === ignoreId) continue;
    const placed = state.components.furniture[id];
    const definition = placed ? getFurniture(placed.itemId) : undefined;
    // Les accessoires sont posés sur les meubles : ils n'occupent pas le sol.
    if (!placed || !definition || placed.hostId !== undefined) continue;
    // Les fenêtres ne gênent que les fenêtres du même mur, les objets du plafond que ceux du
    // plafond ; le mobilier, que le mobilier.
    if ((definition.wall === true) !== wall) continue;
    // Exception : un mur vitré monte jusqu'au plafond, rien ne s'accroche au-dessus.
    const fullHeight = definition.partition === 'glass' || item.partition === 'glass';
    if ((definition.ceiling === true) !== ceiling && !fullHeight) continue;
    if (wall && placed.rotation !== rotation) continue;
    if (overlaps(area, footprint(definition, placed.x, placed.y, placed.rotation))) return false;
  }
  return true;
}

/** Exemplaires possédés : posés dans l'open space ou rangés dans l'inventaire. */
function countOf(state: GameState, itemId: string): number {
  const placed = query(state, 'furniture').filter(
    (id) => state.components.furniture[id]?.itemId === itemId,
  ).length;
  return placed + state.inventory.filter((stored) => stored.itemId === itemId).length;
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
  if (!hasUnlock(state, item.unlock)) return { ok: false, error: 'LOCKED' };
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
  if (!colorUnlocked(state, color)) return { ok: false, error: 'LOCKED' };
  if (item.accessory || !canPlace(state, item, x, y, rotation))
    return { ok: false, error: 'INVALID_PLACEMENT' };
  addMoney(state, -item.price);
  const id = placeFurniture(state, itemId, x, y, rotation, item.price, color);
  // Un projecteur de plafond s'allume tout de suite : l'écran en face se déroule.
  if (item.projector) {
    const placed = state.components.furniture[id];
    if (placed) placed.on = true;
  }
  return { ok: true };
}

/** Accessoires posés sur un meuble. */
function accessoriesOf(state: GameState, hostId: EntityId): EntityId[] {
  return query(state, 'furniture').filter(
    (id) => state.components.furniture[id]?.hostId === hostId,
  );
}

/**
 * L'emplacement `slot` du meuble `hostId` existe-t-il, est-il libre et assez grand pour `item` ?
 * Un appareil électroménager ne prend que les emplacements prévus pour lui (`applianceSlots`) ;
 * le matériel serveur, que ceux d'une salle des serveurs.
 */
function canHost(
  state: GameState,
  item: FurnitureDefinition,
  hostId: EntityId,
  slot: number,
  ignoreId?: EntityId,
): boolean {
  const host = state.components.furniture[hostId];
  if (!host || host.hostId !== undefined) return false;
  const definition = getFurniture(host.itemId);
  if (slot >= (definition?.surfaceSlots ?? 0)) return false;
  if (item.appliance && slot >= (definition?.applianceSlots ?? 0)) return false;
  // Le matériel serveur ne va que dans une salle des serveurs, et elle n'accueille que lui.
  if ((item.serverGear !== undefined) !== (definition?.serverRoom === true)) return false;
  return accessoriesOf(state, hostId).every(
    (id) => id === ignoreId || state.components.furniture[id]?.slot !== slot,
  );
}

/**
 * Premier emplacement libre où poser `itemId` (accessoire ou appareil), meubles parcourus dans
 * l'ordre de création. `null` s'il n'y en a aucun. Sert aux joueurs automatiques.
 */
export function findFreeSlot(
  state: GameState,
  itemId: string,
): { hostId: EntityId; slot: number } | null {
  const item = getFurniture(itemId);
  if (!item?.accessory) return null;
  for (const hostId of query(state, 'furniture')) {
    const host = state.components.furniture[hostId];
    const slots = host ? (getFurniture(host.itemId)?.surfaceSlots ?? 0) : 0;
    for (let slot = 0; slot < slots; slot++)
      if (canHost(state, item, hostId, slot)) return { hostId, slot };
  }
  return null;
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
  if (!colorUnlocked(state, color)) return { ok: false, error: 'LOCKED' };
  const host = state.components.furniture[hostId];
  if (!host) return { ok: false, error: 'NOT_FOUND' };
  if (!item.accessory || !canHost(state, item, hostId, slot))
    return { ok: false, error: 'INVALID_PLACEMENT' };
  addMoney(state, -item.price);
  const id = placeFurniture(state, itemId, host.x, host.y, rotation, item.price, color);
  const placed = state.components.furniture[id];
  if (placed) {
    placed.hostId = hostId;
    placed.slot = slot;
    // Un projecteur posé s'allume tout de suite : l'écran en face se déroule.
    if (item.projector) placed.on = true;
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
  const item = placed ? getFurniture(placed.itemId) : undefined;
  if (!placed || !host || !item) return { ok: false, error: 'NOT_FOUND' };
  if (placed.hostId === undefined || !canHost(state, item, hostId, slot, furnitureId))
    return { ok: false, error: 'INVALID_PLACEMENT' };
  placed.hostId = hostId;
  placed.slot = slot;
  placed.x = host.x;
  placed.y = host.y;
  placed.rotation = rotation;
  return { ok: true };
}

/**
 * Range un objet posé dans l'inventaire, avec les accessoires posés dessus. Gratuit : rien n'est
 * revendu, l'objet garde son prix d'achat et sa couleur, mais il ne donne plus aucun effet.
 */
export function storeFurniture(state: GameState, furnitureId: EntityId): CommandResult {
  const placed = state.components.furniture[furnitureId];
  if (!placed) return { ok: false, error: 'NOT_FOUND' };
  const ids = [...accessoriesOf(state, furnitureId), furnitureId];
  if (state.inventory.length + ids.length > INVENTORY_MAX)
    return { ok: false, error: 'INVENTORY_FULL' };
  for (const id of ids) {
    const item = state.components.furniture[id];
    if (!item) continue;
    state.inventory.push({
      itemId: item.itemId,
      purchasePrice: item.purchasePrice,
      ...(item.color ? { color: item.color } : {}),
      ...(item.monitor ? { monitor: { ...item.monitor } } : {}),
      ...(item.computer ? { computer: item.computer } : {}),
    });
    destroyEntity(state, id);
  }
  return { ok: true };
}

/**
 * Position dans l'inventaire du premier objet rangé de ce type et de cette couleur (`natural` ou
 * absente : couleurs d'origine), ou -1.
 */
function storedIndex(state: GameState, itemId: string, color?: FurnitureColor): number {
  const wanted = color && color !== 'natural' ? color : undefined;
  return state.inventory.findIndex((stored) => stored.itemId === itemId && stored.color === wanted);
}

/** Ressort un objet de l'inventaire et le pose au sol. */
export function placeStored(
  state: GameState,
  itemId: string,
  color: FurnitureColor | undefined,
  x: number,
  y: number,
  rotation: number,
): CommandResult {
  const index = storedIndex(state, itemId, color);
  const stored = state.inventory[index];
  const item = stored ? getFurniture(stored.itemId) : undefined;
  if (!stored || !item) return { ok: false, error: 'NOT_FOUND' };
  if (item.accessory || !canPlace(state, item, x, y, rotation))
    return { ok: false, error: 'INVALID_PLACEMENT' };
  state.inventory.splice(index, 1);
  const id = placeFurniture(state, item.id, x, y, rotation, stored.purchasePrice, stored.color);
  const placed = state.components.furniture[id];
  if (placed && stored.monitor) placed.monitor = stored.monitor;
  if (placed && stored.computer) placed.computer = stored.computer;
  if (placed && item.projector) placed.on = true;
  return { ok: true };
}

/** Ressort un accessoire de l'inventaire et le pose sur un meuble à plateau. */
export function placeStoredAccessory(
  state: GameState,
  itemId: string,
  color: FurnitureColor | undefined,
  hostId: EntityId,
  slot: number,
  rotation: number,
): CommandResult {
  const index = storedIndex(state, itemId, color);
  const stored = state.inventory[index];
  const item = stored ? getFurniture(stored.itemId) : undefined;
  const host = state.components.furniture[hostId];
  if (!stored || !item || !host) return { ok: false, error: 'NOT_FOUND' };
  if (!item.accessory || !canHost(state, item, hostId, slot))
    return { ok: false, error: 'INVALID_PLACEMENT' };
  state.inventory.splice(index, 1);
  const id = placeFurniture(
    state,
    item.id,
    host.x,
    host.y,
    rotation,
    stored.purchasePrice,
    stored.color,
  );
  const placed = state.components.furniture[id];
  if (placed) {
    placed.hostId = hostId;
    placed.slot = slot;
    // Un projecteur posé s'allume tout de suite : l'écran en face se déroule.
    if (item.projector) placed.on = true;
  }
  return { ok: true };
}

/** Revend un objet rangé dans l'inventaire, au même prix qu'un objet posé. */
export function sellStored(
  state: GameState,
  itemId: string,
  color: FurnitureColor | undefined,
): CommandResult {
  const index = storedIndex(state, itemId, color);
  const stored = state.inventory[index];
  if (!stored) return { ok: false, error: 'NOT_FOUND' };
  state.inventory.splice(index, 1);
  addMoney(state, (stored.purchasePrice + (stored.monitor?.price ?? 0)) * RESALE_RATIO);
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
  if (!colorUnlocked(state, color)) return { ok: false, error: 'LOCKED' };
  if (color === 'natural') delete placed.color;
  else placed.color = color;
  return { ok: true };
}

/**
 * Change l'ordinateur d'un bureau : l'ancien est revendu (moitié de son prix), le nouveau payé.
 * Sa valeur s'ajoute à celle du bureau, qui la rend à la revente ou la garde à l'inventaire.
 */
export function setComputer(
  state: GameState,
  furnitureId: EntityId,
  computer: ComputerId,
): CommandResult {
  const placed = state.components.furniture[furnitureId];
  if (!placed) return { ok: false, error: 'NOT_FOUND' };
  if (!hasComputer(placed.itemId)) return { ok: false, error: 'NOT_ELIGIBLE' };
  const current = getComputer(placed.computer);
  const next = getComputer(computer);
  if (current.id === next.id) return { ok: true };
  if (phaseIndex(state.phase) < phaseIndex(next.minPhase)) return { ok: false, error: 'LOCKED' };
  const refund = current.price * RESALE_RATIO;
  if (state.gauges.treasury + refund < next.price) return { ok: false, error: 'NOT_ENOUGH_MONEY' };
  addMoney(state, refund - next.price);
  placed.purchasePrice = Math.max(0, placed.purchasePrice - current.price) + next.price;
  if (next.id === 'tower') delete placed.computer;
  else placed.computer = next.id;
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

/**
 * Déplace ou tourne un objet du décor d'une annexe. Il reste du décor : aucun effet, aucun prix.
 * Comme pour le mobilier, la simulation vérifie les bornes et le mobilier déjà posé ; les
 * cloisons, l'entrée et le reste du décor sont vérifiés par le plan (`view/placement.ts`).
 */
export function moveAnnexDecor(
  state: GameState,
  key: string,
  x: number,
  y: number,
  rotation: number,
): CommandResult {
  const itemId = annexDecorItem(key, annexCount(state.fundingRounds));
  const item = itemId ? getFurniture(itemId) : undefined;
  if (!item) return { ok: false, error: 'NOT_FOUND' };
  if (!canPlace(state, item, x, y, rotation)) return { ok: false, error: 'INVALID_PLACEMENT' };
  state.annexDecor = { ...state.annexDecor, [key]: { x, y, rotation } };
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
  addMoney(state, (placed.purchasePrice + (placed.monitor?.price ?? 0)) * RESALE_RATIO);
  destroyEntity(state, furnitureId);
  return { ok: true };
}

/** Écran d'un poste de travail : celui choisi, ou celui livré avec le bureau. */
export function monitorOf(placed: { monitor?: MonitorSetup | undefined }): MonitorChoice {
  return placed.monitor ?? DEFAULT_MONITOR;
}

/**
 * Change l'écran d'un poste de travail. Le nouvel écran est payé, l'ancien revendu à moitié
 * prix (l'écran livré avec le bureau ne rapporte rien). Refusé si c'est déjà le même écran.
 */
export function setMonitor(
  state: GameState,
  furnitureId: EntityId,
  choice: MonitorChoice,
): CommandResult {
  const placed = state.components.furniture[furnitureId];
  const item = placed ? getFurniture(placed.itemId) : undefined;
  const model = getMonitor(choice.model);
  if (!placed || !item || !model) return { ok: false, error: 'NOT_FOUND' };
  if (item.monitor !== true) return { ok: false, error: 'INVALID_PLACEMENT' };
  if (phaseIndex(state.phase) < phaseIndex(model.minPhase)) return { ok: false, error: 'LOCKED' };
  if (sameMonitor(monitorOf(placed), choice)) return { ok: false, error: 'NOT_ELIGIBLE' };
  const price = monitorPrice(choice);
  const refund = (placed.monitor?.price ?? 0) * RESALE_RATIO;
  if (state.gauges.treasury < price - refund) return { ok: false, error: 'NOT_ENOUGH_MONEY' };
  addMoney(state, refund - price);
  placed.monitor = { model: choice.model, size: choice.size, mount: choice.mount, price };
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
    // Projecteurs et écrans déroulants : seulement s'ils projettent ; matériel serveur :
    // seulement si sa salle tourne (voir plus bas).
    if (item.projector || item.projectionScreen || item.serverGear) continue;
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
    // L'écran choisi s'ajoute au poste (l'écran livré avec le bureau n'apporte rien de plus).
    const screen = placed?.monitor ? monitorEffects(placed.monitor) : null;
    if (screen) {
      effects.quality += screen.quality;
      effects.moral += screen.moral;
      effects.debtPerDay += screen.debtPerDay;
    }
    if (e.seatProductivity) effects.desks += seats;
    // L'ordinateur du bureau ajoute son bonus au poste, et un peu de moral, qualité ou hype.
    const pc = hasComputer(item.id) ? getComputer(placed?.computer).effects : {};
    effects.moral += pc.moral ?? 0;
    effects.quality += pc.quality ?? 0;
    effects.hypePerDay += pc.hypePerDay ?? 0;
    for (let i = 0; i < seats; i++) {
      if (e.seatProductivity)
        productivitySeats.push(
          e.seatProductivity + (screen?.productivity ?? 0) + (pc.seatProductivity ?? 0),
        );
      const energy = (e.seatEnergySaving ?? 0) + (screen?.energySaving ?? 0);
      if (energy) energySeats.push(energy);
    }
    if (e.meetingShield) shieldSeats += seats;
  }
  // Projecteurs allumés et écrans déroulés en face d'eux.
  for (const e of projectionEffects(state)) {
    effects.moral += e.moral ?? 0;
    effects.teamProductivity += e.teamProductivity ?? 0;
    effects.quality += e.quality ?? 0;
    effects.hypePerDay += e.hypePerDay ?? 0;
  }
  // Matériel des salles des serveurs qui tournent, et abonnements actifs (fibre arrivée dans une
  // box, etc.).
  for (const e of [...serverGearEffects(state), ...subscriptionEffects(state)]) {
    effects.moral += e.moral ?? 0;
    effects.quality += e.quality ?? 0;
    effects.teamProductivity += e.teamProductivity ?? 0;
    effects.hypePerDay += e.hypePerDay ?? 0;
    effects.stabilityPerDay += e.stabilityPerDay ?? 0;
    effects.debtPerDay += e.debtPerDay ?? 0;
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
  // Les chats du bureau : +moral et +hype s'ils sont bien installés, ils boudent sinon.
  if (state.pets.length > 0) {
    const pets = petEffects(state);
    effects.moral += pets.moral;
    effects.hypePerDay += pets.hypePerDay;
    effects.teamProductivity += pets.teamProductivity;
  }
  // Peintures et papiers peints : un peu de moral, parfois de la qualité ou de la hype.
  const walls = wallEffects(state);
  effects.moral += walls.moral;
  effects.quality += walls.quality;
  effects.hypePerDay += walls.hypePerDay;
  // Sols : un peu de moral, parfois de la qualité ou de la hype.
  const floors = floorEffects(state);
  effects.moral += floors.moral;
  effects.quality += floors.quality;
  effects.hypePerDay += floors.hypePerDay;
  const inOffice = devIds(state).filter((id) => !(id in state.components.remote));
  effects.seatProductivity = distribute(productivitySeats, inOffice);
  effects.seatEnergySaving = distribute(energySeats, inOffice);
  inOffice.forEach((id, index) => {
    effects.meetingShielded[id] = index < shieldSeats;
  });
  return effects;
}
