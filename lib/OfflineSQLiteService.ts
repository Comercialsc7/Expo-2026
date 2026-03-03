import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';

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
        created_at TEXT NOT NULL,
        synced_at TEXT
      );
    `);

    this.initialized = true;
  }

  private static inferRecordKey(record: any): string {
    if (!record || typeof record !== 'object') {
      return `${Date.now()}-${Math.random()}`;
    }

    const preferredKeys = ['id', 'code', 'user_id', 'pedido_id', 'codcli'];
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
}

export default OfflineSQLiteService;
