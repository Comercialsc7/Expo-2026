import { supabase } from './supabase';
import LocalDB from './LocalDB';
import { Platform } from 'react-native';

/**
 * SmartRequest - Helper inteligente para requisições
 *
 * Decide automaticamente entre Supabase (online) e PouchDB (offline)
 * baseado no status da conexão.
 */
class SmartRequest {
  /**
   * Verifica se está online
   */
  private static isOnline(): boolean {
    if (Platform.OS !== 'web') {
      return true; // Em mobile, assume online por padrão
    }
    return navigator.onLine;
  }

  /**
   * INSERT - Insere registro
   *
   * Online: Insere direto no Supabase
   * Offline: Salva no PouchDB como pendência
   *
   * @param table Nome da tabela
   * @param payload Dados a serem inseridos
   * @returns Dados inseridos ou confirmação
   */
  static async insert(table: string, payload: any): Promise<any> {
    const online = this.isOnline();

    if (online) {
      try {
        console.log(`📡 [SmartRequest] INSERT online em '${table}'`);

        const { data, error } = await supabase
          .from(table)
          .insert(payload)
          .select()
          .single();

        if (error) {
          console.error(`❌ [SmartRequest] Erro ao inserir em '${table}':`, error);
          throw error;
        }

        console.log(`✅ [SmartRequest] INSERT concluído em '${table}'`);
        return data;
      } catch (error) {
        // Se falhar online, tenta salvar offline
        console.warn(`⚠️ [SmartRequest] Falha online, salvando offline em '${table}'`);
        return this.insertOffline(table, payload);
      }
    } else {
      return this.insertOffline(table, payload);
    }
  }

  /**
   * INSERT Offline - Salva no PouchDB como pendência
   */
  private static async insertOffline(table: string, payload: any): Promise<any> {
    console.log(`💾 [SmartRequest] INSERT offline em '${table}'`);

    const record = {
      ...payload,
      _synced: false,
      _operation: 'insert',
      _createdOffline: true,
      _timestamp: new Date().toISOString(),
    };

    const saved = await LocalDB.save(table, record);
    console.log(`✅ [SmartRequest] Salvo offline em '${table}' (será sincronizado depois)`);

    return saved.payload;
  }

  /**
   * SELECT - Busca registros
   *
   * Online: Busca do Supabase
   * Offline: Busca do PouchDB
   *
   * @param table Nome da tabela
   * @param options Opções de filtro (eq, select, etc)
   * @returns Array de registros
   */
  static async select(
    table: string,
    options?: {
      select?: string;
      eq?: { column: string; value: any };
      limit?: number;
      order?: { column: string; ascending?: boolean };
    }
  ): Promise<any[]> {
    const online = this.isOnline();

    if (online) {
      try {
        console.log(`📡 [SmartRequest] SELECT online em '${table}'`);

        let query = supabase.from(table).select(options?.select || '*');

        if (options?.eq) {
          query = query.eq(options.eq.column, options.eq.value);
        }

        if (options?.order) {
          query = query.order(options.order.column, {
            ascending: options.order.ascending ?? true
          });
        }

        if (options?.limit) {
          query = query.limit(options.limit);
        }

        const { data, error } = await query;

        if (error) {
          console.error(`❌ [SmartRequest] Erro ao buscar em '${table}':`, error);
          throw error;
        }

        console.log(`✅ [SmartRequest] SELECT concluído em '${table}' (${data?.length || 0} registros)`);
        return data || [];
      } catch (error) {
        // Se falhar online, tenta buscar offline
        console.warn(`⚠️ [SmartRequest] Falha online, buscando offline em '${table}'`);
        return this.selectOffline(table, options);
      }
    } else {
      return this.selectOffline(table, options);
    }
  }

  /**
   * SELECT Offline - Busca do PouchDB
   */
  private static async selectOffline(
    table: string,
    options?: {
      select?: string;
      eq?: { column: string; value: any };
      limit?: number;
      order?: { column: string; ascending?: boolean };
    }
  ): Promise<any[]> {
    console.log(`💾 [SmartRequest] SELECT offline em '${table}'`);

    try {
      let records = await LocalDB.getAll(table);

      // Extrai os payloads
      let results = records.map(r => r.payload);

      // Aplica filtro eq se fornecido
      if (options?.eq) {
        const { column, value } = options.eq;
        results = results.filter(r => r[column] === value);
      }

      // Aplica ordenação se fornecida
      if (options?.order) {
        const { column, ascending = true } = options.order;
        results.sort((a, b) => {
          const aVal = a[column];
          const bVal = b[column];
          if (aVal < bVal) return ascending ? -1 : 1;
          if (aVal > bVal) return ascending ? 1 : -1;
          return 0;
        });
      }

      // Aplica limit se fornecido
      if (options?.limit) {
        results = results.slice(0, options.limit);
      }

      console.log(`✅ [SmartRequest] SELECT offline concluído em '${table}' (${results.length} registros)`);
      return results;
    } catch (error) {
      console.error(`❌ [SmartRequest] Erro ao buscar offline em '${table}':`, error);
      return [];
    }
  }

  /**
   * UPDATE - Atualiza registro
   *
   * Online: Atualiza no Supabase
   * Offline: Salva no PouchDB como pendência
   *
   * @param table Nome da tabela
   * @param id ID do registro
   * @param payload Dados a serem atualizados
   * @returns Dados atualizados
   */
  static async update(table: string, id: string, payload: any): Promise<any> {
    const online = this.isOnline();

    if (online) {
      try {
        console.log(`📡 [SmartRequest] UPDATE online em '${table}' (id: ${id})`);

        const { data, error } = await supabase
          .from(table)
          .update(payload)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error(`❌ [SmartRequest] Erro ao atualizar em '${table}':`, error);
          throw error;
        }

        console.log(`✅ [SmartRequest] UPDATE concluído em '${table}'`);
        return data;
      } catch (error) {
        console.warn(`⚠️ [SmartRequest] Falha online, salvando offline em '${table}'`);
        return this.updateOffline(table, id, payload);
      }
    } else {
      return this.updateOffline(table, id, payload);
    }
  }

  /**
   * UPDATE Offline - Salva no PouchDB como pendência
   */
  private static async updateOffline(table: string, id: string, payload: any): Promise<any> {
    console.log(`💾 [SmartRequest] UPDATE offline em '${table}' (id: ${id})`);

    const record = {
      ...payload,
      id,
      _synced: false,
      _operation: 'update',
      _updatedOffline: true,
      _timestamp: new Date().toISOString(),
    };

    const saved = await LocalDB.save(table, record);
    console.log(`✅ [SmartRequest] Atualização salva offline em '${table}' (será sincronizado depois)`);

    return saved.payload;
  }

  /**
   * DELETE - Remove registro
   *
   * Online: Remove do Supabase
   * Offline: Marca no PouchDB como pendência de exclusão
   *
   * @param table Nome da tabela
   * @param id ID do registro
   * @returns Confirmação
   */
  static async delete(table: string, id: string): Promise<void> {
    const online = this.isOnline();

    if (online) {
      try {
        console.log(`📡 [SmartRequest] DELETE online em '${table}' (id: ${id})`);

        const { error } = await supabase
          .from(table)
          .delete()
          .eq('id', id);

        if (error) {
          console.error(`❌ [SmartRequest] Erro ao deletar em '${table}':`, error);
          throw error;
        }

        console.log(`✅ [SmartRequest] DELETE concluído em '${table}'`);
      } catch (error) {
        console.warn(`⚠️ [SmartRequest] Falha online, marcando para deletar offline em '${table}'`);
        await this.deleteOffline(table, id);
      }
    } else {
      await this.deleteOffline(table, id);
    }
  }

  /**
   * DELETE Offline - Marca no PouchDB como pendência de exclusão
   */
  private static async deleteOffline(table: string, id: string): Promise<void> {
    console.log(`💾 [SmartRequest] DELETE offline em '${table}' (id: ${id})`);

    const record = {
      id,
      _synced: false,
      _operation: 'delete',
      _deletedOffline: true,
      _timestamp: new Date().toISOString(),
    };

    await LocalDB.save(table, record);
    console.log(`✅ [SmartRequest] Exclusão marcada offline em '${table}' (será sincronizado depois)`);
  }

  /**
   * UPSERT - Insere ou atualiza registro
   *
   * @param table Nome da tabela
   * @param payload Dados
   * @returns Dados inseridos/atualizados
   */
  static async upsert(table: string, payload: any): Promise<any> {
    const online = this.isOnline();

    if (online) {
      try {
        console.log(`📡 [SmartRequest] UPSERT online em '${table}'`);

        const { data, error } = await supabase
          .from(table)
          .upsert(payload)
          .select()
          .single();

        if (error) {
          console.error(`❌ [SmartRequest] Erro ao fazer upsert em '${table}':`, error);
          throw error;
        }

        console.log(`✅ [SmartRequest] UPSERT concluído em '${table}'`);
        return data;
      } catch (error) {
        console.warn(`⚠️ [SmartRequest] Falha online, salvando offline em '${table}'`);
        return this.upsertOffline(table, payload);
      }
    } else {
      return this.upsertOffline(table, payload);
    }
  }

  /**
   * UPSERT Offline - Salva no PouchDB como pendência
   */
  private static async upsertOffline(table: string, payload: any): Promise<any> {
    console.log(`💾 [SmartRequest] UPSERT offline em '${table}'`);

    const record = {
      ...payload,
      _synced: false,
      _operation: 'upsert',
      _timestamp: new Date().toISOString(),
    };

    const saved = await LocalDB.save(table, record);
    console.log(`✅ [SmartRequest] Upsert salvo offline em '${table}' (será sincronizado depois)`);

    return saved.payload;
  }
}

export default SmartRequest;
