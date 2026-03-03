import { Platform } from 'react-native';

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

  // Se chegou aqui e db ainda é null (Native ou Erro), usa Mock ou tenta Adapter nativo (não configurado aqui)
  if (!db) {
    console.warn('⚠️ [PouchDB] Usando MOCK DB (Memória Volátil) - Dados serão perdidos ao recarregar!');
    db = createMockDB();
  }

  return db;
};

const createMockDB = () => {
  const store: Record<string, any> = {};
  return {
    put: async (doc: any) => {
      const id = doc._id || Date.now().toString();
      store[id] = { ...doc, _id: id, _rev: '1-mock' };
      return { ok: true, id, rev: '1-mock' };
    },
    get: async (id: string) => {
      if (store[id]) return store[id];
      throw { status: 404, message: 'missing' };
    },
    find: async (query: any) => {
      // Mock find muito simples (scan linear)
      const docs = Object.values(store);
      // Filtro básico de table se existir no selector
      if (query.selector && query.selector.table) {
        return { docs: docs.filter(d => d.table === query.selector.table) };
      }
      return { docs };
    },
    remove: async (id: string, rev?: string) => {
      if (store[id]) {
        delete store[id];
        return { ok: true, id };
      }
      return { ok: true, id, message: 'not found but ok' };
    },
    allDocs: async (opts: any) => {
      const rows = Object.values(store).map(doc => ({ doc, id: doc._id, key: doc._id }));
      return { rows, total_rows: rows.length };
    },
    bulkDocs: async (docs: any[]) => {
      return docs.map(d => {
        if (d._deleted) {
          delete store[d._id];
          return { ok: true, id: d._id, rev: 'deleted' };
        }
        const id = d._id || Date.now().toString();
        store[id] = { ...d, _id: id, _rev: '1-bulk' };
        return { ok: true, id, rev: '1-bulk' };
      });
    },
    destroy: async () => {
      for (const key in store) delete store[key];
      return { ok: true };
    },
    createIndex: async () => ({ result: 'mock_created' }),
    info: async () => ({ db_name: 'mock_memory_db', doc_count: Object.keys(store).length }),
  };
};

// Inicializa singleton
db = initDB();

export default db;
