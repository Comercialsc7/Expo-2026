import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@expo2026_localdb_store';
const DB_NAME = 'expo2026_offline_db';

type Store = Record<string, any>;

let store: Store = {};
let initialized = false;
let loadingPromise: Promise<void> | null = null;

const ensureLoaded = async () => {
  if (initialized) return;

  if (!loadingPromise) {
    loadingPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        store = raw ? JSON.parse(raw) : {};
      } catch (error) {
        console.error('❌ [LocalStoreDB] Erro ao carregar store:', error);
        store = {};
      } finally {
        initialized = true;
      }
    })();
  }

  await loadingPromise;
};

const persist = async () => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};

const nextRev = (currentRev?: string) => {
  const current = Number(String(currentRev || '0').split('-')[0]) || 0;
  return `${current + 1}-local`;
};

const matchesSelector = (doc: any, selector: any) => {
  if (!selector) return true;

  return Object.entries(selector).every(([field, expected]) => {
    const value = doc?.[field];

    if (expected && typeof expected === 'object') {
      if ('$eq' in (expected as any)) return value === (expected as any).$eq;
      return value === expected;
    }

    return value === expected;
  });
};

const db = {
  put: async (doc: any) => {
    await ensureLoaded();
    const id = doc?._id || `${Date.now()}-${Math.random()}`;
    const existing = store[id];
    const saved = {
      ...doc,
      _id: id,
      _rev: nextRev(existing?._rev),
    };

    store[id] = saved;
    await persist();

    return { ok: true, id, rev: saved._rev };
  },

  get: async (id: string) => {
    await ensureLoaded();
    const doc = store[id];
    if (!doc) {
      throw Object.assign(new Error('missing'), { status: 404 });
    }
    return doc;
  },

  find: async (query: any) => {
    await ensureLoaded();
    const selector = query?.selector ?? {};
    const docs = Object.values(store).filter((doc) => matchesSelector(doc, selector));
    return { docs };
  },

  remove: async (id: string) => {
    await ensureLoaded();
    delete store[id];
    await persist();
    return { ok: true, id };
  },

  allDocs: async (opts: any = {}) => {
    await ensureLoaded();
    const includeDocs = !!opts.include_docs;

    const rows = Object.values(store).map((doc: any) => ({
      id: doc._id,
      key: doc._id,
      ...(includeDocs ? { doc } : {}),
    }));

    return { rows, total_rows: rows.length };
  },

  bulkDocs: async (docs: any[]) => {
    await ensureLoaded();

    const results = docs.map((doc) => {
      try {
        const id = doc?._id || `${Date.now()}-${Math.random()}`;

        if (doc?._deleted) {
          delete store[id];
          return { ok: true, id, rev: 'deleted' };
        }

        const existing = store[id];
        const saved = {
          ...doc,
          _id: id,
          _rev: nextRev(existing?._rev),
        };

        store[id] = saved;
        return { ok: true, id, rev: saved._rev };
      } catch (error: any) {
        return { ok: false, error: error?.message || 'bulk_error' };
      }
    });

    await persist();
    return results;
  },

  destroy: async () => {
    store = {};
    await AsyncStorage.removeItem(STORAGE_KEY);
    return { ok: true };
  },

  createIndex: async () => ({ result: 'created' }),

  info: async () => {
    await ensureLoaded();
    return {
      db_name: DB_NAME,
      doc_count: Object.keys(store).length,
    };
  },
};

export default db;
