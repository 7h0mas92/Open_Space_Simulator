/**
 * Petit stockage clé → valeur pour le mode hors ligne : IndexedDB dans le navigateur (gros
 * volumes, asynchrone), mémoire ailleurs (tests, navigation privée sans IndexedDB).
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return structuredClone(this.data.get(key)) as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.data.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async keys(prefix: string): Promise<string[]> {
    return [...this.data.keys()].filter((key) => key.startsWith(prefix));
  }
}

const DB_NAME = 'open-space-simulator';
const STORE = 'kv';

/** Transforme une requête IndexedDB (à callbacks) en promesse. */
function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB'));
  });
}

export class IndexedDbStore implements KeyValueStore {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB'));
    });
    return this.db;
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await this.open()).transaction(STORE, mode).objectStore(STORE);
  }

  async get<T>(key: string): Promise<T | undefined> {
    return (await promisify((await this.store('readonly')).get(key))) as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    await promisify((await this.store('readwrite')).put(value, key));
  }

  async delete(key: string): Promise<void> {
    await promisify((await this.store('readwrite')).delete(key));
  }

  async keys(prefix: string): Promise<string[]> {
    const all = await promisify((await this.store('readonly')).getAllKeys());
    return all.map(String).filter((key) => key.startsWith(prefix));
  }
}

let shared: KeyValueStore | null = null;

/** Le stockage de l'application (IndexedDB si disponible). */
export function localStore(): KeyValueStore {
  shared ??= typeof indexedDB === 'undefined' ? new MemoryStore() : new IndexedDbStore();
  return shared;
}

/** Remplace le stockage (tests). */
export function setLocalStore(store: KeyValueStore): void {
  shared = store;
}
