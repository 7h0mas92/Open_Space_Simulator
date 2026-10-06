import type { ComponentName, ComponentOf, EntityId, GameState } from '@oss/shared';

/**
 * Petites fonctions de l'ECS. Une entité = un identifiant ; ses données sont réparties
 * dans `state.components.<nom>[id]`. Les systèmes interrogent les entités par
 * composants : `query(state, 'identity', 'mood')` renvoie tous les devs.
 */

const COMPONENT_NAMES: readonly ComponentName[] = [
  'identity',
  'stats',
  'employment',
  'mood',
  'relations',
  'activity',
  'worker',
  'devLog',
  'task',
  'furniture',
  'remote',
  'rustConverted',
];

/** Réserve un nouvel identifiant d'entité ("e1", "e2"...). */
export function createEntity(state: GameState): EntityId {
  const id = `e${state.nextEntityId}`;
  state.nextEntityId += 1;
  return id;
}

export function addComponent<K extends ComponentName>(
  state: GameState,
  id: EntityId,
  name: K,
  data: ComponentOf<K>,
): void {
  (state.components[name] as Record<string, ComponentOf<K>>)[id] = data;
}

export function getComponent<K extends ComponentName>(
  state: GameState,
  id: EntityId,
  name: K,
): ComponentOf<K> | undefined {
  return (state.components[name] as Record<string, ComponentOf<K> | undefined>)[id];
}

export function hasComponent(state: GameState, id: EntityId, name: ComponentName): boolean {
  return id in state.components[name];
}

export function removeComponent(state: GameState, id: EntityId, name: ComponentName): void {
  Reflect.deleteProperty(state.components[name], id);
}

/** Supprime une entité et tous ses composants. */
export function destroyEntity(state: GameState, id: EntityId): void {
  for (const name of COMPONENT_NAMES) removeComponent(state, id, name);
}

/**
 * Entités possédant TOUS les composants demandés, dans l'ordre de création
 * (l'ordre d'insertion des clés "eN" est stable, même après un aller-retour JSON).
 */
export function query(
  state: GameState,
  first: ComponentName,
  ...others: ComponentName[]
): EntityId[] {
  const ids = Object.keys(state.components[first]);
  if (others.length === 0) return ids;
  return ids.filter((id) => others.every((name) => id in state.components[name]));
}
