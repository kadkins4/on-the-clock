// Cache for generated announcement audio, keyed by the exact spoken sentence.
//
// This is load-bearing, not an optimization. The ElevenLabs free tier is ~10k
// credits/month at 1 character = 1 credit, and a 12-team x 15-round mock is 180
// picks at ~40 characters each — roughly 1.4 uncached drafts per month. Player
// names repeat heavily across mocks, so a warm cache makes repeat drafts nearly
// free.
//
// Every path degrades to "no cache" rather than throwing: jsdom has no
// IndexedDB, private browsing can refuse it, and a full disk can fail a write.
// A silent announcer is a worse bug than a wasted credit.

export interface KeyValueStore {
  get(key: string): Promise<Blob | null>;
  put(key: string, value: Blob): Promise<void>;
  keys(): Promise<string[]>;
  del(key: string): Promise<void>;
}

export interface AudioCache {
  get(text: string): Promise<Blob | null>;
  put(text: string, blob: Blob): Promise<void>;
}

const DEFAULT_MAX_ENTRIES = 500;

// Insertion-ordered in-memory store. Used by tests, and as the fallback when
// IndexedDB exists but the database won't open.
export function memoryStore(): KeyValueStore {
  const m = new Map<string, Blob>();
  return {
    get: (k) => Promise.resolve(m.get(k) ?? null),
    put: (k, v) => {
      m.set(k, v);
      return Promise.resolve();
    },
    keys: () => Promise.resolve([...m.keys()]),
    del: (k) => {
      m.delete(k);
      return Promise.resolve();
    },
  };
}

const DB_NAME = "otc-announcer";
const STORE = "audio";

// IndexedDB-backed store. Returns null (not a throwing store) when IDB is
// absent, so callers can pass the result straight into createAudioCache.
export function idbStore(
  factory: IDBFactory | undefined,
): KeyValueStore | null {
  if (!factory) return null;

  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = factory.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  const tx = <T>(
    mode: IDBTransactionMode,
    run: (s: IDBObjectStore) => IDBRequest<T>,
  ) =>
    open().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const req = run(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
    );

  return {
    get: (k) =>
      tx<Blob | undefined>("readonly", (s) => s.get(k)).then((v) => v ?? null),
    put: (k, v) => tx("readwrite", (s) => s.put(v, k)).then(() => undefined),
    keys: () =>
      tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys()).then((ks) =>
        ks.map(String),
      ),
    del: (k) => tx("readwrite", (s) => s.delete(k)).then(() => undefined),
  };
}

export function createAudioCache(
  store: KeyValueStore | null | undefined,
  maxEntries = DEFAULT_MAX_ENTRIES,
): AudioCache {
  if (!store) {
    return {
      get: () => Promise.resolve(null),
      put: () => Promise.resolve(),
    };
  }

  return {
    async get(text) {
      try {
        return await store.get(text);
      } catch {
        return null;
      }
    },
    async put(text, blob) {
      try {
        await store.put(text, blob);
        // Trim oldest-first. Cheap because insertion order is preserved by both
        // Map and IndexedDB key enumeration is stable enough for a spike.
        const keys = await store.keys();
        for (const stale of keys.slice(0, keys.length - maxEntries)) {
          await store.del(stale);
        }
      } catch {
        /* a cache miss is always survivable */
      }
    },
  };
}

// The cache the app actually uses. Safe to call under jsdom.
export function defaultAudioCache(): AudioCache {
  const factory =
    typeof indexedDB === "undefined" ? undefined : (indexedDB as IDBFactory);
  return createAudioCache(idbStore(factory));
}
