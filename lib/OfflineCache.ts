import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import Constants from 'expo-constants';
import TableStore from './TableStore';
import SQLiteStore from './SQLiteStore';
import OfflineSQLiteService from './OfflineSQLiteService';

/**
 * OfflineCache - Sistema de pré-cache para funcionar offline
 *
 * Prepara o app para trabalhar sem conexão, salvando:
 * - Sessão de autenticação
 * - Dados críticos (produtos, clientes, etc)
 */
class OfflineCache {
  private static KEYS = {
    SESSION: '@app:session',
    USER: '@app:user',
    CACHED_AT: '@app:cached_at',
    TABLES_CACHED: '@app:tables_cached',
    SESSION_LAST_VALIDATED_AT: '@app:session_last_validated_at',
    TABLE_CHECKPOINTS: '@app:table_checkpoints',
  };

  private static SESSION_OFFLINE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;
  private static CACHE_BATCH_SIZE = 500;
  private static TABLESTORE_MAX_SAFE_ROWS = 1500;

  /**
   * Prepara o app para trabalhar offline
   *
   * Salva sessão e faz cache de todas as tabelas importantes
   */
  static async prepare(
    tables: string[] = [],
    tableFilters: Record<string, Record<string, string | number>> = {}
  ): Promise<{
    success: boolean;
    cached: string[];
    errors: string[];
  }> {
    const cached: string[] = [];
    const errors: string[] = [];
    const successfulTables: string[] = [];

    try {
      // Log masked Supabase source for debugging (env vs app.json)
      try {
        const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const configUrl = Constants.expoConfig?.extra?.supabaseUrl || '';
        const used = envUrl || configUrl || '<missing>';
        const masked = used ? used.replace(/(https?:\/\/)([^@\/]+)@?/, '$1****@') : '<missing>';
        const source = envUrl ? 'process.env' : (configUrl ? 'app.json.extra' : 'none');
        console.debug(`🔍 [OfflineCache] Supabase URL source: ${source}; value: ${masked}`);
      } catch {
        // ignore logging errors
      }

      console.log('🔄 [OfflineCache] Preparando app para modo offline...');

      // 1. Salvar sessão de autenticação
      const sessionSaved = await this.saveSession();
      if (sessionSaved) {
        cached.push('session');
        console.log('✅ [OfflineCache] Sessão salva');
      } else {
        errors.push('session');
        console.warn('⚠️ [OfflineCache] Falha ao salvar sessão');
      }

      // 2. Fazer cache das tabelas
      if (tables.length > 0) {
        for (const table of tables) {
          try {
            const count = await this.cacheTable(table, tableFilters[table]);
            cached.push(`${table} (${count} registros)`);
            successfulTables.push(table);
            console.log(`✅ [OfflineCache] ${table}: ${count} registros em cache`);
          } catch (error) {
            errors.push(table);
            console.error(`❌ [OfflineCache] Erro ao cachear ${table}:`, error);
          }
        }
      }

      // 3. Salvar timestamp e lista de tabelas
      await AsyncStorage.setItem(
        this.KEYS.CACHED_AT,
        new Date().toISOString()
      );
      await AsyncStorage.setItem(
        this.KEYS.TABLES_CACHED,
        JSON.stringify(successfulTables)
      );

      const success = errors.length === 0;
      console.log(
        success
          ? '✅ [OfflineCache] App preparado para modo offline!'
          : `⚠️ [OfflineCache] Preparação concluída com ${errors.length} erros`
      );

      return { success, cached, errors };
    } catch (error) {
      console.error('❌ [OfflineCache] Erro ao preparar offline:', error);
      return { success: false, cached, errors: ['general'] };
    }
  }

  /**
   * Salva sessão de autenticação no AsyncStorage
   */
  private static async saveSession(): Promise<boolean> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.warn('[OfflineCache] Falha ao consultar sessão Supabase:', error.message);
        return false;
      }

      // Este app usa login custom via tabela users em parte do fluxo.
      // Quando não existe sessão do Supabase Auth, não deve contar como erro.
      if (!session) {
        await AsyncStorage.setItem(
          this.KEYS.SESSION_LAST_VALIDATED_AT,
          new Date().toISOString()
        );
        return true;
      }

      // Salva sessão completa
      await AsyncStorage.setItem(
        this.KEYS.SESSION,
        JSON.stringify(session)
      );
      await AsyncStorage.setItem(
        this.KEYS.SESSION_LAST_VALIDATED_AT,
        new Date().toISOString()
      );

      // Salva dados do usuário separadamente (mais fácil acesso)
      if (session.user) {
        await AsyncStorage.setItem(
          this.KEYS.USER,
          JSON.stringify(session.user)
        );
      }

      return true;
    } catch (error) {
      console.error('[OfflineCache] Erro ao salvar sessão:', error);
      return false;
    }
  }

  private static async getTableCheckpoints(): Promise<Record<string, number>> {
    try {
      const raw = await AsyncStorage.getItem(this.KEYS.TABLE_CHECKPOINTS);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private static async saveTableCheckpoint(table: string, offset: number): Promise<void> {
    const checkpoints = await this.getTableCheckpoints();
    checkpoints[table] = Math.max(0, Number(offset) || 0);
    await AsyncStorage.setItem(this.KEYS.TABLE_CHECKPOINTS, JSON.stringify(checkpoints));
  }

  private static async clearTableCheckpoint(table: string): Promise<void> {
    const checkpoints = await this.getTableCheckpoints();
    if (table in checkpoints) {
      delete checkpoints[table];
      await AsyncStorage.setItem(this.KEYS.TABLE_CHECKPOINTS, JSON.stringify(checkpoints));
    }
  }

  private static async fetchTableBatch(
    table: string,
    offset: number,
    limit: number,
    filters?: Record<string, string | number>
  ): Promise<any[]> {
    let query = supabase
      .from(table)
      .select('*')
      .range(offset, offset + limit - 1) as any;

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
    }

    let result: { data: any[] | null; error: any };
    try {
      result = await query.order('created_at', { ascending: false });
    } catch {
      result = await query;
    }

    if (result.error) {
      throw result.error;
    }

    return result.data || [];
  }

  /**
   * Faz cache de uma tabela do Supabase.
   * @param filters Filtros opcionais aplicados via .eq() na query (ex.: { equipe: 2, repre: '3272' }).
   *                Reduz volume baixado e cacheado para tabelas grandes como clients.
   */
  private static async cacheTable(
    table: string,
    filters?: Record<string, string | number>
  ): Promise<number> {
    console.log(`🔎 [OfflineCache] Iniciando download de tabela '${table}' do Supabase`);

    const checkpoints = await this.getTableCheckpoints();
    let offset = Math.max(0, Number(checkpoints[table] || 0));
    let totalDownloaded = 0;
    let hasMore = true;
    const tableStoreBuffer: any[] = [];

    while (hasMore) {
      const batch = await this.fetchTableBatch(
        table,
        offset,
        this.CACHE_BATCH_SIZE,
        filters
      );

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      await OfflineSQLiteService.upsertMany(table, batch);
      totalDownloaded += batch.length;
      offset += batch.length;
      await this.saveTableCheckpoint(table, offset);

      if (tableStoreBuffer.length < this.TABLESTORE_MAX_SAFE_ROWS) {
        const remaining = this.TABLESTORE_MAX_SAFE_ROWS - tableStoreBuffer.length;
        tableStoreBuffer.push(...batch.slice(0, remaining));
      }

      if (batch.length < this.CACHE_BATCH_SIZE) {
        hasMore = false;
      }
    }

    if (tableStoreBuffer.length > 0) {
      await TableStore.set(table, tableStoreBuffer);
    }

    await this.clearTableCheckpoint(table);

    console.log(`ℹ️ [OfflineCache] Tabela '${table}' - registros baixados: ${totalDownloaded}`);

    return totalDownloaded;
  }

  /**
   * Recupera sessão salva (para usar offline)
   */
  static async getSession(): Promise<any | null> {
    try {
      const sessionJson = await AsyncStorage.getItem(this.KEYS.SESSION);
      if (sessionJson) {
        return JSON.parse(sessionJson);
      }
      return null;
    } catch (error) {
      console.error('[OfflineCache] Erro ao recuperar sessão:', error);
      return null;
    }
  }

  /**
   * Recupera dados do usuário salvos
   */
  static async getUser(): Promise<any | null> {
    try {
      const userJson = await AsyncStorage.getItem(this.KEYS.USER);
      if (userJson) {
        return JSON.parse(userJson);
      }
      return null;
    } catch (error) {
      console.error('[OfflineCache] Erro ao recuperar usuário:', error);
      return null;
    }
  }

  /**
   * Verifica se o app está preparado para offline
   */
  static async isReady(): Promise<{
    ready: boolean;
    session: boolean;
    tablesCount: number;
    cachedAt: string | null;
  }> {
    try {
      const sessionJson = await AsyncStorage.getItem(this.KEYS.SESSION);
      const cachedAt = await AsyncStorage.getItem(this.KEYS.CACHED_AT);
      const tablesJson = await AsyncStorage.getItem(this.KEYS.TABLES_CACHED);
      const representativeCode = await AsyncStorage.getItem('representativeCodeToStore');

      const hasSession = !!sessionJson;
      const hasCustomLogin = !!representativeCode;
      const tables = tablesJson ? JSON.parse(tablesJson) : [];

      return {
        ready: (hasSession || hasCustomLogin) && tables.length > 0,
        session: hasSession || hasCustomLogin,
        tablesCount: tables.length,
        cachedAt,
      };
    } catch (error) {
      console.error('[OfflineCache] Erro ao verificar status:', error);
      return {
        ready: false,
        session: false,
        tablesCount: 0,
        cachedAt: null,
      };
    }
  }

  /**
   * Limpa todo o cache offline
   */
  static async clear(): Promise<void> {
    try {
      console.log('🗑️ [OfflineCache] Limpando cache offline...');

      const tablesJson = await AsyncStorage.getItem(this.KEYS.TABLES_CACHED);
      const cachedTables: string[] = tablesJson ? JSON.parse(tablesJson) : [];

      await AsyncStorage.removeItem(this.KEYS.SESSION);
      await AsyncStorage.removeItem(this.KEYS.USER);
      await AsyncStorage.removeItem(this.KEYS.CACHED_AT);
      await AsyncStorage.removeItem(this.KEYS.TABLES_CACHED);
      await AsyncStorage.removeItem(this.KEYS.SESSION_LAST_VALIDATED_AT);
      await AsyncStorage.removeItem(this.KEYS.TABLE_CHECKPOINTS);

      // Limpa espelho SQLite tabela a tabela para evitar resíduos locais.
      for (const table of cachedTables) {
        try {
          await OfflineSQLiteService.clearTable(table);
        } catch (sqliteError) {
          console.warn(`⚠️ [OfflineCache] Falha ao limpar SQLite da tabela '${table}':`, sqliteError);
        }
      }

      // Limpa o banco local principal (inclui dados em cache e metadados de sync).
      await SQLiteStore.clearAll();

      console.log('✅ [OfflineCache] Cache limpo');
    } catch (error) {
      console.error('❌ [OfflineCache] Erro ao limpar cache:', error);
    }
  }

  /**
   * Verifica se o cache está desatualizado
   */
  static async isStale(maxAgeMinutes: number = 60): Promise<boolean> {
    try {
      const cachedAt = await AsyncStorage.getItem(this.KEYS.CACHED_AT);

      if (!cachedAt) {
        return true;
      }

      const cacheDate = new Date(cachedAt);
      const now = new Date();
      const diffMinutes = (now.getTime() - cacheDate.getTime()) / 60000;

      return diffMinutes > maxAgeMinutes;
    } catch {
      return true;
    }
  }

  /**
   * Atualiza apenas a sessão (quando usuário faz login)
   */
  static async updateSession(): Promise<boolean> {
    return await this.saveSession();
  }

  /**
   * Verifica se há sessão válida no cache
   */
  static async hasValidSession(): Promise<boolean> {
    try {
      const sessionJson = await AsyncStorage.getItem(this.KEYS.SESSION);

      if (!sessionJson) {
        return false;
      }

      const session = JSON.parse(sessionJson);
      const now = new Date();

      // Token ainda valido.
      if (session.expires_at) {
        const expiresAt = new Date(session.expires_at * 1000);
        if (expiresAt > now) {
          await AsyncStorage.setItem(this.KEYS.SESSION_LAST_VALIDATED_AT, now.toISOString());
          return true;
        }

        // Se expirou, tenta refresh da sessao quando possivel.
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (!error && data?.session) {
            await AsyncStorage.setItem(this.KEYS.SESSION, JSON.stringify(data.session));
            await AsyncStorage.setItem(this.KEYS.SESSION_LAST_VALIDATED_AT, now.toISOString());
            return true;
          }
        } catch {
          // Ignora: cai para janela de graca offline abaixo.
        }

        const validatedAt = await AsyncStorage.getItem(this.KEYS.SESSION_LAST_VALIDATED_AT);
        if (validatedAt) {
          const lastValidMs = new Date(validatedAt).getTime();
          if (!Number.isNaN(lastValidMs) && now.getTime() - lastValidMs <= this.SESSION_OFFLINE_GRACE_MS) {
            return true;
          }
        }

        return false;
      }

      if (session.access_token) {
        await AsyncStorage.setItem(this.KEYS.SESSION_LAST_VALIDATED_AT, now.toISOString());
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Retorna informações detalhadas do cache
   */
  static async getInfo(): Promise<{
    session: any | null;
    user: any | null;
    cachedAt: string | null;
    tables: string[];
    isStale: boolean;
  }> {
    try {
      const sessionJson = await AsyncStorage.getItem(this.KEYS.SESSION);
      const userJson = await AsyncStorage.getItem(this.KEYS.USER);
      const cachedAt = await AsyncStorage.getItem(this.KEYS.CACHED_AT);
      const tablesJson = await AsyncStorage.getItem(this.KEYS.TABLES_CACHED);

      const session = sessionJson ? JSON.parse(sessionJson) : null;
      const user = userJson ? JSON.parse(userJson) : null;
      const tables = tablesJson ? JSON.parse(tablesJson) : [];
      const isStale = await this.isStale();

      return { session, user, cachedAt, tables, isStale };
    } catch (error) {
      console.error('[OfflineCache] Erro ao buscar info:', error);
      return {
        session: null,
        user: null,
        cachedAt: null,
        tables: [],
        isStale: true,
      };
    }
  }
}

export default OfflineCache;

