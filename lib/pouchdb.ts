let db: any = null;

const resolveModule = (mod: any): any => {
  if (!mod) return null;

  if (typeof mod === 'function') {
    return mod;
  }

  if (typeof mod === 'object') {
    if ('default' in mod) {
      return resolveModule(mod.default);
    }
    if ('PouchDB' in mod) {
      return resolveModule((mod as any).PouchDB);
    }
  }

  return null;
};

const resolvePlugin = (mod: any): any => {
  if (!mod) return null;

  if (typeof mod === 'function') {
    return mod;
  }

  if (typeof mod === 'object' && 'default' in mod) {
    return resolvePlugin(mod.default);
  }

  return null;
};

if (typeof window !== 'undefined') {
  try {
    const PouchDBModule = require('pouchdb-browser');
    const PouchDBFindModule = require('pouchdb-find');

    const PouchDB = resolveModule(PouchDBModule);
    const PouchDBFind = resolvePlugin(PouchDBFindModule);

    if (PouchDB && typeof PouchDB === 'function') {
      if (PouchDBFind) {
        try {
          PouchDB.plugin(PouchDBFind);
        } catch (pluginError) {
          console.warn('⚠️ Erro ao adicionar plugin PouchDB Find:', pluginError);
        }
      }

      try {
        db = new PouchDB('offline_db', {
          auto_compaction: true,
          revs_limit: 1,
        });

        db.createIndex({
          index: {
            fields: ['table'],
          },
        }).catch((err: any) => {
          console.warn('⚠️ Não foi possível criar índice PouchDB:', err);
        });

        console.log('✅ PouchDB inicializado com sucesso');
      } catch (initError: any) {
        console.warn('⚠️ PouchDB não pode ser inicializado (storage bloqueado):', initError.message);
        db = null;
      }
    } else {
      throw new Error(`PouchDB não é uma função construtora. Valor recebido: ${typeof PouchDBModule}`);
    }
  } catch (error) {
    console.warn('PouchDB não pode ser carregado:', error);
    console.warn('Usando mock do PouchDB (funcionalidade offline limitada)');
  }
}

if (!db) {
  console.warn('PouchDB não está disponível - usando mock (operações retornam vazio, não rejeitam)');
  // Mock que retorna resultados neutros para evitar que código de negócio que chama LocalDB quebre
  db = {
    put: async (doc: any) => ({ ok: true, id: doc._id || null, rev: '0-0' }),
    get: async (id: string) => { throw new Error('Documento não encontrado (mock)'); },
    find: async (query: any) => ({ docs: [] }),
    remove: async (id: string, rev?: string) => ({ ok: true, id }),
    allDocs: async (opts: any) => ({ rows: [] }),
    destroy: async () => ({ ok: true }),
    createIndex: async (opts: any) => ({ result: 'created' }),
    info: async () => ({ db_name: 'mock_db', doc_count: 0 }),
    bulkDocs: async (docs: any[]) => docs.map(d => ({ ok: true, id: d._id || 'mock_id', rev: '0-0' })),
  };
}

export default db;
