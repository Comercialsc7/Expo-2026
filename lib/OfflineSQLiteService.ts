import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';

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

class OfflineSQLiteService {
  private static db: SQLiteDatabase | null = null;
  private static initialized = false;

  private static async getDb(): Promise<SQLiteDatabase> {
    if (!this.db) {
      this.db = await openDatabaseAsync('expo2026_offline.sqlite');
    }
    return this.db;
  }

  static async init(): Promise<void> {
    if (this.initialized) return;

    const db = await this.getDb();

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_records (
        table_name TEXT NOT NULL,
        record_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (table_name, record_key)
      );
      CREATE INDEX IF NOT EXISTS idx_offline_records_table ON offline_records(table_name);
      CREATE INDEX IF NOT EXISTS idx_offline_records_updated ON offline_records(updated_at);
      CREATE TABLE IF NOT EXISTS sync_meta_sqlite (
        table_name TEXT PRIMARY KEY,
        last_download_at TEXT,
        last_upload_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pending_ops_sqlite (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        op_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        op_key TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        next_retry_at TEXT,
        created_at TEXT NOT NULL,
        synced_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_ops_op_key ON pending_ops_sqlite(op_key);
      CREATE INDEX IF NOT EXISTS idx_pending_ops_pending ON pending_ops_sqlite(synced_at, next_retry_at, created_at);
    `);

    // Migração incremental para instalações antigas.
    const safeAlter = async (sql: string) => {
      try {
        await db.execAsync(sql);
      } catch {
        // Coluna já existente ou alteração não necessária.
      }
    };
    await safeAlter(`ALTER TABLE pending_ops_sqlite ADD COLUMN op_key TEXT;`);
    await safeAlter(`ALTER TABLE pending_ops_sqlite ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;`);
    await safeAlter(`ALTER TABLE pending_ops_sqlite ADD COLUMN last_error TEXT;`);
    await safeAlter(`ALTER TABLE pending_ops_sqlite ADD COLUMN next_retry_at TEXT;`);

    this.initialized = true;
  }

  private static inferRecordKey(record: any): string {
    if (!record || typeof record !== 'object') {
      return `${Date.now()}-${Math.random()}`;
    }

    const preferredKeys = ['_id', 'id', 'code', 'user_id', 'pedido_id'];
    for (const key of preferredKeys) {
      if (record[key] !== undefined && record[key] !== null && String(record[key]) !== '') {
        return String(record[key]);
      }
    }

    if (record.codcli !== undefined && record.diamax !== undefined) {
      return `${String(record.codcli)}:${String(record.diamax)}`;
    }

    return `${Date.now()}-${Math.random()}`;
  }

  static async upsertMany(tableName: string, records: any[]): Promise<number> {
    await this.init();
    const db = await this.getDb();

    if (!records || records.length === 0) {
      return 0;
    }

    const now = new Date().toISOString();
    let success = 0;

    for (const record of records) {
      const recordKey = this.inferRecordKey(record);
      await db.runAsync(
        `INSERT OR REPLACE INTO offline_records (table_name, record_key, payload, updated_at)
         VALUES (?, ?, ?, ?);`,
        tableName,
        recordKey,
        JSON.stringify(record),
        now
      );
      success++;
    }

    return success;
  }

  static async replaceTable(tableName: string, records: any[]): Promise<number> {
    await this.init();
    const db = await this.getDb();

    await db.runAsync(`DELETE FROM offline_records WHERE table_name = ?;`, tableName);
    return this.upsertMany(tableName, records || []);
  }

  static async getAll<T = any>(tableName: string): Promise<T[]> {
    await this.init();
    const db = await this.getDb();

    const rows = await db.getAllAsync<{ payload: string }>(
      `SELECT payload FROM offline_records WHERE table_name = ? ORDER BY updated_at DESC;`,
      tableName
    );

    return rows
      .map((row) => {
        try {
          return JSON.parse(row.payload) as T;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as T[];
  }

  static async clearTable(tableName: string): Promise<void> {
    await this.init();
    const db = await this.getDb();
    await db.runAsync(`DELETE FROM offline_records WHERE table_name = ?;`, tableName);
  }

  static async enqueuePendingOp(
    tableName: string,
    opType: PendingOpType,
    payload: any,
    opKey?: string
  ): Promise<number> {
    await this.init();
    const db = await this.getDb();
    const now = new Date().toISOString();
    const key = opKey ?? null;

    // Usa op_key para idempotencia: a mesma operacao substitui a anterior pendente.
    if (key) {
      const existing = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM pending_ops_sqlite WHERE op_key = ? AND synced_at IS NULL LIMIT 1;`,
        key
      );

      if (existing?.id) {
        await db.runAsync(
          `UPDATE pending_ops_sqlite
           SET table_name = ?, op_type = ?, payload = ?, retry_count = 0, last_error = NULL, next_retry_at = NULL, created_at = ?
           WHERE id = ?;`,
          tableName,
          opType,
          JSON.stringify(payload),
          now,
          existing.id
        );
        return existing.id;
      }
    }

    const result = await db.runAsync(
      `INSERT INTO pending_ops_sqlite (table_name, op_type, payload, op_key, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      tableName,
      opType,
      JSON.stringify(payload),
      key,
      now
    );

    return result.lastInsertRowId;
  }

  static async getPendingOps(limit: number = 100): Promise<PendingOpRecord[]> {
    await this.init();
    const db = await this.getDb();
    const now = new Date().toISOString();

    return db.getAllAsync<PendingOpRecord>(
      `SELECT id, table_name, op_type, payload, op_key, retry_count, last_error, next_retry_at, created_at, synced_at
       FROM pending_ops_sqlite
       WHERE synced_at IS NULL
         AND (next_retry_at IS NULL OR next_retry_at <= ?)
       ORDER BY created_at ASC
       LIMIT ?;`,
      now,
      limit
    );
  }

  static async markPendingOpSynced(id: number): Promise<void> {
    await this.init();
    const db = await this.getDb();
    await db.runAsync(
      `UPDATE pending_ops_sqlite
       SET synced_at = ?, last_error = NULL, next_retry_at = NULL
       WHERE id = ?;`,
      new Date().toISOString(),
      id
    );
  }

  static async markPendingOpRetry(id: number, errorMessage: string): Promise<void> {
    await this.init();
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ retry_count: number }>(
      `SELECT retry_count FROM pending_ops_sqlite WHERE id = ?;`,
      id
    );
    const nextRetryCount = (row?.retry_count || 0) + 1;
    const backoffMs = Math.min(300000, 5000 * Math.pow(2, Math.max(0, nextRetryCount - 1)));
    const nextRetryAt = new Date(Date.now() + backoffMs).toISOString();

    await db.runAsync(
      `UPDATE pending_ops_sqlite
       SET retry_count = ?, last_error = ?, next_retry_at = ?
       WHERE id = ?;`,
      nextRetryCount,
      errorMessage.slice(0, 500),
      nextRetryAt,
      id
    );
  }

  static async getPendingOpsStats(): Promise<{ pending: number; failed: number }> {
    await this.init();
    const db = await this.getDb();

    const pendingRow = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM pending_ops_sqlite WHERE synced_at IS NULL;`
    );
    const failedRow = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM pending_ops_sqlite WHERE synced_at IS NULL AND retry_count > 0;`
    );

    return {
      pending: pendingRow?.count || 0,
      failed: failedRow?.count || 0,
    };
  }

  static async getAllTables(): Promise<string[]> {
    await this.init();
    const db = await this.getDb();
    const rows = await db.getAllAsync<{ table_name: string }>(
      `SELECT DISTINCT table_name FROM offline_records ORDER BY table_name ASC;`
    );
    return rows.map((row) => row.table_name);
  }

  static async clearAll(): Promise<void> {
    await this.init();
    const db = await this.getDb();
    await db.execAsync(`
      DELETE FROM offline_records;
      DELETE FROM sync_meta_sqlite;
      DELETE FROM pending_ops_sqlite;
    `);
  }

  static async getInfo(): Promise<any> {
    await this.init();
    const db = await this.getDb();

    const tables = await this.getAllTables();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM offline_records;`
    );

    return {
      db_name: 'expo2026_offline.sqlite',
      doc_count: row?.count || 0,
      tables,
    };
  }
}

export default OfflineSQLiteService;
