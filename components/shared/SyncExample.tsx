import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSyncService } from '../../hooks/useSyncService';
import { useLocalDB } from '../../hooks/useLocalDB';
import LocalDB from '../../lib/LocalDB';

interface DemoRecord {
  id?: string;
  name: string;
  value: number;
  _synced?: boolean;
}

export function SyncExample() {
  const { syncing, progress, total, message, error, sync, upload, download } =
    useSyncService();
  const { data: localRecords, save, clear } = useLocalDB<DemoRecord>('demo_table');
  const [localCount, setLocalCount] = useState(0);

  const handleAddLocalRecord = async () => {
    await save({
      name: `Record ${Date.now()}`,
      value: Math.floor(Math.random() * 100),
      _synced: false,
    });
    updateLocalCount();
  };

  const handleSync = async () => {
    try {
      await sync(['demo_table', 'products', 'orders']);
      updateLocalCount();
    } catch (err) {
      console.error('Erro ao sincronizar:', err);
    }
  };

  const handleUpload = async () => {
    try {
      await upload();
      updateLocalCount();
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
    }
  };

  const handleDownload = async () => {
    try {
      await download(['demo_table', 'products', 'orders']);
      updateLocalCount();
    } catch (err) {
      console.error('Erro ao fazer download:', err);
    }
  };

  const handleClearLocal = async () => {
    await clear();
    updateLocalCount();
  };

  const updateLocalCount = async () => {
    const count = await LocalDB.count('demo_table');
    setLocalCount(count);
  };

  React.useEffect(() => {
    updateLocalCount();
  }, [localRecords]);

  const unsyncedCount = localRecords.filter((r) => !r._synced).length;
  const progressPercent = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Sync Service - Exemplo</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Status da Sincronização</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Estado:</Text>
          <Text
            style={[
              styles.statusValue,
              syncing && styles.statusValueActive,
            ]}
          >
            {syncing ? 'Sincronizando...' : 'Inativo'}
          </Text>
        </View>
        {syncing && (
          <>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Progresso:</Text>
              <Text style={styles.statusValue}>
                {progress}/{total} ({progressPercent}%)
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPercent}%` },
                ]}
              />
            </View>
          </>
        )}
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Mensagem:</Text>
          <Text style={styles.statusValue}>{message || '-'}</Text>
        </View>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Erro: {error.message}</Text>
          </View>
        )}
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Estatísticas Locais</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{localCount}</Text>
            <Text style={styles.statLabel}>Total Local</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, styles.statValueWarning]}>
              {unsyncedCount}
            </Text>
            <Text style={styles.statLabel}>Não Sincronizados</Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsCard}>
        <Text style={styles.actionsTitle}>Ações</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={handleAddLocalRecord}
          disabled={syncing}
        >
          <Text style={styles.buttonText}>➕ Adicionar Registro Local</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>🔄 Sincronizar Tudo</Text>
          )}
        </TouchableOpacity>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary, styles.buttonHalf]}
            onPress={handleUpload}
            disabled={syncing}
          >
            <Text style={styles.buttonTextSecondary}>⬆️ Upload</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary, styles.buttonHalf]}
            onPress={handleDownload}
            disabled={syncing}
          >
            <Text style={styles.buttonTextSecondary}>⬇️ Download</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.buttonDanger]}
          onPress={handleClearLocal}
          disabled={syncing}
        >
          <Text style={styles.buttonText}>🗑️ Limpar Local</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recordsCard}>
        <Text style={styles.recordsTitle}>
          Registros Locais ({localRecords.length})
        </Text>
        {localRecords.map((record, index) => (
          <View key={record._id || index} style={styles.recordItem}>
            <View style={styles.recordInfo}>
              <Text style={styles.recordName}>{record.name}</Text>
              <Text style={styles.recordValue}>Valor: {record.value}</Text>
            </View>
            <View
              style={[
                styles.syncBadge,
                record._synced && styles.syncBadgeSynced,
              ]}
            >
              <Text style={styles.syncBadgeText}>
                {record._synced ? '✓ Sync' : '⚠ Local'}
              </Text>
            </View>
          </View>
        ))}
        {localRecords.length === 0 && (
          <Text style={styles.emptyText}>Nenhum registro local</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F5F7FA',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#003B71',
    marginBottom: 20,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#718096',
  },
  statusValue: {
    fontSize: 14,
    color: '#2D3748',
    fontWeight: '500',
  },
  statusValueActive: {
    color: '#3182CE',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    marginVertical: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3182CE',
  },
  errorBox: {
    backgroundColor: '#FED7D7',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  errorText: {
    color: '#C53030',
    fontSize: 14,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3182CE',
    marginBottom: 4,
  },
  statValueWarning: {
    color: '#F59E0B',
  },
  statLabel: {
    fontSize: 12,
    color: '#718096',
  },
  actionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#718096',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonPrimary: {
    backgroundColor: '#003B71',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#003B71',
  },
  buttonDanger: {
    backgroundColor: '#E53E3E',
  },
  buttonHalf: {
    flex: 1,
    marginHorizontal: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#003B71',
    fontSize: 16,
    fontWeight: '600',
  },
  recordsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  recordInfo: {
    flex: 1,
  },
  recordName: {
    fontSize: 16,
    color: '#2D3748',
    fontWeight: '500',
  },
  recordValue: {
    fontSize: 14,
    color: '#718096',
    marginTop: 4,
  },
  syncBadge: {
    backgroundColor: '#FED7AA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncBadgeSynced: {
    backgroundColor: '#C6F6D5',
  },
  syncBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D3748',
  },
  emptyText: {
    textAlign: 'center',
    color: '#A0AEC0',
    fontSize: 16,
    marginTop: 20,
  },
});

export default SyncExample;
