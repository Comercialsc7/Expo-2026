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

const upsertMock = vi.fn(async () => ({ error: null }));
const gtMock = vi.fn(async () => ({ data: [], error: null }));
const selectMock = vi.fn(() => ({
  gt: gtMock,
  then: (resolve: (value: any) => any) => resolve({ data: [], error: null }),
}));

vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      from: (table: string) => ({
        upsert: (payload: any) => upsertMock(table, payload),
        select: () => selectMock(table),
      }),
    },
  };
});

import LocalDB from '../lib/LocalDB';
import SyncService from '../lib/SyncService';

describe('Offline order queue and reconnection sync', () => {
  beforeEach(async () => {
    await LocalDB.clearAll();
    vi.clearAllMocks();

    upsertMock.mockResolvedValue({ error: null });
    gtMock.mockResolvedValue({ data: [], error: null });
    selectMock.mockImplementation(() => ({
      gt: gtMock,
      then: (resolve: (value: any) => any) => resolve({ data: [], error: null }),
    }));
  });

  it('envia pedidos pendentes na reconexão e limpa fila local', async () => {
    await LocalDB.save('pedidos', {
      id: 'pedido-local-1',
      cliente_nome: 'Cliente Offline',
      total: 150,
      _synced: false,
    });

    const result = await SyncService.upload({ tables: ['pedidos'] });
    const remaining = await LocalDB.getAll('pedidos');

    expect(result.success).toBe(1);
    expect(result.failed).toBe(0);
    expect(remaining).toHaveLength(0);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(
      'pedidos',
      expect.objectContaining({
        id: 'pedido-local-1',
        cliente_nome: 'Cliente Offline',
        total: 150,
      })
    );
  });

  it('faz download incremental e salva novos pedidos como sincronizados', async () => {
    await LocalDB.save('sync_meta', {
      table: 'pedidos',
      last_download_at: '2026-03-01T10:00:00.000Z',
      last_upload_at: null,
    });

    gtMock.mockResolvedValue({
      data: [
        {
          id: 'pedido-remoto-1',
          cliente_nome: 'Cliente Remoto',
          updated_at: '2026-03-02T10:00:00.000Z',
        },
      ],
      error: null,
    });

    const downloaded = await SyncService.downloadTable('pedidos');
    const localOrders = await LocalDB.getAll('pedidos');
    const meta = await SyncService.getSyncMetadata('pedidos');

    expect(downloaded).toBe(1);
    expect(gtMock).toHaveBeenCalledWith('updated_at', '2026-03-01T10:00:00.000Z');
    expect(localOrders).toHaveLength(1);
    expect(localOrders[0].payload.id).toBe('pedido-remoto-1');
    expect(localOrders[0].payload._synced).toBe(true);
    expect(meta.last_download_at).not.toBeNull();
  });

  it('não trava indefinidamente quando o download fica pendurado', async () => {
    const hangingThenable = {
      then: () => {
        // Promise intentionally left pending
      },
    };

    selectMock.mockImplementation(() => ({
      gt: () => hangingThenable,
      then: () => {
        // Promise intentionally left pending
      },
    }));

    const result = await SyncService.download({
      tables: ['pedidos'],
      downloadTimeoutMs: 20,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].table).toBe('pedidos');
    expect(result.errors[0].error.message).toContain('Timeout');
  });

  it('faz fallback para created_at quando updated_at não existe', async () => {
    await LocalDB.save('sync_meta', {
      table: 'pedidos',
      last_download_at: '2026-03-01T10:00:00.000Z',
      last_upload_at: null,
    });

    gtMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "column pedidos.updated_at does not exist",
          code: '42703',
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'pedido-created-at-1',
            cliente_nome: 'Cliente CreatedAt',
            created_at: '2026-03-02T10:00:00.000Z',
          },
        ],
        error: null,
      });

    const downloaded = await SyncService.downloadTable('pedidos');
    const localOrders = await LocalDB.getAll('pedidos');

    expect(downloaded).toBe(1);
    expect(gtMock).toHaveBeenCalledWith('updated_at', '2026-03-01T10:00:00.000Z');
    expect(gtMock).toHaveBeenCalledWith('created_at', '2026-03-01T10:00:00.000Z');
    expect(localOrders).toHaveLength(1);
    expect(localOrders[0].payload.id).toBe('pedido-created-at-1');
  });
});
