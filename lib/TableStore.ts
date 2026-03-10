import SQLiteStore from './SQLiteStore';

/**
 * TableStore - Camada de abstração para gerenciar tabelas locais
 *
 * Permite armazenar e gerenciar tabelas completas no PouchDB
 * Ideal para cadastros que precisam estar disponíveis offline:
 * - Produtos
 * - Clientes
 * - Estoque
 * - Categorias
 * - etc.
 */
class TableStore {
  /**
   * SET - Substitui a tabela local inteira
   *
   * Remove todos os registros antigos e grava os novos
   * Útil para sincronizar dados do servidor
   *
   * @param table Nome da tabela
   * @param items Array de registros a serem salvos
   * @returns Número de registros salvos
   */
  static async set(table: string, items: any[]): Promise<number> {
    try {
      console.log(`📦 [TableStore] SET iniciado em '${table}' (${items.length} registros)`);

      // Passo 1: Remover todos os registros antigos da tabela de uma vez
      const oldRecords = await SQLiteStore.getAll(table);
      if (oldRecords.length > 0) {
        console.log(`🗑️ [TableStore] Removendo ${oldRecords.length} registros antigos em lote...`);
        // Prepara os documentos para exclusão
        await SQLiteStore.bulkDelete(oldRecords);
      }

      // Passo 2: Preparar e Inserir novos registros em lote
      // PouchDB aceita o UUID no campo _id. Se o item já tem id, use-o como _id ou prefixe para evitar colisão
      const timestamp = new Date().toISOString();
      const recordsToSave = items.map(item => ({
        _id: item.id || undefined, // Deixa o SQLiteStore gerar se não tiver, ou usa o ID do item
        ...item,
        table, // IMPORTANTE: Garantir o campo table para o index
        _tableStore: true,
        _lastSync: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      }));

      console.log(`💾 [TableStore] Salvando ${recordsToSave.length} novos registros em lote...`);
      const savedCount = await SQLiteStore.bulkSave(recordsToSave);

      console.log(`✅ [TableStore] SET concluído em '${table}' (${savedCount}/${items.length} salvos)`);
      return savedCount;
    } catch (error) {
      console.error(`❌ [TableStore] Erro no SET de '${table}':`, error);
      throw error;
    }
  }

  /**
   * GET - Retorna todos os registros da tabela local
   *
   * @param table Nome da tabela
   * @returns Array de registros
   */
  static async get(table: string): Promise<any[]> {
    try {
      console.log(`📖 [TableStore] GET em '${table}'`);

      const records = await SQLiteStore.getAll(table);
      const items = records.map(r => r.payload);

      console.log(`✅ [TableStore] GET concluído em '${table}' (${items.length} registros)`);
      return items;
    } catch (error) {
      console.error(`❌ [TableStore] Erro no GET de '${table}':`, error);
      return [];
    }
  }

  /**
   * GET BY ID - Busca um registro específico
   *
   * @param table Nome da tabela
   * @param id ID do registro
   * @returns Registro encontrado ou null
   */
  static async getById(table: string, id: string): Promise<any | null> {
    try {
      console.log(`🔍 [TableStore] GET BY ID em '${table}' (id: ${id})`);

      const records = await SQLiteStore.getAll(table);
      const record = records.find(r => r.payload.id === id);

      if (record) {
        console.log(`✅ [TableStore] Registro encontrado em '${table}'`);
        return record.payload;
      }

      console.log(`⚠️ [TableStore] Registro não encontrado em '${table}'`);
      return null;
    } catch (error) {
      console.error(`❌ [TableStore] Erro no GET BY ID de '${table}':`, error);
      return null;
    }
  }

  /**
   * FIND - Busca registros que atendem a um critério
   *
   * @param table Nome da tabela
   * @param predicate Função de filtro
   * @returns Array de registros filtrados
   */
  static async find(table: string, predicate: (item: any) => boolean): Promise<any[]> {
    try {
      console.log(`🔍 [TableStore] FIND (Memory) em '${table}'`);

      const items = await this.get(table);
      const filtered = items.filter(predicate);

      console.log(`✅ [TableStore] FIND concluído em '${table}' (${filtered.length} encontrados)`);
      return filtered;
    } catch (error) {
      console.error(`❌ [TableStore] Erro no FIND de '${table}':`, error);
      return [];
    }
  }

  /**
   * FIND PRO (Optimized) - Busca registros usando Indices do Banco
   * Muito mais rápido que o find() normal para grandes volumes
   *
   * @param table Nome da tabela
   * @param selector Query selector (ex: { category: 'bebidas', active: true })
   */
  static async findQuery(table: string, selector: any): Promise<any[]> {
    try {
      console.log(`🚀 [TableStore] FIND QUERY (Index) em '${table}'`, selector);

      const records = await SQLiteStore.find(table, selector);
      const items = records.map(r => r.payload);

      console.log(`✅ [TableStore] FIND QUERY concluído (${items.length} encontrados)`);
      return items;
    } catch (error) {
      console.error(`❌ [TableStore] Erro no FIND QUERY de '${table}':`, error);
      return [];
    }
  }

  /**
   * UPDATE - Atualiza um registro específico
   *
   * @param table Nome da tabela
   * @param id ID do registro
   * @param changes Alterações a serem aplicadas
   * @returns Registro atualizado ou null
   */
  static async update(table: string, id: string, changes: any): Promise<any | null> {
    try {
      console.log(`✏️ [TableStore] UPDATE em '${table}' (id: ${id})`);

      // Busca o registro local
      const records = await SQLiteStore.getAll(table);
      const record = records.find(r => r.payload.id === id);

      if (!record) {
        console.log(`⚠️ [TableStore] Registro não encontrado em '${table}'`);
        return null;
      }

      // Aplica as mudanças
      const updated = {
        ...record.payload,
        ...changes,
        _tableStore: true,
        _lastSync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Salva o registro atualizado
      const saved = await SQLiteStore.save(table, updated);

      console.log(`✅ [TableStore] UPDATE concluído em '${table}'`);
      return saved.payload;
    } catch (error) {
      console.error(`❌ [TableStore] Erro no UPDATE de '${table}':`, error);
      return null;
    }
  }

  /**
   * REMOVE - Remove um registro específico
   *
   * @param table Nome da tabela
   * @param id ID do registro
   * @returns true se removido, false se não encontrado
   */
  static async remove(table: string, id: string): Promise<boolean> {
    try {
      console.log(`🗑️ [TableStore] REMOVE em '${table}' (id: ${id})`);

      // Busca o registro local
      const records = await SQLiteStore.getAll(table);
      const record = records.find(r => r.payload.id === id);

      if (!record) {
        console.log(`⚠️ [TableStore] Registro não encontrado em '${table}'`);
        return false;
      }

      // Remove o registro
      await SQLiteStore.delete(record._id);

      console.log(`✅ [TableStore] REMOVE concluído em '${table}'`);
      return true;
    } catch (error) {
      console.error(`❌ [TableStore] Erro no REMOVE de '${table}':`, error);
      return false;
    }
  }

  /**
   * CLEAR - Remove todos os registros de uma tabela
   *
   * @param table Nome da tabela
   * @returns Número de registros removidos
   */
  static async clear(table: string): Promise<number> {
    try {
      console.log(`🗑️ [TableStore] CLEAR em '${table}'`);

      const records = await SQLiteStore.getAll(table);
      let removedCount = 0;

      for (const record of records) {
        try {
          await SQLiteStore.delete(record._id);
          removedCount++;
        } catch (error) {
          console.error(`❌ [TableStore] Erro ao remover registro:`, error);
        }
      }

      console.log(`✅ [TableStore] CLEAR concluído em '${table}' (${removedCount} removidos)`);
      return removedCount;
    } catch (error) {
      console.error(`❌ [TableStore] Erro no CLEAR de '${table}':`, error);
      return 0;
    }
  }

  /**
   * COUNT - Retorna o número de registros na tabela
   *
   * @param table Nome da tabela
   * @returns Número de registros
   */
  static async count(table: string): Promise<number> {
    try {
      const records = await SQLiteStore.getAll(table);
      return records.length;
    } catch (error) {
      console.error(`❌ [TableStore] Erro no COUNT de '${table}':`, error);
      return 0;
    }
  }

  /**
   * EXISTS - Verifica se um registro existe
   *
   * @param table Nome da tabela
   * @param id ID do registro
   * @returns true se existe, false caso contrário
   */
  static async exists(table: string, id: string): Promise<boolean> {
    try {
      const item = await this.getById(table, id);
      return item !== null;
    } catch (error) {
      console.error(`❌ [TableStore] Erro no EXISTS de '${table}':`, error);
      return false;
    }
  }

  /**
   * GET METADATA - Retorna metadados da tabela
   *
   * @param table Nome da tabela
   * @returns Metadados (count, lastSync, etc)
   */
  static async getMetadata(table: string): Promise<{
    count: number;
    lastSync: string | null;
    table: string;
  }> {
    try {
      const records = await SQLiteStore.getAll(table);

      // Encontra o último sync
      let lastSync: string | null = null;
      for (const record of records) {
        const sync = record.payload._lastSync;
        if (sync && (!lastSync || sync > lastSync)) {
          lastSync = sync;
        }
      }

      return {
        count: records.length,
        lastSync,
        table,
      };
    } catch (error) {
      console.error(`❌ [TableStore] Erro no GET METADATA de '${table}':`, error);
      return {
        count: 0,
        lastSync: null,
        table,
      };
    }
  }

  /**
   * BATCH UPDATE - Atualiza múltiplos registros de uma vez
   *
   * @param table Nome da tabela
   * @param updates Array de { id, changes }
   * @returns Número de registros atualizados
   */
  static async batchUpdate(
    table: string,
    updates: Array<{ id: string; changes: any }>
  ): Promise<number> {
    try {
      console.log(`✏️ [TableStore] BATCH UPDATE em '${table}' (${updates.length} registros)`);

      let updatedCount = 0;
      for (const { id, changes } of updates) {
        const result = await this.update(table, id, changes);
        if (result) {
          updatedCount++;
        }
      }

      console.log(`✅ [TableStore] BATCH UPDATE concluído (${updatedCount}/${updates.length})`);
      return updatedCount;
    } catch (error) {
      console.error(`❌ [TableStore] Erro no BATCH UPDATE de '${table}':`, error);
      return 0;
    }
  }

  /**
   * SEARCH - Busca por texto em campos específicos
   *
   * @param table Nome da tabela
   * @param searchTerm Termo de busca
   * @param fields Campos onde buscar
   * @returns Array de registros encontrados
   */
  static async search(
    table: string,
    searchTerm: string,
    fields: string[]
  ): Promise<any[]> {
    try {
      console.log(`🔍 [TableStore] SEARCH em '${table}' (termo: "${searchTerm}")`);

      const items = await this.get(table);
      const term = searchTerm.toLowerCase();

      const results = items.filter(item => {
        for (const field of fields) {
          const value = item[field];
          if (value && String(value).toLowerCase().includes(term)) {
            return true;
          }
        }
        return false;
      });

      console.log(`✅ [TableStore] SEARCH concluído (${results.length} encontrados)`);
      return results;
    } catch (error) {
      console.error(`❌ [TableStore] Erro no SEARCH de '${table}':`, error);
      return [];
    }
  }
}

export default TableStore;

