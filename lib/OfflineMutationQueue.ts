import { supabase } from './supabase';
import SQLiteStore from './SQLiteStore';

export type PendingOpType = 'insert' | 'upsert' | 'update' | 'delete';

export interface PendingOpRecord {
  id: number;
  table_name: string;
  op_type: PendingOpType;
  payload: string;
  op_key: string | null;
  retry_count: number;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
  synced_at: string | null;
}

export interface OfflineMutationPayload {
  data?: any;
  values?: Record<string, any>;
  filters?: Record<string, any>;
  [key: string]: any;
}

export interface QueueProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ id: number; table: string; error: string }>;
}

class OfflineMutationQueue {
  private static TABLE = 'pending_ops_queue';

  static async enqueue(
    tableName: string,
    opType: PendingOpType,
    payload: OfflineMutationPayload,
    opKey?: string
  ): Promise<number> {
    const now = new Date().toISOString();
    const all = await SQLiteStore.getAll(this.TABLE);

    if (opKey) {
      const existing = all.find((r) => r.payload?.op_key === opKey && !r.payload?.synced_at);
      if (existing) {
        const updated: PendingOpRecord = {
          ...existing.payload,
          table_name: tableName,
          op_type: opType,
          payload: JSON.stringify(payload),
          retry_count: 0,
          last_error: null,
          next_retry_at: null,
          created_at: now,
          synced_at: null,
        };
        await SQLiteStore.save(this.TABLE, { ...updated, _id: existing._id });
        return updated.id;
      }
    }

    const nextId = all.length > 0
      ? Math.max(...all.map((r) => Number(r.payload?.id || 0))) + 1
      : 1;

    const row: PendingOpRecord = {
      id: nextId,
      table_name: tableName,
      op_type: opType,
      payload: JSON.stringify(payload),
      op_key: opKey || null,
      retry_count: 0,
      last_error: null,
      next_retry_at: null,
      created_at: now,
      synced_at: null,
    };

    await SQLiteStore.save(this.TABLE, {
      _id: `${this.TABLE}:${nextId}`,
      ...row,
    });
    return nextId;
  }

  static async process(
    executor: (op: PendingOpRecord) => Promise<void>,
    limit: number = 100
  ): Promise<QueueProcessResult> {
    const now = new Date().toISOString();
    const pending = (await SQLiteStore.getAll(this.TABLE))
      .map((row) => row.payload as PendingOpRecord)
      .filter((row) => !row.synced_at && (!row.next_retry_at || row.next_retry_at <= now))
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .slice(0, limit);
    const result: QueueProcessResult = {
      processed: pending.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (const op of pending) {
      try {
        await executor(op);
        await this.markSynced(op.id);
        result.succeeded++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.markRetry(op.id, message);
        result.failed++;
        result.errors.push({
          id: op.id,
          table: op.table_name,
          error: message,
        });
      }
    }

    return result;
  }

  static async flushWithSupabase(limit: number = 100): Promise<QueueProcessResult> {
    return this.process(async (op) => {
      const payload = JSON.parse(op.payload || '{}');
      let query: any = supabase.from(op.table_name);
      let response: { error: any };

      if (op.op_type === 'insert') {
        response = await query.insert(payload.data ?? payload);
      } else if (op.op_type === 'upsert') {
        response = await query.upsert(payload.data ?? payload);
      } else if (op.op_type === 'update') {
        query = query.update(payload.values ?? payload.data ?? {});
        const filters = payload.filters || {};
        for (const [column, value] of Object.entries(filters)) {
          query = query.eq(column, value);
        }
        response = await query;
      } else {
        query = query.delete();
        const filters = payload.filters || {};
        for (const [column, value] of Object.entries(filters)) {
          query = query.eq(column, value);
        }
        response = await query;
      }

      if (response.error) {
        throw response.error;
      }
    }, limit);
  }

  static async getStats(): Promise<{ pending: number; failed: number }> {
    const rows = (await SQLiteStore.getAll(this.TABLE)).map((r) => r.payload as PendingOpRecord);
    return {
      pending: rows.filter((r) => !r.synced_at).length,
      failed: rows.filter((r) => !r.synced_at && (r.retry_count || 0) > 0).length,
    };
  }

  private static async markSynced(id: number): Promise<void> {
    const all = await SQLiteStore.getAll(this.TABLE);
    const row = all.find((r) => Number(r.payload?.id) === id);
    if (!row) return;

    await SQLiteStore.save(this.TABLE, {
      ...row.payload,
      _id: row._id,
      synced_at: new Date().toISOString(),
      last_error: null,
      next_retry_at: null,
    });
  }

  private static async markRetry(id: number, message: string): Promise<void> {
    const all = await SQLiteStore.getAll(this.TABLE);
    const row = all.find((r) => Number(r.payload?.id) === id);
    if (!row) return;

    const nextRetryCount = (row.payload.retry_count || 0) + 1;
    const backoffMs = Math.min(300000, 5000 * Math.pow(2, Math.max(0, nextRetryCount - 1)));

    await SQLiteStore.save(this.TABLE, {
      ...row.payload,
      _id: row._id,
      retry_count: nextRetryCount,
      last_error: message.slice(0, 500),
      next_retry_at: new Date(Date.now() + backoffMs).toISOString(),
    });
  }
}

export default OfflineMutationQueue;

