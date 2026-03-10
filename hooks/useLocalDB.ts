import { useSQLiteStore } from './useSQLiteStore';
import type { UseSQLiteStoreResult } from './useSQLiteStore';

// Alias temporario para compatibilidade com codigo legado.
export function useLocalDB<T = any>(tableName: string): UseSQLiteStoreResult<T> {
  return useSQLiteStore<T>(tableName);
}

export default useLocalDB;

