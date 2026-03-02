import LocalDB from './LocalDB';

class OfflineSQLiteService {
  private static initialized = false;

  static async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }

  private static inferRecordKey(record: any): string {
    if (!record || typeof record !== 'object') {
      return `${Date.now()}-${Math.random()}`;
    }

    const preferredKeys = ['id', 'code', 'user_id', 'pedido_id'];
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

    if (!records || records.length === 0) {
      return 0;
    }

    const existing = await LocalDB.getAll(tableName);
    const merged = new Map<string, any>();

    for (const row of existing) {
      merged.set(this.inferRecordKey(row.payload), row.payload);
    }

    for (const record of records) {
      merged.set(this.inferRecordKey(record), record);
    }

    await LocalDB.clear(tableName);

    const recordsToSave = Array.from(merged.values()).map((payload) => ({
      table: tableName,
      payload,
    }));

    return LocalDB.bulkSave(recordsToSave);
  }

  static async replaceTable(tableName: string, records: any[]): Promise<number> {
    await this.init();
    await LocalDB.clear(tableName);

    if (!records || records.length === 0) {
      return 0;
    }

    const recordsToSave = records.map((payload) => ({
      table: tableName,
      payload,
    }));

    return LocalDB.bulkSave(recordsToSave);
  }

  static async getAll<T = any>(tableName: string): Promise<T[]> {
    await this.init();
    const rows = await LocalDB.getAll(tableName);
    return rows.map((row) => row.payload as T);
  }

  static async clearTable(tableName: string): Promise<void> {
    await this.init();
    await LocalDB.clear(tableName);
  }
}

export default OfflineSQLiteService;
