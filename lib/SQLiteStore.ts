import { nanoid } from 'nanoid/non-secure';

type SQLiteLikeBackend = {
	init: () => Promise<void>;
	upsertMany: (tableName: string, records: any[]) => Promise<number>;
	getAll: <T = any>(tableName: string) => Promise<T[]>;
	replaceTable: (tableName: string, records: any[]) => Promise<number>;
	clearTable: (tableName: string) => Promise<void>;
	getAllTables: () => Promise<string[]>;
	getInfo: () => Promise<any>;
};

interface LocalRecord {
	_id: string;
	_rev?: string;
	table: string;
	payload: any;
	createdAt: string;
	updatedAt: string;
}

export class SQLiteStore {
	private static TABLE_PREFIX = 'ldb:';
	private static backend: SQLiteLikeBackend | null = null;
	private static memoryStore: Record<string, Record<string, any>> = {};

	private static async getBackend(): Promise<SQLiteLikeBackend> {
		if (this.backend) return this.backend;

		const isVitest = typeof process !== 'undefined' && !!process.env.VITEST;

		if (isVitest) {
			this.backend = {
				init: async () => undefined,
				upsertMany: async (tableName, records) => {
					const table = this.memoryStore[tableName] || {};
					for (const record of records || []) {
						const key = String(record?._id || record?.id || `${Date.now()}-${Math.random()}`);
						table[key] = record;
					}
					this.memoryStore[tableName] = table;
					return (records || []).length;
				},
				getAll: async <T = any>(tableName: string) => {
					const table = this.memoryStore[tableName] || {};
					return Object.values(table) as T[];
				},
				replaceTable: async (tableName, records) => {
					this.memoryStore[tableName] = {};
					const table = this.memoryStore[tableName];
					for (const record of records || []) {
						const key = String(record?._id || record?.id || `${Date.now()}-${Math.random()}`);
						table[key] = record;
					}
					return (records || []).length;
				},
				clearTable: async (tableName) => {
					delete this.memoryStore[tableName];
				},
				getAllTables: async () => Object.keys(this.memoryStore),
				getInfo: async () => {
					const tables = Object.keys(this.memoryStore);
					let docCount = 0;
					for (const table of tables) {
						docCount += Object.keys(this.memoryStore[table] || {}).length;
					}
					return { db_name: 'localdb_memory_test', tables, doc_count: docCount };
				},
			};
			return this.backend;
		}

		const mod = await import('./OfflineSQLiteService');
		this.backend = mod.default as unknown as SQLiteLikeBackend;
		await this.backend.init();
		return this.backend;
	}

	private static tableKey(table: string): string {
		return `${this.TABLE_PREFIX}${table}`;
	}

	private static fromTableKey(tableKey: string): string {
		return tableKey.startsWith(this.TABLE_PREFIX)
			? tableKey.slice(this.TABLE_PREFIX.length)
			: tableKey;
	}

	private static generateId(): string {
		return nanoid();
	}

	static async save(table: string, record: any): Promise<LocalRecord> {
		const backend = await this.getBackend();
		const id = record._id || this.generateId();
		const timestamp = new Date().toISOString();

		const existingDoc = await this.getById(table, id).catch(() => null);

		const doc: LocalRecord = {
			_id: id,
			_rev: existingDoc?._rev ? `${Number(String(existingDoc._rev).split('-')[0] || '0') + 1}-sqlite` : '1-sqlite',
			table,
			payload: record,
			createdAt: existingDoc?.createdAt || timestamp,
			updatedAt: timestamp,
		};

		await backend.upsertMany(this.tableKey(table), [doc]);
		return doc;
	}

	static async getAll(table: string): Promise<LocalRecord[]> {
		try {
			const backend = await this.getBackend();
			const rows = await backend.getAll<LocalRecord>(this.tableKey(table));
			return rows.filter((row) => row && row.table === table);
		} catch (error) {
			console.error(`Error getting all records from ${table}:`, error);
			return [];
		}
	}

	static async getById(table: string, id: string): Promise<LocalRecord | null> {
		try {
			const rows = await this.getAll(table);
			const doc = rows.find((row) => row._id === id);
			return doc || null;
		} catch {
			return null;
		}
	}

	static async remove(table: string, id: string): Promise<boolean> {
		try {
			const records = await this.getAll(table);
			const remaining = records.filter((r) => r._id !== id);
			const backend = await this.getBackend();
			await backend.replaceTable(this.tableKey(table), remaining);
			return records.length !== remaining.length;
		} catch (error) {
			console.error(`Error removing record ${id} from ${table}:`, error);
			return false;
		}
	}

	static async clear(table: string): Promise<number> {
		try {
			const records = await this.getAll(table);
			const backend = await this.getBackend();
			await backend.clearTable(this.tableKey(table));
			return records.length;
		} catch (error) {
			console.error(`Error clearing table ${table}:`, error);
			return 0;
		}
	}

	static async count(table: string): Promise<number> {
		const records = await this.getAll(table);
		return records.length;
	}

	static async search(
		table: string,
		searchFn: (record: any) => boolean
	): Promise<LocalRecord[]> {
		const allRecords = await this.getAll(table);
		return allRecords.filter((record) => searchFn(record.payload));
	}

	static async find(table: string, selector: any): Promise<LocalRecord[]> {
		try {
			const records = await this.getAll(table);

			const matchesSelector = (payload: any) => {
				return Object.entries(selector || {}).every(([key, value]) => {
					if (value && typeof value === 'object' && '$eq' in (value as any)) {
						return payload?.[key] === (value as any).$eq;
					}
					return payload?.[key] === value;
				});
			};

			return records.filter((record) => matchesSelector(record.payload));
		} catch (error) {
			console.error(`Error finding records in ${table}:`, error);
			return [];
		}
	}

	static async getAllTables(): Promise<string[]> {
		try {
			const backend = await this.getBackend();
			const tableKeys = await backend.getAllTables();
			return tableKeys
				.filter((key) => key.startsWith(this.TABLE_PREFIX))
				.map((key) => this.fromTableKey(key));
		} catch (error) {
			console.error('Error getting all tables:', error);
			return [];
		}
	}

	static async createIndexes(fields: string[]): Promise<void> {
		console.log(`✅ SQLite backend active (requested indexes: [${fields.join(', ')}])`);
	}

	static async clearAll(): Promise<void> {
		try {
			const tables = await this.getAllTables();
			const backend = await this.getBackend();
			for (const table of tables) {
				await backend.clearTable(this.tableKey(table));
			}
			console.log('Local database cleared completely');
			await this.init();
		} catch (error) {
			console.error('Error clearing database:', error);
		}
	}

	static async init() {
		const backend = await this.getBackend();
		await backend.init();
		await this.createIndexes(['table']);
		await this.createIndexes(['table', 'updatedAt']);
	}

	static async delete(id: string): Promise<boolean> {
		try {
			const tables = await this.getAllTables();
			for (const table of tables) {
				const removed = await this.remove(table, id);
				if (removed) return true;
			}
			return false;
		} catch {
			return false;
		}
	}

	static async bulkDelete(docs: any[]): Promise<boolean> {
		try {
			if (!docs || docs.length === 0) return true;

			const grouped = new Map<string, Set<string>>();
			for (const doc of docs) {
				const table = doc?.table;
				const id = doc?._id;
				if (!table || !id) continue;
				if (!grouped.has(table)) grouped.set(table, new Set());
				grouped.get(table)!.add(id);
			}

			for (const [table, ids] of grouped.entries()) {
				const records = await this.getAll(table);
				const remaining = records.filter((r) => !ids.has(r._id));
				const backend = await this.getBackend();
				await backend.replaceTable(this.tableKey(table), remaining);
			}

			return true;
		} catch (error) {
			console.error('Error bulk deleting:', error);
			return false;
		}
	}

	static async bulkSave(records: any[]): Promise<number> {
		try {
			const timestamp = new Date().toISOString();
			const docsToSaveByTable = new Map<string, LocalRecord[]>();

			for (const record of records) {
				const isLocalRecord =
					record &&
					typeof record === 'object' &&
					'table' in record &&
					'payload' in record;

				const table = record?.table;
				if (!table) continue;

				const doc: LocalRecord = isLocalRecord
					? {
							...record,
							_id: record._id || this.generateId(),
							_rev: record._rev || '1-sqlite',
							createdAt: record.createdAt || timestamp,
							updatedAt: timestamp,
						}
					: {
							_id: record?._id || this.generateId(),
							_rev: '1-sqlite',
							table,
							payload: record,
							createdAt: timestamp,
							updatedAt: timestamp,
						};

				if (!docsToSaveByTable.has(table)) {
					docsToSaveByTable.set(table, []);
				}
				docsToSaveByTable.get(table)!.push(doc);
			}

			let successCount = 0;
			for (const [table, docs] of docsToSaveByTable.entries()) {
				const existing = await this.getAll(table);
				const merged = new Map<string, LocalRecord>();
				for (const doc of existing) merged.set(doc._id, doc);
				for (const doc of docs) merged.set(doc._id, doc);

				const finalDocs = Array.from(merged.values());
				const backend = await this.getBackend();
				await backend.replaceTable(this.tableKey(table), finalDocs);
				successCount += docs.length;
			}

			return successCount;
		} catch (error) {
			console.error('Error bulk saving:', error);
			return 0;
		}
	}

	static async getInfo(): Promise<any> {
		try {
			const backend = await this.getBackend();
			const info = await backend.getInfo();
			const tables = await this.getAllTables();
			return {
				...info,
				tables,
			};
		} catch (error) {
			console.error('Error getting database info:', error);
			return null;
		}
	}
}

export default SQLiteStore;
