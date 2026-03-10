import { useState, useEffect, useCallback } from 'react';
import SQLiteStore from '../lib/SQLiteStore';

interface UseSQLiteStoreResult<T = any> {
  data: T[];
  loading: boolean;
  error: string | null;
  save: (record: T) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
  count: number;
}

export function useSQLiteStore<T = any>(tableName: string): UseSQLiteStoreResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const records = await SQLiteStore.getAll(tableName);
      const payloads = records.map((record) => ({
        ...record.payload,
        _id: record._id,
        _createdAt: record.createdAt,
        _updatedAt: record.updatedAt,
      }));
      setData(payloads);
      setCount(payloads.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
      console.error('Error loading data from SQLiteStore:', err);
    } finally {
      setLoading(false);
    }
  }, [tableName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const save = useCallback(
    async (record: T) => {
      try {
        await SQLiteStore.save(tableName, record);
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar');
        throw err;
      }
    },
    [tableName, loadData]
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await SQLiteStore.remove(tableName, id);
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao remover');
        throw err;
      }
    },
    [tableName, loadData]
  );

  const clear = useCallback(async () => {
    try {
      await SQLiteStore.clear(tableName);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao limpar');
      throw err;
    }
  }, [tableName, loadData]);

  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    save,
    remove,
    clear,
    refresh,
    count,
  };
}

export type { UseSQLiteStoreResult };
