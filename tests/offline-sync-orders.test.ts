import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsertMock: any = vi.fn(async () => ({ error: null }));
const gtMock: any = vi.fn(async () => ({ data: [], error: null }));
const selectMock: any = vi.fn(() => ({
  gt: gtMock,
  then: (resolve: (value: any) => any) => resolve({ data: [], error: null }),
}));

vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      from: (table: string) => ({
        upsert: (payload: any) => upsertMock(table, payload),
        select: () => selectMock(),
      }),
    },
  };
});

import SQLiteStore from '../lib/SQLiteStore';
import SyncService from '../lib/SyncService';

describe('Offline order queue and reconnection sync', () => {
  beforeEach(async () => {
    await SQLiteStore.clearAll();
    vi.clearAllMocks();

    upsertMock.mockResolvedValue({ error: null });
    gtMock.mockResolvedValue({ data: [], error: null });
    selectMock.mockImplementation(() => ({
      gt: gtMock,
      then: (resolve: (value: any) => any) => resolve({ data: [], error: null }),
    }));
  });

  it('envia pedidos pendentes na reconexão e mantém pedido local marcado como sincronizado', async () => {
    await SQLiteStore.save('pedidos', {
      id: 'pedido-local-1',
      cliente_nome: 'Cliente Offline',
      total: 150,
      _synced: false,
    });

    const result = await SyncService.upload({ tables: ['pedidos'] });
    const remaining = await SQLiteStore.getAll('pedidos');

    expect(result.success).toBe(1);
    expect(result.failed).toBe(0);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].payload._synced).toBe(true);

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

  it('não envia tabelas de referência no upload e preserva cache de clientes', async () => {
    await SQLiteStore.save('clients', {
      id: 'cli-1',
      nome: 'Cliente Referência',
      _synced: false,
    });

    await SQLiteStore.save('pedidos', {
      id: 'pedido-local-2',
      cliente_nome: 'Cliente Referência',
      total: 200,
      _synced: false,
    });

    const result = await SyncService.upload();
    const clients = await SQLiteStore.getAll('clients');

    expect(result.success).toBe(1);
    expect(result.failed).toBe(0);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(
      'pedidos',
      expect.objectContaining({
        id: 'pedido-local-2',
      })
    );
    expect(clients).toHaveLength(1);
    expect(clients[0].payload.id).toBe('cli-1');
  });

  it('faz download incremental e salva novos pedidos como sincronizados', async () => {
    await SQLiteStore.save('sync_meta', {
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
    const localOrders = await SQLiteStore.getAll('pedidos');
    const meta = await SyncService.getSyncMetadata('pedidos');

    expect(downloaded).toBe(1);
    expect(gtMock).toHaveBeenCalledWith('updated_at', '2026-03-01T10:00:00.000Z');
    expect(localOrders).toHaveLength(1);
    expect(localOrders[0].payload.id).toBe('pedido-remoto-1');
    expect(localOrders[0].payload._synced).toBe(true);
    expect(meta.last_download_at).not.toBeNull();
  });

  it('não trava indefinidamente quando o download fica pendurado', async () => {
    const hangingThenable: any = {
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
    await SQLiteStore.save('sync_meta', {
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
    const localOrders = await SQLiteStore.getAll('pedidos');

    expect(downloaded).toBe(1);
    expect(gtMock).toHaveBeenCalledWith('updated_at', '2026-03-01T10:00:00.000Z');
    expect(gtMock).toHaveBeenCalledWith('created_at', '2026-03-01T10:00:00.000Z');
    expect(localOrders).toHaveLength(1);
    expect(localOrders[0].payload.id).toBe('pedido-created-at-1');
  });
});
