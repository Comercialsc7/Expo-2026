import { useState, useEffect } from 'react';
import OfflineCache from '@/lib/OfflineCache';
import { useOnlineStatus } from './useOnlineStatus';

/**
 * Hook para gerenciar cache offline
 *
 * Fornece funções para preparar o app para trabalhar offline
 */
export function useOfflineCache() {
  const [ready, setReady] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [info, setInfo] = useState({
    session: false,
    tablesCount: 0,
    cachedAt: null as string | null,
  });
  const isOnline = useOnlineStatus();

  // Verifica se está pronto ao montar
  useEffect(() => {
    checkReady();
  }, []);

  const checkReady = async () => {
    const status = await OfflineCache.isReady();
    setReady(status.ready);
    setInfo({
      session: status.session,
      tablesCount: status.tablesCount,
      cachedAt: status.cachedAt,
    });
  };

  /**
   * Prepara o app para trabalhar offline
   */
  const prepare = async (tables: string[] = []) => {
    try {
      setPreparing(true);
      const result = await OfflineCache.prepare(tables);
      await checkReady();
      return result;
    } catch (error) {
      console.error('Erro ao preparar offline:', error);
      return { success: false, cached: [], errors: ['general'] };
    } finally {
      setPreparing(false);
    }
  };

  /**
   * Limpa o cache
   */
  const clear = async () => {
    await OfflineCache.clear();
    await checkReady();
  };

  /**
   * Verifica se o cache está desatualizado
   */
  const checkStale = async (maxAgeMinutes: number = 60) => {
    return await OfflineCache.isStale(maxAgeMinutes);
  };

  /**
   * Atualiza sessão após login
   */
  const updateSession = async () => {
    const success = await OfflineCache.updateSession();
    await checkReady();
    return success;
  };

  return {
    ready,
    preparing,
    info,
    isOnline,
    prepare,
    clear,
    checkStale,
    updateSession,
    checkReady,
  };
}
