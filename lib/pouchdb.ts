import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Declaração segura para persistência
let db: any = null;

const initDB = () => {
  if (db) return db;

  // Web Environment (Mobile Browser or Desktop Browser)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      console.log('📦 [PouchDB] Inicializando banco de dados (Web/PWA)...');

      // Imports diretos para Web garantem melhor compatibilidade com bundlers
      const PouchDB = require('pouchdb-browser').default || require('pouchdb-browser');
      const PouchDBFind = require('pouchdb-find').default || require('pouchdb-find');

      // Registrar plugins
      if (PouchDBFind) {
        PouchDB.plugin(PouchDBFind);
      }

      // Inicializar banco
      db = new PouchDB('expo2026_offline_db', {
        auto_compaction: true,
        revs_limit: 1,
      });

      // Validar se o banco está realmente salvando (teste simples)
      db.info().then((info: any) => {
        console.log(`✅ [PouchDB] Banco '${info.db_name}' pronto! Docs: ${info.doc_count}`);
      }).catch((err: any) => {
        console.error('❌ [PouchDB] Falha ao obter info do banco:', err);
      });

      // Garantir índices base
      db.createIndex({
        index: { fields: ['table'] }
      }).then(() => {
        console.log('✅ [PouchDB] Índice "table" verificado/criado');
      }).catch((e: any) => {
        console.warn('⚠️ [PouchDB] Erro ao criar índice:', e);
      });

      return db;

    } catch (error: any) {
      console.error('❌ [PouchDB] ERRO CRÍTICO NA INICIALIZAÇÃO:', error);
      // Fallback para Mock apenas se falhar muito feio
    }
  }

  // Se chegou aqui e db ainda é null (Native ou erro), usa fallback persistente.
  if (!db) {
    console.warn('⚠️ [PouchDB] Usando fallback persistente com AsyncStorage');
    db = createPersistentFallbackDB();
  }

  return db;
};

const FALLBACK_KEY = '@pouch_fallback:expo2026_offline_db';

const createPersistentFallbackDB = () => {
  let cache: Record<string, any> | null = null;

  const loadStore = async (): Promise<Record<string, any>> => {
    if (cache) {
      return cache;
    }

    try {
      const raw = await AsyncStorage.getItem(FALLBACK_KEY);
      cache = raw ? JSON.parse(raw) : {};
      return cache;
    } catch (error) {
      console.error('❌ [PouchDB Fallback] Erro ao carregar store:', error);
      cache = {};
      return cache;
    }
  };

  const persistStore = async (store: Record<string, any>) => {
    cache = store;
    await AsyncStorage.setItem(FALLBACK_KEY, JSON.stringify(store));
  };

  return {
    put: async (doc: any) => {
      const store = await loadStore();
      const id = doc._id || Date.now().toString();
      const prev = store[id];
      const revNumber = prev ? Number(String(prev._rev || '0').split('-')[0]) + 1 : 1;
      const next = { ...doc, _id: id, _rev: `${revNumber}-fallback` };
      store[id] = next;
      await persistStore(store);
      return { ok: true, id, rev: next._rev };
    },
    get: async (id: string) => {
      const store = await loadStore();
      if (store[id]) return store[id];
      throw { status: 404, message: 'missing' };
    },
    find: async (query: any) => {
      const store = await loadStore();
      const docs = Object.values(store);
      if (query.selector && query.selector.table) {
        const tableValue = query.selector.table.$eq ?? query.selector.table;
        return { docs: docs.filter((d: any) => d.table === tableValue) };
      }
      return { docs };
    },
    remove: async (id: string, rev?: string) => {
      const store = await loadStore();
      if (store[id]) {
        delete store[id];
        await persistStore(store);
        return { ok: true, id };
      }
      return { ok: true, id, message: 'not found but ok' };
    },
    allDocs: async (opts: any) => {
      const store = await loadStore();
      const rows = Object.values(store).map(doc => ({ doc, id: doc._id, key: doc._id }));
      return { rows, total_rows: rows.length };
    },
    bulkDocs: async (docs: any[]) => {
      const store = await loadStore();
      const results = docs.map(d => {
        if (d._deleted) {
          delete store[d._id];
          return { ok: true, id: d._id, rev: 'deleted' };
        }
        const id = d._id || Date.now().toString();
        const prev = store[id];
        const revNumber = prev ? Number(String(prev._rev || '0').split('-')[0]) + 1 : 1;
        const next = { ...d, _id: id, _rev: `${revNumber}-bulk` };
        store[id] = next;
        return { ok: true, id, rev: next._rev };
      });
      await persistStore(store);
      return results;
    },
    destroy: async () => {
      const store = await loadStore();
      for (const key in store) delete store[key];
      await AsyncStorage.removeItem(FALLBACK_KEY);
      cache = {};
      return { ok: true };
    },
    createIndex: async () => ({ result: 'mock_created' }),
    info: async () => {
      const store = await loadStore();
      return { db_name: 'fallback_asyncstorage_db', doc_count: Object.keys(store).length };
    },
  };
};

// Inicializa singleton
db = initDB();

export default db;
