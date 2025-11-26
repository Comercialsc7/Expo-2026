import { nanoid } from 'nanoid/non-secure';
import db from './pouchdb';

interface LocalRecord {
  _id: string;
  _rev?: string;
  table: string;
  payload: any;
  createdAt: string;
  updatedAt: string;
}

export class LocalDB {
  private static generateId(): string {
    return nanoid();
  }

  static async save(table: string, record: any): Promise<LocalRecord> {
    const id = record._id || this.generateId();
    const timestamp = new Date().toISOString();

    const existingDoc = await this.getById(table, id).catch(() => null);

    const doc: LocalRecord = {
      _id: id,
      ...(existingDoc?._rev && { _rev: existingDoc._rev }),
      table,
      payload: record,
      createdAt: existingDoc?.createdAt || timestamp,
      updatedAt: timestamp,
    };

    const response = await db.put(doc);

    return {
      ...doc,
      _rev: response.rev,
    };
  }

  static async getAll(table: string): Promise<LocalRecord[]> {
    try {
      const result = await db.find({
        selector: {
          table: { $eq: table },
        },
      });

      return result.docs as LocalRecord[];
    } catch (error) {
      console.error(`Error getting all records from ${table}:`, error);
      return [];
    }
  }

  static async getById(table: string, id: string): Promise<LocalRecord | null> {
    try {
      const doc = await db.get<LocalRecord>(id);

      if (doc.table !== table) {
        return null;
      }

      return doc;
    } catch (error) {
      return null;
    }
  }

  static async remove(table: string, id: string): Promise<boolean> {
    try {
      const doc = await this.getById(table, id);

      if (!doc || !doc._rev) {
        return false;
      }

      await db.remove(doc._id, doc._rev);
      return true;
    } catch (error) {
      console.error(`Error removing record ${id} from ${table}:`, error);
      return false;
    }
  }

  static async clear(table: string): Promise<number> {
    try {
      const records = await this.getAll(table);
      let deletedCount = 0;

      for (const record of records) {
        if (record._rev) {
          await db.remove(record._id, record._rev);
          deletedCount++;
        }
      }

      return deletedCount;
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

  static async getAllTables(): Promise<string[]> {
    try {
      const result = await db.allDocs({ include_docs: true });
      const tables = new Set<string>();

      result.rows.forEach((row) => {
        if (row.doc && 'table' in row.doc) {
          tables.add((row.doc as LocalRecord).table);
        }
      });

      return Array.from(tables);
    } catch (error) {
      console.error('Error getting all tables:', error);
      return [];
    }
  }

  static async clearAll(): Promise<void> {
    try {
      await db.destroy();
      console.log('Local database cleared completely');
    } catch (error) {
      console.error('Error clearing database:', error);
    }
  }

  static async getInfo(): Promise<any> {
    try {
      return await db.info();
    } catch (error) {
      console.error('Error getting database info:', error);
      return null;
    }
  }
}

export default LocalDB;
