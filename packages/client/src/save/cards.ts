import {
  BUILTIN_CARDS_VERSION,
  CardSetResponseSchema,
  EVENT_CARDS,
  type CardSetResponse,
} from '@oss/shared';
import { metaApi } from '../api/meta';
import { localStore } from './storage';

const CURRENT_KEY = 'cards:current';
const versionKey = (version: string) => `cards:${version}`;

const BUILTIN: CardSetResponse = { version: BUILTIN_CARDS_VERSION, cards: [...EVENT_CARDS] };

async function cached(key: string): Promise<CardSetResponse | null> {
  try {
    const parsed = CardSetResponseSchema.safeParse(await localStore().get(key));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function remember(set: CardSetResponse): Promise<void> {
  try {
    await localStore().set(CURRENT_KEY, set);
    await localStore().set(versionKey(set.version), set);
  } catch {
    // Stockage indisponible : on jouera avec ce qu'on a.
  }
}

/**
 * Cartes d'une nouvelle partie : celles du serveur (chargées au démarrage et mises en
 * cache), sinon le dernier cache (hors ligne), sinon les 100 cartes intégrées au jeu.
 */
export async function currentCards(): Promise<CardSetResponse> {
  try {
    const set = await metaApi.cards();
    await remember(set);
    return set;
  } catch {
    return (await cached(CURRENT_KEY)) ?? BUILTIN;
  }
}

/** Cartes exactes d'une version (reprise d'une sauvegarde, replay). */
export async function cardsForVersion(version: string): Promise<CardSetResponse> {
  if (version === BUILTIN_CARDS_VERSION) return BUILTIN;
  const local = await cached(versionKey(version));
  if (local) return local;
  const set = await metaApi.cards(version);
  await localStore()
    .set(versionKey(version), set)
    .catch(() => undefined);
  return set;
}
