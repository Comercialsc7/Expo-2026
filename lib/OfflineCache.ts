import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import Constants from 'expo-constants';
import TableStore from './TableStore';
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
  };

  /**
   * Prepara o app para trabalhar offline
   *
   * Salva sessão e faz cache de todas as tabelas importantes
   */
  static async prepare(tables: string[] = []): Promise<{
    success: boolean;
    cached: string[];
    errors: string[];
  }> {
    const cached: string[] = [];
    const errors: string[] = [];

    try {
      // Log masked Supabase source for debugging (env vs app.json)
      try {
        const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const configUrl = Constants.expoConfig?.extra?.supabaseUrl || '';
        const used = envUrl || configUrl || '<missing>';
        const masked = used ? used.replace(/(https?:\/\/)([^@\/]+)@?/, '$1****@') : '<missing>';
        const source = envUrl ? 'process.env' : (configUrl ? 'app.json.extra' : 'none');
        console.debug(`🔍 [OfflineCache] Supabase URL source: ${source}; value: ${masked}`);
      } catch (e) {
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
            const count = await this.cacheTable(table);
            cached.push(`${table} (${count} registros)`);
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
        JSON.stringify(tables)
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

      if (error || !session) {
        console.warn('[OfflineCache] Nenhuma sessão ativa');
        return false;
      }

      // Salva sessão completa
      await AsyncStorage.setItem(
        this.KEYS.SESSION,
        JSON.stringify(session)
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

  /**
   * Faz cache de uma tabela do Supabase
   */
  private static async cacheTable(table: string): Promise<number> {
    console.log(`🔎 [OfflineCache] Iniciando download de tabela '${table}' do Supabase`);
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`❌ [OfflineCache] Erro ao baixar tabela '${table}':`, error);
      throw error;
    }

    const count = data ? data.length : 0;
    console.log(`ℹ️ [OfflineCache] Tabela '${table}' - registros recebidos: ${count}`);

    if (data && data.length > 0) {
      // Log sample (até 5 registros) para depuração
      try {
        console.log(`📄 [OfflineCache] Amostra de registros de '${table}':`, data.slice(0, 5));
      } catch (logError) {
        console.warn(`⚠️ [OfflineCache] Não foi possível logar amostra de '${table}':`, logError);
      }

      await TableStore.set(table, data);
      await OfflineSQLiteService.replaceTable(table, data);
      return data.length;
    }

    await OfflineSQLiteService.replaceTable(table, []);

    return 0;
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

      const hasSession = !!sessionJson;
      const tables = tablesJson ? JSON.parse(tablesJson) : [];
      const tablesToRequireData = new Set(
        tables.filter((table: string) => table !== 'pedidos')
      );

      let tablesWithData = 0;
      for (const table of tablesToRequireData) {
        try {
          const sqliteRows = await OfflineSQLiteService.getAll(table);
          const tableStoreRows = sqliteRows.length > 0 ? [] : await TableStore.get(table);

          if ((sqliteRows?.length || 0) > 0 || (tableStoreRows?.length || 0) > 0) {
            tablesWithData++;
          }
        } catch (error) {
          console.warn(`[OfflineCache] Falha ao validar cache da tabela '${table}':`, error);
        }
      }

      const cacheDataReady =
        tablesToRequireData.size === 0 || tablesWithData >= tablesToRequireData.size;

      return {
        ready: hasSession && tables.length > 0 && cacheDataReady,
        session: hasSession,
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

      await AsyncStorage.removeItem(this.KEYS.SESSION);
      await AsyncStorage.removeItem(this.KEYS.USER);
      await AsyncStorage.removeItem(this.KEYS.CACHED_AT);
      await AsyncStorage.removeItem(this.KEYS.TABLES_CACHED);

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
    } catch (error) {
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

      // Verifica se o token ainda é válido
      if (session.expires_at) {
        const expiresAt = new Date(session.expires_at * 1000);
        const now = new Date();
        return expiresAt > now;
      }

      return !!session.access_token;
    } catch (error) {
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
