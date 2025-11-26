import { useState, useEffect, useCallback } from 'react';
import SyncService, { SyncEvent, SyncConfig } from '../lib/SyncService';

interface UseSyncServiceResult {
  syncing: boolean;
  progress: number;
  total: number;
  message: string;
  error: Error | null;
  lastSync: Date | null;
  sync: (tables: string[]) => Promise<void>;
  upload: () => Promise<void>;
  download: (tables: string[]) => Promise<void>;
  uploadTable: (table: string) => Promise<void>;
  downloadTable: (table: string, fullRefresh?: boolean) => Promise<void>;
}

export function useSyncService(): UseSyncServiceResult {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const handleSyncStart = (event: SyncEvent) => {
      setSyncing(true);
      setProgress(0);
      setTotal(0);
      setMessage(event.message || 'Sincronizando...');
      setError(null);
    };

    const handleSyncProgress = (event: SyncEvent) => {
      setProgress(event.progress || 0);
      setTotal(event.total || 0);
      setMessage(event.message || 'Processando...');
    };

    const handleSyncCompleted = (event: SyncEvent) => {
      setSyncing(false);
      setProgress(0);
      setTotal(0);
      setMessage(event.message || 'Sincronização concluída');
      setLastSync(new Date());
    };

    const handleSyncError = (event: SyncEvent) => {
      setSyncing(false);
      setProgress(0);
      setTotal(0);
      setMessage(event.message || 'Erro na sincronização');
      setError(event.error || new Error('Erro desconhecido'));
    };

    SyncService.on('sync-start', handleSyncStart);
    SyncService.on('sync-progress', handleSyncProgress);
    SyncService.on('sync-completed', handleSyncCompleted);
    SyncService.on('sync-error', handleSyncError);

    return () => {
      SyncService.off('sync-start', handleSyncStart);
      SyncService.off('sync-progress', handleSyncProgress);
      SyncService.off('sync-completed', handleSyncCompleted);
      SyncService.off('sync-error', handleSyncError);
    };
  }, []);

  const sync = useCallback(async (tables: string[]) => {
    try {
      setError(null);
      const config: SyncConfig = { tables };
      await SyncService.sync(config);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const upload = useCallback(async () => {
    try {
      setError(null);
      await SyncService.upload();
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const download = useCallback(async (tables: string[]) => {
    try {
      setError(null);
      const config: SyncConfig = { tables };
      await SyncService.download(config);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const uploadTable = useCallback(async (table: string) => {
    try {
      setError(null);
      setSyncing(true);
      setMessage(`Enviando dados de ${table}...`);
      await SyncService.uploadTable(table);
      setSyncing(false);
      setMessage('Upload concluído');
    } catch (err) {
      setSyncing(false);
      setError(err as Error);
      throw err;
    }
  }, []);

  const downloadTable = useCallback(async (table: string, fullRefresh = false) => {
    try {
      setError(null);
      setSyncing(true);
      setMessage(`Baixando dados de ${table}...`);
      await SyncService.downloadTable(table, fullRefresh);
      setSyncing(false);
      setMessage('Download concluído');
    } catch (err) {
      setSyncing(false);
      setError(err as Error);
      throw err;
    }
  }, []);

  return {
    syncing,
    progress,
    total,
    message,
    error,
    lastSync,
    sync,
    upload,
    download,
    uploadTable,
    downloadTable,
  };
}

export default useSyncService;
