import { GAME, SaveDataSchema, type SaveData, type SaveSummary } from '@oss/shared';
import { metaApi } from '../api/meta';
import { localStore } from './storage';

/** Emplacement 1 : sauvegarde automatique à chaque planification. 2 à 5 : manuelles. */
export const AUTOSAVE_SLOT = 1;
export const SLOTS = Array.from({ length: GAME.saveSlots }, (_, index) => index + 1);

interface LocalSave {
  summary: SaveSummary;
  data: SaveData;
  /** Faux tant que la sauvegarde n'a pas été envoyée au serveur (partie hors ligne). */
  synced: boolean;
}

const slotKey = (slot: number) => `save:${slot}`;

export function summarize(slot: number, data: SaveData, cardsVersion: string): SaveSummary {
  const { state } = data;
  return {
    slot,
    mode: state.mode,
    seed: state.seed,
    sprint: state.sprint,
    phase: state.phase,
    valuation: state.valuation,
    cardsVersion: cardsVersion as SaveSummary['cardsVersion'],
    updatedAt: new Date().toISOString(),
  };
}

async function readLocal(slot: number): Promise<LocalSave | null> {
  const entry = await localStore().get<LocalSave>(slotKey(slot));
  if (!entry || !SaveDataSchema.safeParse(entry.data).success) return null;
  return entry;
}

/**
 * Sauvegardes : toujours copiées dans IndexedDB (jeu hors ligne), et envoyées au serveur
 * quand le joueur est connecté. Ce qui n'a pas pu partir est renvoyé par `syncPending`.
 */
export const saves = {
  async list(online: boolean): Promise<SaveSummary[]> {
    const local = (await Promise.all(SLOTS.map(readLocal))).filter(
      (entry): entry is LocalSave => entry !== null,
    );
    if (!online) return local.map((entry) => entry.summary);
    try {
      const remote = (await metaApi.saves.list()).saves;
      const bySlot = new Map(remote.map((summary) => [summary.slot, summary]));
      // Une sauvegarde locale pas encore synchronisée est plus récente que celle du serveur.
      for (const entry of local) if (!entry.synced) bySlot.set(entry.summary.slot, entry.summary);
      return [...bySlot.values()].sort((a, b) => a.slot - b.slot);
    } catch {
      return local.map((entry) => entry.summary);
    }
  },

  async load(slot: number, online: boolean): Promise<{ data: SaveData; cardsVersion: string }> {
    const local = await readLocal(slot);
    if (online && !(local && !local.synced)) {
      try {
        const { data, summary } = await metaApi.saves.load(slot);
        return { data, cardsVersion: summary.cardsVersion };
      } catch {
        // Hors ligne : on retombe sur la copie locale.
      }
    }
    if (!local) throw new Error(`Emplacement ${slot} vide`);
    return { data: local.data, cardsVersion: local.summary.cardsVersion };
  },

  /** Écrit une sauvegarde ; renvoie vrai si elle est aussi arrivée sur le serveur. */
  async write(
    slot: number,
    data: SaveData,
    cardsVersion: string,
    online: boolean,
  ): Promise<boolean> {
    const summary = summarize(slot, data, cardsVersion);
    let synced = false;
    if (online) {
      try {
        await metaApi.saves.write(slot, { data, cardsVersion: summary.cardsVersion });
        synced = true;
      } catch {
        synced = false;
      }
    }
    await localStore().set(slotKey(slot), { summary, data, synced } satisfies LocalSave);
    return synced;
  },

  async remove(slot: number, online: boolean): Promise<void> {
    await localStore().delete(slotKey(slot));
    if (online) await metaApi.saves.remove(slot).catch(() => undefined);
  },

  /** Envoie au serveur les sauvegardes faites hors ligne (après connexion ou retour du réseau). */
  async syncPending(): Promise<number> {
    let sent = 0;
    for (const slot of SLOTS) {
      const entry = await readLocal(slot);
      if (!entry || entry.synced) continue;
      try {
        await metaApi.saves.write(slot, {
          data: entry.data,
          cardsVersion: entry.summary.cardsVersion,
        });
        await localStore().set(slotKey(slot), { ...entry, synced: true });
        sent += 1;
      } catch {
        break;
      }
    }
    return sent;
  },
};
