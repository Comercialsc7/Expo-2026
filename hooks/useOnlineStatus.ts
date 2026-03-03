import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import SyncService from '../lib/SyncService';
import LocalDB from '../lib/LocalDB';
import OfflineSQLiteService from '../lib/OfflineSQLiteService';

const OFFLINE_SYNC_TABLES = ['pedidos', 'products', 'clients', 'teams', 'brands', 'users', 'prazos', 'relacao_prazo'];

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const previousOnlineState = useRef(true);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const handleOnline = async () => {
      console.log('✅ Conexão restabelecida - executando auto-sync');
      setIsOnline(true);

      // Só sincroniza se estava offline antes
      if (!previousOnlineState.current) {
        try {
          // Primeiro envia pendências locais e depois baixa atualizações do servidor
          await SyncService.upload();
          await SyncService.download({ tables: OFFLINE_SYNC_TABLES });

          // Espelha tabelas críticas em SQLite para telas sqlite-first
          for (const table of OFFLINE_SYNC_TABLES) {
            try {
              const localRecords = await LocalDB.getAll(table);
              const payloads = localRecords.map((record) => record.payload);
              await OfflineSQLiteService.replaceTable(table, payloads);
            } catch (sqliteError) {
              console.warn(`⚠️ Falha ao espelhar '${table}' no SQLite após auto-sync:`, sqliteError);
            }
          }

          console.log('✅ Auto-sync concluído com sucesso');
        } catch (error) {
          console.error('❌ Erro no auto-sync:', error);
        }
      }

      previousOnlineState.current = true;
    };

    const handleOffline = () => {
      console.log('⚠️ Conexão perdida - modo offline ativado');
      setIsOnline(false);
      previousOnlineState.current = false;
    };

    // Definir estado inicial
    const initialStatus = navigator.onLine;
    setIsOnline(initialStatus);
    previousOnlineState.current = initialStatus;

    // Adicionar event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
