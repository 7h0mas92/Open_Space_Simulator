import type { SaveData } from '@oss/shared';
import { vi } from 'vitest';
import type { GameView } from '../../../src/view/types';
import { officeSimulation, SEED_OFFICE, viewOf } from '../fixtures/game';

/** Réponse du faux serveur pour une route. */
export type Handler = (init?: RequestInit) => Response | Promise<Response>;

/**
 * Faux serveur : associe "MÉTHODE /chemin?requête" à une réponse. Une route inconnue
 * simule une coupure réseau (fetch rejette), ce qui évite les tentatives de refresh.
 */
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    const handler = routes[key];
    if (!handler) throw new TypeError(`Réseau coupé : ${key}`);
    return handler(init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Les appels faits au faux serveur, sous la forme "MÉTHODE /chemin". */
export function calls(fetchMock: ReturnType<typeof mockApi>): string[] {
  return fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}`);
}

/** Corps JSON envoyé lors d'un appel. */
export function bodyOf(fetchMock: ReturnType<typeof mockApi>, key: string): unknown {
  const call = fetchMock.mock.calls.find(
    ([input, init]) => `${init?.method ?? 'GET'} ${String(input)}` === key,
  );
  return call?.[1]?.body ? JSON.parse(String(call[1].body)) : undefined;
}

/** Instantané d'une vraie partie (bureau Seed, 4 devs), avec des champs remplacés. */
export function gameView(overrides: Partial<GameView> = {}): GameView {
  return { ...viewOf(officeSimulation(SEED_OFFICE)), ...overrides };
}

/** Sauvegarde valide d'une vraie partie. */
export function saveData(seed = 'tests'): SaveData {
  const simulation = officeSimulation({ ...SEED_OFFICE, seed });
  return { state: structuredClone(simulation.state), commands: [] };
}
