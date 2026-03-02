import LocalDB from './LocalDB';
import { supabase } from './supabase';

export type SyncEventType = 'sync-start' | 'sync-progress' | 'sync-completed' | 'sync-error';

export interface SyncEvent {
  type: SyncEventType;
  message?: string;
  progress?: number;
  total?: number;
  error?: Error;
  data?: any;
}

export interface SyncConfig {
  tables: string[];
  batchSize?: number;
  downloadTimeoutMs?: number;
  onProgress?: (event: SyncEvent) => void;
}

type EventListener = (event: SyncEvent) => void;

export class SyncService {
  private static listeners: Map<SyncEventType, EventListener[]> = new Map();
  private static isSyncing = false;
  private static lastSyncTime: Record<string, Date> = {};
  private static SYNC_META_TABLE = 'sync_meta';
  private static UPLOAD_TABLES = new Set([
    'pedidos',
    'order_items',
    'itens_pedido',
  ]);

  static on(eventType: SyncEventType, listener: EventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  }

  static off(eventType: SyncEventType, listener: EventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private static emit(event: SyncEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach((listener) => listener(event));
    }
  }

  private static withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout ao sincronizar '${label}' após ${timeoutMs}ms`));
      }, timeoutMs);

      Promise.resolve(promise)
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  private static isMissingColumnError(error: any, columnName: string): boolean {
    const text = [
      error?.message,
      error?.details,
      error?.hint,
      error?.code,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return text.includes(columnName.toLowerCase()) &&
      (text.includes('column') || text.includes('does not exist') || text.includes('42703') || text.includes('schema cache'));
  }

  private static async runDownloadQuery(
    table: string,
    lastDownloadAt: string | null,
    timeoutMs: number
  ): Promise<{
    data: any[] | null;
    error: any;
    filterColumn: 'updated_at' | 'created_at' | null;
  }> {
    if (!lastDownloadAt) {
      console.log(`🔄 [SyncService] Download completo de '${table}' (primeira vez)`);
      const result = await this.withTimeout(
        supabase.from(table).select('*') as unknown as Promise<{ data: any[]; error: any }>,
        timeoutMs,
        table
      );

      return {
        data: result.data,
        error: result.error,
        filterColumn: null,
      };
    }

    console.log(`🔄 [SyncService] Download incremental de '${table}' por 'updated_at' (desde ${lastDownloadAt})`);
    let result = await this.withTimeout(
      supabase.from(table).select('*').gt('updated_at', lastDownloadAt) as unknown as Promise<{ data: any[]; error: any }>,
      timeoutMs,
      table
    );

    if (result.error && this.isMissingColumnError(result.error, 'updated_at')) {
      console.warn(`⚠️ [SyncService] '${table}' sem coluna updated_at. Tentando incremental por 'created_at'...`);

      result = await this.withTimeout(
        supabase.from(table).select('*').gt('created_at', lastDownloadAt) as unknown as Promise<{ data: any[]; error: any }>,
        timeoutMs,
        table
      );

      return {
        data: result.data,
        error: result.error,
        filterColumn: 'created_at',
      };
    }

    return {
      data: result.data,
      error: result.error,
      filterColumn: 'updated_at',
    };
  }

  /**
   * Busca metadados de sincronização do PouchDB
   */
  private static async getSyncMeta(table: string): Promise<{
    last_upload_at: string | null;
    last_download_at: string | null;
  }> {
    try {
      const records = await LocalDB.getAll(this.SYNC_META_TABLE);
      const meta = records.find(r => r.payload.table === table);

      if (meta) {
        return {
          last_upload_at: meta.payload.last_upload_at || null,
          last_download_at: meta.payload.last_download_at || null,
        };
      }

      return {
        last_upload_at: null,
        last_download_at: null,
      };
    } catch (error) {
      console.error(`Erro ao buscar sync_meta de '${table}':`, error);
      return {
        last_upload_at: null,
        last_download_at: null,
      };
    }
  }

  /**
   * Atualiza metadados de sincronização no PouchDB
   */
  private static async updateSyncMeta(
    table: string,
    updates: {
      last_upload_at?: string;
      last_download_at?: string;
    }
  ): Promise<void> {
    try {
      const records = await LocalDB.getAll(this.SYNC_META_TABLE);
      const existing = records.find(r => r.payload.table === table);

      const payload = {
        table,
        last_upload_at: updates.last_upload_at || existing?.payload.last_upload_at || null,
        last_download_at: updates.last_download_at || existing?.payload.last_download_at || null,
        updated_at: new Date().toISOString(),
      };

      await LocalDB.save(this.SYNC_META_TABLE, payload);
      console.log(`✅ sync_meta atualizado para '${table}'`);
    } catch (error) {
      console.error(`Erro ao atualizar sync_meta de '${table}':`, error);
    }
  }

  static async upload(config?: Partial<SyncConfig>, emitLifecycle: boolean = true): Promise<{
    success: number;
    failed: number;
    errors: Array<{ table: string; error: Error }>;
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ table: string; error: Error }>,
    };

    const uploadTimestamp = new Date().toISOString();

    try {
      if (emitLifecycle) {
        this.emit({ type: 'sync-start', message: 'Iniciando upload...' });
      }

      const allTables = await LocalDB.getAllTables();
      const configuredTables = config?.tables ? new Set(config.tables) : null;
      const records = [];
      const processedTables = new Set<string>();

      for (const table of allTables) {
        // Ignora a tabela de metadados
        if (table === this.SYNC_META_TABLE) continue;
        if (!this.UPLOAD_TABLES.has(table)) continue;
        if (configuredTables && !configuredTables.has(table)) continue;

        const tableRecords = await LocalDB.getAll(table);
        const unsyncedRecords = tableRecords.filter(
          (record) => !record.payload._synced
        );
        records.push(...unsyncedRecords);
      }

      if (records.length === 0) {
        if (emitLifecycle) {
          this.emit({
            type: 'sync-progress',
            message: 'Nenhum registro para sincronizar',
            progress: 0,
            total: 0,
          });
          this.emit({
            type: 'sync-completed',
            message: 'Upload concluído (sem pendências)',
            data: results,
          });
        }
        return results;
      }

      const total = records.length;
      let processed = 0;

      for (const record of records) {
        try {
          const { table, payload } = record;
          const cleanPayload = { ...payload };
          delete cleanPayload._synced;
          delete cleanPayload._id;
          delete cleanPayload._createdAt;
          delete cleanPayload._updatedAt;
          delete cleanPayload._tableStore;
          delete cleanPayload._lastSync;

          const { error } = await supabase.from(table).upsert(cleanPayload);

          if (error) {
            throw error;
          }

          await LocalDB.save(table, {
            ...record.payload,
            _id: record._id,
            _synced: true,
            _lastSync: new Date().toISOString(),
          });

          results.success++;
          processed++;
          processedTables.add(table);

          if (emitLifecycle) {
            this.emit({
              type: 'sync-progress',
              message: `Sincronizando ${processed}/${total}`,
              progress: processed,
              total,
            });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            table: record.table,
            error: error as Error,
          });
          console.error(`Erro ao sincronizar registro da tabela ${record.table}:`, error);
        }
      }

      // Atualiza sync_meta para todas as tabelas processadas
      for (const table of processedTables) {
        await this.updateSyncMeta(table, {
          last_upload_at: uploadTimestamp,
        });
      }

      if (emitLifecycle) {
        this.emit({
          type: 'sync-completed',
          message: results.failed > 0 ? 'Upload concluído com erros' : 'Upload concluído com sucesso',
          data: results,
        });
      }

      return results;
    } catch (error) {
      if (emitLifecycle) {
        this.emit({
          type: 'sync-error',
          message: 'Erro durante upload',
          error: error as Error,
        });
      }
      throw error;
    }
  }

  static async download(config: SyncConfig, emitLifecycle: boolean = true): Promise<{
    downloaded: Record<string, number>;
    errors: Array<{ table: string; error: Error }>;
  }> {
    const results = {
      downloaded: {} as Record<string, number>,
      errors: [] as Array<{ table: string; error: Error }>,
    };

    const downloadTimestamp = new Date().toISOString();

    try {
      if (emitLifecycle) {
        this.emit({ type: 'sync-start', message: 'Iniciando download...' });
      }

      const { tables } = config;
      const timeoutMs = config.downloadTimeoutMs ?? 15000;
      const total = tables.length;
      let processed = 0;

      for (const table of tables) {
        try {
          // Busca o último download desta tabela
          const syncMeta = await this.getSyncMeta(table);
          const { data, error, filterColumn } = await this.runDownloadQuery(
            table,
            syncMeta.last_download_at,
            timeoutMs
          );

          if (error) {
            throw error;
          }

          if (filterColumn === 'created_at') {
            console.log(`ℹ️ [SyncService] Incremental de '${table}' executado por 'created_at'`);
          }

          if (data && data.length > 0) {
            // Se é primeira vez, limpa a tabela
            if (!syncMeta.last_download_at) {
              await LocalDB.clear(table);
            }

            // Salva os registros novos/atualizados
            for (const record of data) {
              await LocalDB.save(table, {
                ...record,
                _synced: true,
              });
            }

            results.downloaded[table] = data.length;
            console.log(`✅ [SyncService] ${data.length} registros baixados de '${table}'`);
          } else {
            results.downloaded[table] = 0;
            console.log(`ℹ️ [SyncService] Nenhum registro novo em '${table}'`);
          }

          // Atualiza timestamp do último download
          await this.updateSyncMeta(table, {
            last_download_at: downloadTimestamp,
          });

          processed++;

          if (emitLifecycle) {
            this.emit({
              type: 'sync-progress',
              message: `Baixando ${table} (${processed}/${total})`,
              progress: processed,
              total,
            });
          }
        } catch (error) {
          results.errors.push({
            table,
            error: error as Error,
          });
          console.error(`Erro ao baixar dados da tabela ${table}:`, error);
        }
      }

      if (emitLifecycle) {
        this.emit({
          type: 'sync-completed',
          message: results.errors.length > 0 ? 'Download concluído com erros' : 'Download concluído com sucesso',
          data: results,
        });
      }

      return results;
    } catch (error) {
      if (emitLifecycle) {
        this.emit({
          type: 'sync-error',
          message: 'Erro durante download',
          error: error as Error,
        });
      }
      throw error;
    }
  }

  static async sync(config: SyncConfig): Promise<{
    upload: {
      success: number;
      failed: number;
      errors: Array<{ table: string; error: Error }>;
    };
    download: {
      downloaded: Record<string, number>;
      errors: Array<{ table: string; error: Error }>;
    };
  }> {
    if (this.isSyncing) {
      throw new Error('Sincronização já em andamento');
    }

    this.isSyncing = true;

    try {
      this.emit({ type: 'sync-start', message: 'Iniciando sincronização completa...' });

      const uploadResults = await this.upload(config, false);

      const downloadResults = await this.download(config, false);

      const hasErrors =
        uploadResults.failed > 0 ||
        downloadResults.errors.length > 0;

      if (hasErrors) {
        this.emit({
          type: 'sync-completed',
          message: 'Sincronização concluída com erros',
          data: {
            upload: uploadResults,
            download: downloadResults,
          },
        });
      } else {
        this.emit({
          type: 'sync-completed',
          message: 'Sincronização concluída com sucesso',
          data: {
            upload: uploadResults,
            download: downloadResults,
          },
        });
      }

      return {
        upload: uploadResults,
        download: downloadResults,
      };
    } catch (error) {
      this.emit({
        type: 'sync-error',
        message: 'Erro durante sincronização',
        error: error as Error,
      });
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  static async uploadTable(table: string): Promise<{
    success: number;
    failed: number;
    errors: Array<{ error: Error }>;
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ error: Error }>,
    };

    try {
      const records = await LocalDB.getAll(table);
      const unsyncedRecords = records.filter((record) => !record.payload._synced);

      for (const record of unsyncedRecords) {
        try {
          const cleanPayload = { ...record.payload };
          delete cleanPayload._synced;
          delete cleanPayload._id;
          delete cleanPayload._createdAt;
          delete cleanPayload._updatedAt;

          const { error } = await supabase.from(table).upsert(cleanPayload);

          if (error) {
            throw error;
          }

          await LocalDB.save(table, {
            ...record.payload,
            _id: record._id,
            _synced: true,
            _lastSync: new Date().toISOString(),
          });
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({ error: error as Error });
        }
      }

      return results;
    } catch (error) {
      throw error;
    }
  }

  static async downloadTable(table: string, fullRefresh = false, timeoutMs: number = 15000): Promise<number> {
    try {
      const downloadTimestamp = new Date().toISOString();
      const syncMeta = fullRefresh ? null : await this.getSyncMeta(table);
      const { data, error, filterColumn } = await this.runDownloadQuery(
        table,
        fullRefresh ? null : (syncMeta?.last_download_at || null),
        timeoutMs
      );

      if (error) {
        throw error;
      }

      if (filterColumn === 'created_at') {
        console.log(`ℹ️ [SyncService] Incremental de '${table}' executado por 'created_at'`);
      }

      if (data && data.length > 0) {
        if (fullRefresh || !syncMeta?.last_download_at) {
          await LocalDB.clear(table);
        }

        for (const record of data) {
          await LocalDB.save(table, {
            ...record,
            _synced: true,
          });
        }

        console.log(`✅ [SyncService] ${data.length} registros baixados de '${table}'`);

        // Atualiza timestamp
        await this.updateSyncMeta(table, {
          last_download_at: downloadTimestamp,
        });

        return data.length;
      }

      console.log(`ℹ️ [SyncService] Nenhum registro novo em '${table}'`);

      // Atualiza timestamp mesmo sem dados novos
      await this.updateSyncMeta(table, {
        last_download_at: downloadTimestamp,
      });

      return 0;
    } catch (error) {
      throw error;
    }
  }

  static isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  static getLastSyncTime(table?: string): Date | Record<string, Date> | null {
    if (table) {
      return this.lastSyncTime[table] || null;
    }
    return this.lastSyncTime;
  }

  static clearListeners(): void {
    this.listeners.clear();
  }

  /**
   * Retorna metadados de sincronização de uma tabela
   */
  static async getSyncMetadata(table: string): Promise<{
    table: string;
    last_upload_at: string | null;
    last_download_at: string | null;
  }> {
    const meta = await this.getSyncMeta(table);
    return {
      table,
      ...meta,
    };
  }

  /**
   * Retorna metadados de sincronização de todas as tabelas
   */
  static async getAllSyncMetadata(): Promise<Array<{
    table: string;
    last_upload_at: string | null;
    last_download_at: string | null;
  }>> {
    try {
      const records = await LocalDB.getAll(this.SYNC_META_TABLE);
      return records.map(r => ({
        table: r.payload.table,
        last_upload_at: r.payload.last_upload_at || null,
        last_download_at: r.payload.last_download_at || null,
      }));
    } catch (error) {
      console.error('Erro ao buscar todos sync_meta:', error);
      return [];
    }
  }

  /**
   * Reseta os metadados de sincronização de uma tabela
   */
  static async resetSyncMetadata(table: string): Promise<void> {
    try {
      const records = await LocalDB.getAll(this.SYNC_META_TABLE);
      const meta = records.find(r => r.payload.table === table);

      if (meta) {
        await LocalDB.delete(meta._id);
        console.log(`✅ Metadados de sincronização resetados para '${table}'`);
      }
    } catch (error) {
      console.error(`Erro ao resetar sync_meta de '${table}':`, error);
    }
  }

  /**
   * Reseta todos os metadados de sincronização
   */
  static async resetAllSyncMetadata(): Promise<void> {
    try {
      await LocalDB.clear(this.SYNC_META_TABLE);
      console.log('✅ Todos os metadados de sincronização foram resetados');
    } catch (error) {
      console.error('Erro ao resetar todos sync_meta:', error);
    }
  }
}

export default SyncService;
