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

  static async find(table: string, selector: any): Promise<LocalRecord[]> {
    try {
      const result = await db.find({
        selector: {
          table: { $eq: table },
          ...selector
        },
      });
      return result.docs as LocalRecord[];
    } catch (error) {
      console.error(`Error finding records in ${table}:`, error);
      return [];
    }
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

  static async createIndexes(fields: string[]): Promise<void> {
    try {
      await db.createIndex({
        index: {
          fields: fields,
        },
      });
      console.log(`✅ Index created for fields: [${fields.join(', ')}]`);
    } catch (error) {
      console.error('Error creating index:', error);
    }
  }

  static async clearAll(): Promise<void> {
    try {
      await db.destroy();
      console.log('Local database cleared completely');
      // Re-initialize mandatory index on 'table' after destroy
      await this.init();
    } catch (error) {
      console.error('Error clearing database:', error);
    }
  }

  static async init() {
    // Garante indices base
    await this.createIndexes(['table']);
    await this.createIndexes(['table', 'updatedAt']);
  }

  static async delete(id: string): Promise<boolean> {
    try {
      const doc = await db.get(id);
      await db.remove(doc._id, doc._rev);
      return true;
    } catch (error) {
      // Se não encontrar ou já estiver deletado, não é erro grave
      return false;
    }
  }

  static async bulkDelete(docs: any[]): Promise<boolean> {
    try {
      // PouchDB requer que os documentos tenham _deleted: true para serem apagados no bulkDocs
      const toDelete = docs.map(doc => ({
        ...doc,
        _deleted: true
      }));

      const result = await db.bulkDocs(toDelete);
      // Verifica se houve algum erro nos resultados
      const errors = result.filter((r: any) => r.error);
      if (errors.length > 0) {
        console.warn('Alguns documentos não puderam ser deletados:', errors);
      }
      return true;
    } catch (error) {
      console.error('Error bulk deleting:', error);
      return false;
    }
  }

  static async bulkSave(records: any[]): Promise<number> {
    try {
      const result = await db.bulkDocs(records);
      const successCount = result.filter((r: any) => !r.error).length;
      return successCount;
    } catch (error) {
      console.error('Error bulk saving:', error);
      return 0;
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
