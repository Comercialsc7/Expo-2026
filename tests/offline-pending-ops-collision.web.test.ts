import { beforeEach, describe, expect, it } from 'vitest';

import OfflineSQLiteServiceWeb from '../lib/OfflineSQLiteService.web';

class MockStorage {
  private data: Record<string, string> = {};

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null;
  }

  setItem(key: string, value: string): void {
    this.data[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.data[key];
  }

  clear(): void {
    this.data = {};
  }
}

const STORE_KEY = '__offline_sqlite_web_store__';
const PENDING_OPS_SEQ_KEY = '__offline_sqlite_web_pending_ops_seq__';

const resetServiceState = () => {
  const service = OfflineSQLiteServiceWeb as any;
  service.initialized = false;
  service.pendingOpsAutoId = 1;
  service.pendingOpsSeqInitialized = false;
};

describe('Offline pending ops ID collision handling (web)', () => {
  beforeEach(async () => {
    const storage = new MockStorage();
    (globalThis as any).window = { localStorage: storage };

    resetServiceState();
    await OfflineSQLiteServiceWeb.clearAll();
    storage.clear();
    resetServiceState();
  });

  it('evita colisão após reload usando max id já salvo (vendedor 3272)', async () => {
    const storage = (globalThis as any).window.localStorage as MockStorage;
    const seededStore = {
      pending_ops_sqlite: {
        '1': {
          id: 1,
          table_name: 'pedidos',
          op_type: 'update',
          payload: JSON.stringify({ values: { total: 10 }, filters: { repre: '3272' } }),
          op_key: 'seed:3272:1',
          retry_count: 0,
          last_error: null,
          next_retry_at: null,
          created_at: '2026-06-09T09:00:00.000Z',
          synced_at: null,
        },
        '2': {
          id: 2,
          table_name: 'pedidos',
          op_type: 'update',
          payload: JSON.stringify({ values: { total: 20 }, filters: { repre: '3272' } }),
          op_key: 'seed:3272:2',
          retry_count: 0,
          last_error: null,
          next_retry_at: null,
          created_at: '2026-06-09T09:01:00.000Z',
          synced_at: null,
        },
      },
    };

    storage.setItem(STORE_KEY, JSON.stringify(seededStore));

    resetServiceState();

    const newId = await OfflineSQLiteServiceWeb.enqueuePendingOp(
      'pedidos',
      'update',
      { values: { status: 'novo' }, filters: { repre: '3272' } },
      'new:3272'
    );

    expect(newId).toBe(3);
  });

  it('ignora sequência persistida menor que ids existentes (vendedor 4000)', async () => {
    const storage = (globalThis as any).window.localStorage as MockStorage;
    const seededStore = {
      pending_ops_sqlite: {
        '8': {
          id: 8,
          table_name: 'pedidos',
          op_type: 'insert',
          payload: JSON.stringify({ data: { repre: '4000', total: 80 } }),
          op_key: 'seed:4000:8',
          retry_count: 0,
          last_error: null,
          next_retry_at: null,
          created_at: '2026-06-09T09:02:00.000Z',
          synced_at: null,
        },
      },
    };

    storage.setItem(STORE_KEY, JSON.stringify(seededStore));
    storage.setItem(PENDING_OPS_SEQ_KEY, '2');

    resetServiceState();

    const newId = await OfflineSQLiteServiceWeb.enqueuePendingOp(
      'pedidos',
      'insert',
      { data: { repre: '4000', total: 99 } },
      'new:4000'
    );

    expect(newId).toBe(9);
  });

  it('respeita sequência persistida maior que dados atuais (vendedor 3272)', async () => {
    const storage = (globalThis as any).window.localStorage as MockStorage;

    storage.setItem(STORE_KEY, JSON.stringify({ pending_ops_sqlite: {} }));
    storage.setItem(PENDING_OPS_SEQ_KEY, '50');

    resetServiceState();

    const newId = await OfflineSQLiteServiceWeb.enqueuePendingOp(
      'pedidos',
      'upsert',
      { data: { repre: '3272', total: 150 } },
      'upsert:3272'
    );

    expect(newId).toBe(51);
  });

  it('pula id ocupado quando contador aponta para colisão direta (vendedor 4000)', async () => {
    const storage = (globalThis as any).window.localStorage as MockStorage;
    const seededStore = {
      pending_ops_sqlite: {
        '5': {
          id: 5,
          table_name: 'pedidos',
          op_type: 'update',
          payload: JSON.stringify({ values: { desconto: 1 }, filters: { repre: '4000' } }),
          op_key: 'seed:4000:5',
          retry_count: 0,
          last_error: null,
          next_retry_at: null,
          created_at: '2026-06-09T09:03:00.000Z',
          synced_at: null,
        },
      },
    };

    storage.setItem(STORE_KEY, JSON.stringify(seededStore));

    const service = OfflineSQLiteServiceWeb as any;
    service.pendingOpsAutoId = 5;
    service.pendingOpsSeqInitialized = true;

    const newId = await OfflineSQLiteServiceWeb.enqueuePendingOp(
      'pedidos',
      'update',
      { values: { desconto: 2 }, filters: { repre: '4000' } },
      'new:4000:collision-skip'
    );

    expect(newId).toBe(6);
  });

  it('mantém id na deduplicação por op_key e segue sequência sem colisão para 3272 e 4000', async () => {
    const id3272 = await OfflineSQLiteServiceWeb.enqueuePendingOp(
      'pedidos',
      'update',
      { values: { total: 111 }, filters: { repre: '3272' } },
      'pedido:repre:3272'
    );

    const id3272Again = await OfflineSQLiteServiceWeb.enqueuePendingOp(
      'pedidos',
      'update',
      { values: { total: 222 }, filters: { repre: '3272' } },
      'pedido:repre:3272'
    );

    const id4000 = await OfflineSQLiteServiceWeb.enqueuePendingOp(
      'pedidos',
      'update',
      { values: { total: 333 }, filters: { repre: '4000' } },
      'pedido:repre:4000'
    );

    const pending = await OfflineSQLiteServiceWeb.getPendingOps(10);

    expect(id3272).toBe(1);
    expect(id3272Again).toBe(1);
    expect(id4000).toBe(2);
    expect(pending).toHaveLength(2);
    expect(pending.find((row) => row.id === 1)?.payload).toContain('222');
    expect(pending.find((row) => row.id === 2)?.payload).toContain('4000');
  });
});
