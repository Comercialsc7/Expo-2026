import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/pouchdb', () => {
  const store = new Map<string, any>();

  const db = {
    put: async (doc: any) => {
      const existing = store.get(doc._id);
      const revNumber = existing ? Number(String(existing._rev || '0').split('-')[0]) + 1 : 1;
      const saved = { ...doc, _rev: `${revNumber}-mock` };
      store.set(saved._id, saved);
      return { ok: true, id: saved._id, rev: saved._rev };
    },
    get: async (id: string) => {
      const doc = store.get(id);
      if (!doc) {
        throw Object.assign(new Error('missing'), { status: 404 });
      }
      return doc;
    },
    find: async (query: any) => {
      const docs = Array.from(store.values());
      const selector = query?.selector ?? {};
      const filtered = docs.filter((doc: any) => {
        return Object.entries(selector).every(([key, value]: [string, any]) => {
          if (value && typeof value === 'object' && '$eq' in value) {
            return doc[key] === value.$eq;
          }
          return doc[key] === value;
        });
      });
      return { docs: filtered };
    },
    remove: async (id: string) => {
      store.delete(id);
      return { ok: true, id };
    },
    allDocs: async () => {
      const rows = Array.from(store.values()).map((doc: any) => ({
        id: doc._id,
        key: doc._id,
        doc,
      }));
      return { rows, total_rows: rows.length };
    },
    bulkDocs: async (docs: any[]) => {
      return docs.map((doc) => {
        if (doc._deleted) {
          store.delete(doc._id);
          return { ok: true, id: doc._id, rev: 'deleted' };
        }

        const id = doc._id || `${Date.now()}-${Math.random()}`;
        const existing = store.get(id);
        const revNumber = existing ? Number(String(existing._rev || '0').split('-')[0]) + 1 : 1;
        const saved = { ...doc, _id: id, _rev: `${revNumber}-bulk` };
        store.set(id, saved);

        return { ok: true, id, rev: saved._rev };
      });
    },
    destroy: async () => {
      store.clear();
      return { ok: true };
    },
    createIndex: async () => ({ result: 'created' }),
    info: async () => ({ db_name: 'test-db', doc_count: store.size }),
  };

  return {
    default: db,
  };
});

import LocalDB from '../lib/LocalDB';
import TableStore from '../lib/TableStore';

describe('Offline persistence across app tables', () => {
  beforeEach(async () => {
    await LocalDB.clearAll();
  });

  it('persiste produtos, clientes e marcas ao mesmo tempo (não só produtos)', async () => {
    await TableStore.set('products', [
      { id: 'p1', code: '001', name: 'Produto 1' },
      { id: 'p2', code: '002', name: 'Produto 2' },
    ]);

    await TableStore.set('clients', [
      { id: 'c1', code: '100', name: 'Cliente 1' },
    ]);

    await TableStore.set('brands', [
      { id: 'b1', code: '200', name: 'Marca 1' },
    ]);

    const products = await TableStore.get('products');
    const clients = await TableStore.get('clients');
    const brands = await TableStore.get('brands');

    expect(products).toHaveLength(2);
    expect(clients).toHaveLength(1);
    expect(brands).toHaveLength(1);

    expect(products.map((item) => item.name)).toEqual(['Produto 1', 'Produto 2']);
    expect(clients[0].name).toBe('Cliente 1');
    expect(brands[0].name).toBe('Marca 1');
  });

  it('atualizar uma tabela não remove dados das outras', async () => {
    await TableStore.set('products', [{ id: 'p1', name: 'Produto inicial' }]);
    await TableStore.set('clients', [{ id: 'c1', name: 'Cliente persistente' }]);

    await TableStore.set('products', [{ id: 'p2', name: 'Produto novo' }]);

    const products = await TableStore.get('products');
    const clients = await TableStore.get('clients');

    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Produto novo');

    expect(clients).toHaveLength(1);
    expect(clients[0].name).toBe('Cliente persistente');
  });
});
