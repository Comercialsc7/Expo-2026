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

type TableStore = Record<string, Record<string, any>>;

class OfflineSQLiteService {
  private static initialized = false;
  private static STORE_KEY = '__offline_sqlite_web_store__';
  private static PENDING_OPS_SEQ_KEY = '__offline_sqlite_web_pending_ops_seq__';
  private static pendingOpsAutoId = 1;
  private static pendingOpsSeqInitialized = false;

  private static ensureWebStorage(): Storage | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  }

  private static loadStore(): TableStore {
    const storage = this.ensureWebStorage();
    if (!storage) return {};

    try {
      const raw = storage.getItem(this.STORE_KEY);
      return raw ? (JSON.parse(raw) as TableStore) : {};
    } catch {
      return {};
    }
  }

  private static saveStore(store: TableStore): void {
    const storage = this.ensureWebStorage();
    if (!storage) return;

    try {
      storage.setItem(this.STORE_KEY, JSON.stringify(store));
    } catch {
      // ignore write errors
    }
  }

  private static readPendingOpsSeq(): number {
    const storage = this.ensureWebStorage();
    if (!storage) return 0;

    try {
      const raw = storage.getItem(this.PENDING_OPS_SEQ_KEY);
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private static writePendingOpsSeq(nextId: number): void {
    const storage = this.ensureWebStorage();
    if (!storage) return;

    try {
      storage.setItem(this.PENDING_OPS_SEQ_KEY, String(nextId));
    } catch {
      // ignore write errors
    }
  }

  private static clearPendingOpsSeq(): void {
    const storage = this.ensureWebStorage();
    if (!storage) return;

    try {
      storage.removeItem(this.PENDING_OPS_SEQ_KEY);
    } catch {
      // ignore write errors
    }
  }

  private static ensurePendingOpsSeqInitialized(store: TableStore): void {
    if (this.pendingOpsSeqInitialized) {
      return;
    }

    const pendingOps = Object.values(store.pending_ops_sqlite || {}) as PendingOpRecord[];
    const maxExistingId = pendingOps.reduce((max, row) => {
      const id = Number(row?.id || 0);
      return Number.isFinite(id) ? Math.max(max, id) : max;
    }, 0);

    const persistedSeq = this.readPendingOpsSeq();
    const nextId = Math.max(maxExistingId, persistedSeq, 0) + 1;

    this.pendingOpsAutoId = nextId;
    this.pendingOpsSeqInitialized = true;
    this.writePendingOpsSeq(this.pendingOpsAutoId);
  }

  private static reserveNextPendingOpId(store: TableStore): number {
    this.ensurePendingOpsSeqInitialized(store);
    const pendingOps = store.pending_ops_sqlite || {};

    let id = this.pendingOpsAutoId;
    while (pendingOps[String(id)]) {
      id += 1;
    }

    this.pendingOpsAutoId = id + 1;
    this.writePendingOpsSeq(this.pendingOpsAutoId);
    return id;
  }

  static async init(): Promise<void> {
    if (this.initialized) return;
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
    if (!records || records.length === 0) return 0;

    const store = this.loadStore();
    const table = store[tableName] || {};

    for (const record of records) {
      const key = this.inferRecordKey(record);
      table[key] = record;
    }

    store[tableName] = table;
    this.saveStore(store);
    return records.length;
  }

  static async replaceTable(tableName: string, records: any[]): Promise<number> {
    await this.init();

    const store = this.loadStore();
    store[tableName] = {};
    this.saveStore(store);

    return this.upsertMany(tableName, records || []);
  }

  static async getAll<T = any>(tableName: string): Promise<T[]> {
    await this.init();
    const store = this.loadStore();
    const table = store[tableName] || {};
    return Object.values(table) as T[];
  }

  static async getAllWhere<T = any>(
    tableName: string,
    filters: Record<string, string | number>
  ): Promise<T[]> {
    await this.init();

    const allRows = await this.getAll<T>(tableName);
    const entries = Object.entries(filters || {});
    if (entries.length === 0) {
      return allRows;
    }

    return allRows.filter((row: any) =>
      entries.every(([key, value]) => String(row?.[key]) === String(value))
    );
  }

  static async clearTable(tableName: string): Promise<void> {
    await this.init();
    const store = this.loadStore();
    delete store[tableName];
    this.saveStore(store);
  }

  static async enqueuePendingOp(
    tableName: string,
    opType: PendingOpType,
    payload: any,
    opKey?: string
  ): Promise<number> {
    await this.init();
    const now = new Date().toISOString();
    const all = await this.getPendingOps(10000);

    if (opKey) {
      const existing = all.find((r) => r.op_key === opKey && !r.synced_at);
      if (existing) {
        const updated: PendingOpRecord = {
          ...existing,
          table_name: tableName,
          op_type: opType,
          payload: JSON.stringify(payload),
          retry_count: 0,
          last_error: null,
          next_retry_at: null,
          created_at: now,
          synced_at: null,
        };

        const store = this.loadStore();
        store.pending_ops_sqlite = store.pending_ops_sqlite || {};
        store.pending_ops_sqlite[String(existing.id)] = updated;
        this.saveStore(store);
        return existing.id;
      }
    }

    const store = this.loadStore();
    store.pending_ops_sqlite = store.pending_ops_sqlite || {};

    const id = this.reserveNextPendingOpId(store);
    const row: PendingOpRecord = {
      id,
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

    store.pending_ops_sqlite[String(id)] = row;
    this.saveStore(store);

    return id;
  }

  static async getPendingOps(limit: number = 100): Promise<PendingOpRecord[]> {
    await this.init();
    const now = new Date().toISOString();
    const store = this.loadStore();
    const all = Object.values(store.pending_ops_sqlite || {}) as PendingOpRecord[];

    return all
      .filter((row) => !row.synced_at && (!row.next_retry_at || row.next_retry_at <= now))
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .slice(0, limit);
  }

  static async markPendingOpSynced(id: number): Promise<void> {
    await this.init();
    const store = this.loadStore();
    const row = (store.pending_ops_sqlite || {})[String(id)] as PendingOpRecord | undefined;
    if (!row) return;

    row.synced_at = new Date().toISOString();
    row.last_error = null;
    row.next_retry_at = null;
    store.pending_ops_sqlite[String(id)] = row;
    this.saveStore(store);
  }

  static async markPendingOpRetry(id: number, errorMessage: string): Promise<void> {
    await this.init();
    const store = this.loadStore();
    const row = (store.pending_ops_sqlite || {})[String(id)] as PendingOpRecord | undefined;
    if (!row) return;

    const nextRetryCount = (row.retry_count || 0) + 1;
    const backoffMs = Math.min(300000, 5000 * Math.pow(2, Math.max(0, nextRetryCount - 1)));

    row.retry_count = nextRetryCount;
    row.last_error = errorMessage.slice(0, 500);
    row.next_retry_at = new Date(Date.now() + backoffMs).toISOString();
    store.pending_ops_sqlite[String(id)] = row;
    this.saveStore(store);
  }

  static async getPendingOpsStats(): Promise<{ pending: number; failed: number }> {
    await this.init();
    const store = this.loadStore();
    const rows = Object.values(store.pending_ops_sqlite || {}) as PendingOpRecord[];

    return {
      pending: rows.filter((r) => !r.synced_at).length,
      failed: rows.filter((r) => !r.synced_at && (r.retry_count || 0) > 0).length,
    };
  }

  static async getAllTables(): Promise<string[]> {
    await this.init();
    const store = this.loadStore();
    return Object.keys(store).filter((k) => k !== 'pending_ops_sqlite');
  }

  static async clearAll(): Promise<void> {
    await this.init();
    this.saveStore({});
    this.clearPendingOpsSeq();
    this.pendingOpsAutoId = 1;
    this.pendingOpsSeqInitialized = false;
  }

  static async getInfo(): Promise<any> {
    await this.init();
    const store = this.loadStore();
    const tables = Object.keys(store).filter((k) => k !== 'pending_ops_sqlite');

    let docCount = 0;
    for (const table of tables) {
      docCount += Object.keys(store[table] || {}).length;
    }

    return {
      db_name: 'offline_web_localstorage',
      tables,
      doc_count: docCount,
    };
  }
}

export default OfflineSQLiteService;
