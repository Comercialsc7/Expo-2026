import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useOfflineCache } from '@/hooks/useOfflineCache';

/**
 * Botão para preparar app para modo offline
 *
 * Mostra status e permite preparar o cache
 */
export function OfflinePrepareButton() {
  const { ready, preparing, info, prepare, isOnline } = useOfflineCache();

  const handlePrepare = async () => {
    if (!isOnline) {
      Alert.alert('Sem conexão', 'Você precisa estar online para preparar o modo offline');
      return;
    }

    Alert.alert(
      'Preparar Modo Offline',
      'Isso irá baixar todos os dados necessários para trabalhar sem conexão. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Preparar',
          onPress: async () => {
            const result = await prepare([
              'teams',
              'products',
              'clients',
              'brands',
              'users',
              'prazos',
              'relacao_prazo',
              'pedidos',
            ]);

            if (result.success) {
              Alert.alert(
                'Sucesso!',
                `App preparado para modo offline!\n\n` +
                `Dados em cache: ${result.cached.join(', ')}`
              );
            } else {
              Alert.alert(
                'Atenção',
                `Preparação concluída com alguns erros:\n\n` +
                `Sucesso: ${result.cached.join(', ')}\n` +
                `Erros: ${result.errors.join(', ')}`
              );
            }
          },
        },
      ]
    );
  };

  const getStatusText = () => {
    if (!isOnline) {
      return ready ? '🔴 Offline (Pronto)' : '🔴 Offline (Não Preparado)';
    }
    return ready ? '🟢 Online (Pronto)' : '🟡 Online (Não Preparado)';
  };

  const getStatusColor = () => {
    if (!isOnline) {
      return ready ? '#10b981' : '#ef4444';
    }
    return ready ? '#10b981' : '#f59e0b';
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{getStatusText()}</Text>
        {ready && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              ✓ Sessão salva
            </Text>
            <Text style={styles.infoText}>
              ✓ {info.tablesCount} tabelas em cache
            </Text>
            {info.cachedAt && (
              <Text style={styles.infoText}>
                ✓ Atualizado: {formatDate(info.cachedAt)}
              </Text>
            )}
          </View>
        )}
      </View>

      {isOnline && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: ready ? '#6366f1' : '#10b981' }]}
          onPress={handlePrepare}
          disabled={preparing}
        >
          {preparing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {ready ? '🔄 Atualizar Cache' : '📥 Preparar Modo Offline'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {!ready && !isOnline && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>
            ⚠️ Para trabalhar offline, você precisa preparar o app enquanto estiver online
          </Text>
        </View>
      )}
    </View>
  );
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffMinutes < 1) return 'agora';
  if (diffMinutes < 60) return `${diffMinutes} min atrás`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h atrás`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d atrás`;
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statusContainer: {
    marginBottom: 12,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoContainer: {
    paddingLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  warningText: {
    fontSize: 14,
    color: '#92400e',
  },
});
