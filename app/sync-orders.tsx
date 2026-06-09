import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, Image, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useNavigation } from '../hooks/useNavigation';
import { useCachedOrdersStore, CachedOrder } from '../store/useCachedOrdersStore';
import { OrderItem } from './components/OrderItem';
import { OrderDetailsModal } from './components/OrderDetailsModal';
import { styles } from './styles/_sync-orders.styles';
import { useSyncService } from '../hooks/useSyncService';
import { ConnectionBadge } from '../components/shared/ConnectionBadge';
import OfflineMutationQueue from '../lib/OfflineMutationQueue';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { syncCachedOrdersSpinPrizes } from '../lib/spinPrizeSync';

const closeIcon = require('../assets/images/x.png');
const backIcon = require('../assets/images/voltar.png');
const syncWebhookUrl =
  process.env.EXPO_PUBLIC_SYNC_WEBHOOK_URL ||
  Constants.expoConfig?.extra?.syncWebhookUrl ||
  '';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);

const escapeHtml = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const getDisplayOrderNumber = (order: CachedOrder) =>
  order.shortOrderNumber || String(order.id || '').slice(-8);

const buildOrderPdfHtml = (order: CachedOrder) => {
  const itemsHtml = order.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td style="text-align:center;">${item.quantity}</td>
          <td style="text-align:right;">${formatCurrency(item.price)}</td>
          <td style="text-align:right;">${formatCurrency(item.price * item.quantity)}</td>
        </tr>
      `
    )
    .join('');

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #222; padding: 20px; }
          h1 { color: #003B71; margin: 0 0 8px; }
          h2 { color: #003B71; margin: 20px 0 8px; font-size: 16px; }
          .meta { margin-bottom: 4px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
          th { background: #f3f6fb; text-align: left; }
          .totals { margin-top: 16px; width: 100%; }
          .totals td { border: none; padding: 4px 0; font-size: 13px; }
          .totals .label { text-align: right; color: #666; padding-right: 8px; }
          .totals .value { text-align: right; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>Pedido ${escapeHtml(getDisplayOrderNumber(order))}</h1>
        <div class="meta">Cliente: ${escapeHtml(order.client.name)}</div>
        <div class="meta">Código cliente: ${escapeHtml(order.client.code)}</div>
        <div class="meta">CNPJ: ${escapeHtml(order.client.cnpj)}</div>
        <div class="meta">Vendedor: ${escapeHtml(order.sellerCode || '-')}</div>
        <div class="meta">Condição: ${escapeHtml(order.paymentTerm.description)} (${order.paymentTerm.prazo_dias || 0} dias)</div>
        <div class="meta">Data: ${escapeHtml(new Date(order.timestamp).toLocaleString('pt-BR'))}</div>

        <h2>Itens do Pedido</h2>
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th style="text-align:center;">Qtd</th>
              <th style="text-align:right;">Valor</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <table class="totals">
          <tr>
            <td class="label">Subtotal:</td>
            <td class="value">${formatCurrency(order.subtotal)}</td>
          </tr>
          <tr>
            <td class="label">Desconto:</td>
            <td class="value">${formatCurrency(order.discount || 0)}</td>
          </tr>
          <tr>
            <td class="label">Total:</td>
            <td class="value">${formatCurrency(order.total)}</td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

export default function SyncOrdersScreen() {
  const syncTables = useMemo(
    () => ['teams', 'users', 'brands', 'prazos', 'relacao_prazo', 'clients', 'products', 'escalonada', 'pedidos'],
    []
  );

  const { goBack } = useNavigation();
  const { cachedOrders, _hasHydrated, removeCachedOrder, updateCachedOrder } = useCachedOrdersStore();
  const { syncing, progress, total, message, error: syncError, upload, download, downloadTable } = useSyncService();
  const isOnline = useOnlineStatus();
  const [selectedOrder, _setSelectedOrder] = useState<CachedOrder | null>(null);
  const [isDeleteConfirmModalVisible, setIsDeleteConfirmModalVisible] = useState(false);
  const [orderIdToDelete, setOrderIdToDelete] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [sharingOrderId, setSharingOrderId] = useState<string | null>(null);
  const [requiresManualUpdate, setRequiresManualUpdate] = useState(false);
  const [showReconnectNotice, setShowReconnectNotice] = useState(false);
  const [lastNoticeDismissAt, setLastNoticeDismissAt] = useState<number | null>(null);
  const previousOnlineRef = useRef<boolean | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webhookTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const blurActiveElementOnWeb = useCallback(() => {
    if (typeof document === 'undefined') return;
    const active = document.activeElement as HTMLElement | null;
    if (active && typeof active.blur === 'function') {
      active.blur();
    }
  }, []);

  const setSelectedOrder = useCallback((order: CachedOrder | null) => {
    blurActiveElementOnWeb();
    console.log('setSelectedOrder chamado com:', order?.id);
    _setSelectedOrder(order);
  }, [blurActiveElementOnWeb]);

  const refreshPendingCount = useCallback(async () => {
    try {
      const stats = await OfflineMutationQueue.getStats();
      setPendingCount(stats.pending);
    } catch (error) {
      console.error('Erro ao contar registros pendentes:', error);
    }
  }, []);

  const scheduleDelayedSyncWebhook = useCallback((pendingOrdersCount: number) => {
    if (!syncWebhookUrl) {
      console.warn('[SyncOrders] EXPO_PUBLIC_SYNC_WEBHOOK_URL não configurada.');
      return;
    }

    if (webhookTimerRef.current) {
      clearTimeout(webhookTimerRef.current);
      webhookTimerRef.current = null;
    }

    webhookTimerRef.current = setTimeout(async () => {
      const payload = {
        event: 'send_pending_clicked',
        triggeredAt: new Date().toISOString(),
        pendingOrders: pendingOrdersCount,
      };

      try {
        const getUrl = new URL(syncWebhookUrl);
        getUrl.searchParams.set('event', payload.event);
        getUrl.searchParams.set('triggeredAt', payload.triggeredAt);
        getUrl.searchParams.set('pendingOrders', String(payload.pendingOrders));

        const getResponse = await fetch(getUrl.toString(), { method: 'GET' });
        if (!getResponse.ok) {
          const getResponseText = await getResponse.text();
          throw new Error(`Webhook GET retornou ${getResponse.status}: ${getResponseText}`);
        }

        console.log(`[SyncOrders] Webhook (GET) disparado com sucesso (${pendingOrdersCount} pendências).`);
      } catch (webhookError) {
        console.error('[SyncOrders] Falha ao disparar webhook de envio de pendências:', webhookError);
      } finally {
        webhookTimerRef.current = null;
      }
    }, 30000);
  }, []);

  useEffect(() => {
    if (!syncing) {
      void refreshPendingCount();
    }
  }, [refreshPendingCount, syncing]);

  useEffect(() => {
    const previous = previousOnlineRef.current;

    if (previous === null) {
      previousOnlineRef.current = isOnline;
      return;
    }

    if (!previous && isOnline) {
      setRequiresManualUpdate(true);
      setShowReconnectNotice(true);
      setLastNoticeDismissAt(null);
    }

    previousOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }

    if (!requiresManualUpdate || !isOnline || showReconnectNotice || !lastNoticeDismissAt) {
      return;
    }

    const elapsed = Date.now() - lastNoticeDismissAt;
    const waitMs = Math.max(0, 45000 - elapsed);

    noticeTimerRef.current = setTimeout(() => {
      if (isOnline && requiresManualUpdate) {
        setShowReconnectNotice(true);
      }
    }, waitMs);

    return () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
    };
  }, [requiresManualUpdate, isOnline, showReconnectNotice, lastNoticeDismissAt]);

  useEffect(() => () => {
    if (webhookTimerRef.current) {
      clearTimeout(webhookTimerRef.current);
      webhookTimerRef.current = null;
    }
  }, []);

  const dismissReconnectNotice = useCallback(() => {
    setShowReconnectNotice(false);
    setLastNoticeDismissAt(Date.now());
  }, []);

  const handleDeleteOrder = useCallback((orderId: string) => {
    blurActiveElementOnWeb();
    console.log('handleDeleteOrder chamado para o pedido:', orderId);
    setOrderIdToDelete(orderId);
    setIsDeleteConfirmModalVisible(true);
  }, [blurActiveElementOnWeb]);

  const confirmDeleteOrder = useCallback(() => {
    if (orderIdToDelete) {
      blurActiveElementOnWeb();
      console.log('Confirmando exclusão do pedido:', orderIdToDelete);
      removeCachedOrder(orderIdToDelete);
      setSelectedOrder(null); // Fecha o modal de detalhes após a exclusão
      setIsDeleteConfirmModalVisible(false); // Fecha o modal de confirmação
      Alert.alert('Sucesso', 'Pedido removido do cache.');
    }
  }, [orderIdToDelete, removeCachedOrder, setSelectedOrder, blurActiveElementOnWeb]);

  const cancelDeleteOrder = useCallback(() => {
    blurActiveElementOnWeb();
    console.log('Exclusão cancelada.');
    setOrderIdToDelete(null);
    setIsDeleteConfirmModalVisible(false);
  }, [blurActiveElementOnWeb]);

  const applySyncedSpinPrizePhotos = useCallback((
    syncedOrders: { orderId: string; publicUrl: string | null; publicUrls?: string[] }[],
  ) => {
    syncedOrders.forEach(({ orderId, publicUrl, publicUrls }) => {
      updateCachedOrder(orderId, (order) => ({
        ...order,
        spinPrizes: order.spinPrizes?.length
          ? order.spinPrizes.map((prize, index) => {
              const nextPhoto = publicUrls?.[index] || prize.photo;
              return {
                ...prize,
                photo: nextPhoto,
                photoSynced: !prize.photo || !!nextPhoto,
              };
            })
          : order.spinPrizes,
        spinPrize: order.spinPrize
          ? {
              ...order.spinPrize,
              photo: publicUrl || order.spinPrize.photo,
              photoSynced: !order.spinPrize.photo || !!publicUrl,
            }
          : order.spinPrize,
      }));
    });
  }, [updateCachedOrder]);

  const handleSyncUpload = useCallback(async () => {
    try {
      if (!isOnline) {
        Alert.alert('Sem conexão', 'Conecte-se à internet para enviar os pedidos e as fotos da roleta.');
        return;
      }

      const pendingOrders = cachedOrders.filter((order) => !order.enviado);
      scheduleDelayedSyncWebhook(pendingOrders.length);

      const spinPrizeResult = await syncCachedOrdersSpinPrizes(pendingOrders);
      applySyncedSpinPrizePhotos(spinPrizeResult.synced);

      const hasSpinPrizeFailures = spinPrizeResult.failed.length > 0;
      if (spinPrizeResult.failed.length > 0) {
        console.warn('Falhas ao sincronizar fotos dos prêmios:', spinPrizeResult.failed);
      }

      await upload();
      await refreshPendingCount();

      if (hasSpinPrizeFailures) {
        Alert.alert(
          'Sincronização parcial',
          `Pedidos enviados, mas ${spinPrizeResult.failed.length} item(ns) de foto da roleta falharam. Verifique as policies do bucket.`
        );
        return;
      }

      Alert.alert('Sucesso', 'Pendências enviadas com sucesso!');
    } catch {
      Alert.alert('Erro', 'Falha ao enviar pendências. Tente novamente.');
    }
  }, [applySyncedSpinPrizePhotos, cachedOrders, isOnline, refreshPendingCount, scheduleDelayedSyncWebhook, upload]);

  const handleSyncDownload = useCallback(async () => {
    try {
      // Download completo dos dados necessários para operação offline
      await download(syncTables, 180000);

      Alert.alert('Sucesso', 'Dados atualizados do servidor!');
      setRequiresManualUpdate(false);
      setShowReconnectNotice(false);
      setLastNoticeDismissAt(null);
    } catch {
      Alert.alert('Erro', 'Falha ao baixar dados. Tente novamente.');
    }
  }, [download, syncTables]);

  const handleShareOrderPdf = useCallback(async (order: CachedOrder) => {
    try {
      setSharingOrderId(order.id);
      const html = buildOrderPdfHtml(order);

      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        Alert.alert('PDF pronto', 'A visualização de impressão foi aberta. Escolha "Salvar como PDF" para compartilhar.');
        return;
      }

      const result = await Print.printToFileAsync({ html });
      const isSharingAvailable = await Sharing.isAvailableAsync();

      if (!isSharingAvailable) {
        Alert.alert('Compartilhamento indisponível', 'Seu dispositivo não suporta compartilhamento de arquivos neste momento.');
        return;
      }

      await Sharing.shareAsync(result.uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Compartilhar Pedido ${getDisplayOrderNumber(order)}`,
      });
    } catch (error) {
      console.error('Erro ao compartilhar PDF do pedido:', error);
      Alert.alert('Erro', 'Não foi possível gerar ou compartilhar o PDF deste pedido.');
    } finally {
      setSharingOrderId(null);
    }
  }, []);

  const handleFullSync = useCallback(async () => {
    try {
      if (!isOnline) {
        Alert.alert('Sem conexão', 'Conecte-se à internet para sincronizar os pedidos.');
        return;
      }

      const pendingOrders = cachedOrders.filter((order) => !order.enviado);
      const spinPrizeResult = await syncCachedOrdersSpinPrizes(pendingOrders);
      applySyncedSpinPrizePhotos(spinPrizeResult.synced);

      if (spinPrizeResult.failed.length > 0) {
        console.warn('Falhas ao sincronizar fotos dos prêmios:', spinPrizeResult.failed);
      }

      // 1) Envia pendências locais
      await upload();

      const downloadedTables: string[] = [];
      const failedTables: { table: string; message: string }[] = [];

      // 2) Força download completo de cada tabela crítica para garantir cache offline
      for (const table of syncTables) {
        try {
          await downloadTable(table, true, 180000);
          downloadedTables.push(table);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'erro desconhecido';
          failedTables.push({ table, message: errorMessage });
          console.error(`Falha ao baixar tabela '${table}' durante sincronização completa:`, error);
        }
      }

      if (failedTables.length > 0) {
        const syncedSummary = downloadedTables.length > 0
          ? `Atualizadas: ${downloadedTables.join(', ')}.`
          : 'Nenhuma tabela foi atualizada.';
        const failedSummary = failedTables
          .map(({ table, message }) => `${table}: ${message}`)
          .join('\n');

        Alert.alert(
          'Sincronização parcial',
          `${syncedSummary}\nFalharam:\n${failedSummary}`,
        );
        return;
      }

      Alert.alert('Sucesso', 'Sincronização completa concluída!');
      setRequiresManualUpdate(false);
      setShowReconnectNotice(false);
      setLastNoticeDismissAt(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'erro desconhecido';
      Alert.alert('Erro', `Falha na sincronização: ${errorMessage}`);
    }
  }, [applySyncedSpinPrizePhotos, cachedOrders, downloadTable, isOnline, upload, syncTables]);

  const renderSyncStatus = useCallback(() => {
    if (!syncing && !syncError && !message) return null;

    return (
      <View style={styles.syncStatus}>
        {syncing && (
          <>
            <Text style={styles.syncStatusText}>{message}</Text>
            {total > 0 && (
              <>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.round((progress / total) * 100)}%` }
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {progress}/{total} ({Math.round((progress / total) * 100)}%)
                </Text>
              </>
            )}
          </>
        )}
        {!syncing && syncError && (
          <Text style={[styles.syncStatusText, styles.errorText]}>
            Erro: {syncError.message}
          </Text>
        )}
        {!syncing && !syncError && !!message && (
          <Text style={[styles.syncStatusText, styles.successText]}>
            {message}
          </Text>
        )}
      </View>
    );
  }, [message, progress, syncError, syncing, total]);

  const renderOrderItem = useCallback(({ item }: { item: CachedOrder }) => (
    <OrderItem
      item={item}
      enviado={!!item.enviado}
      onPress={setSelectedOrder}
    />
  ), [setSelectedOrder]);

  const renderListHeader = useCallback(() => (
    <View style={styles.content}>
      <Text style={styles.descriptionText}>Gerencie o envio e recebimento de dados de pedidos.</Text>

      {showReconnectNotice && requiresManualUpdate && isOnline && (
        <View style={styles.reconnectNotice}>
          <Text style={styles.reconnectNoticeText}>
            Conexão restabelecida. Realize &quot;Atualizar Dados&quot; para recarregar o cache offline.
          </Text>
          <TouchableOpacity
            onPress={dismissReconnectNotice}
            style={styles.reconnectNoticeCloseButton}
            accessibilityLabel="Fechar aviso de atualização"
          >
            <Text style={styles.reconnectNoticeCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Registros Pendentes</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{cachedOrders.length}</Text>
          <Text style={styles.statLabel}>Pedidos em Cache</Text>
        </View>
      </View>

      {renderSyncStatus()}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.sendButton,
            syncing && styles.buttonDisabled
          ]}
          onPress={handleSyncUpload}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>⬆️ Enviar Pendências</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.receiveButton,
            syncing && styles.buttonDisabled
          ]}
          onPress={handleSyncDownload}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>⬇️ Atualizar Dados</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.syncButton,
            syncing && styles.buttonDisabled
          ]}
          onPress={handleFullSync}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>🔄 Sincronizar Tudo</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.cachedOrdersSection}>
        <Text style={styles.cachedOrdersTitle}>Pedidos em Cache:</Text>
      </View>
    </View>
  ), [
    cachedOrders.length,
    dismissReconnectNotice,
    handleFullSync,
    handleSyncDownload,
    handleSyncUpload,
    isOnline,
    pendingCount,
    renderSyncStatus,
    requiresManualUpdate,
    showReconnectNotice,
    syncing,
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Image source={backIcon} style={{ width: 24, height: 24 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sincronização</Text>
        <View style={styles.headerBadge}>
          <ConnectionBadge isOnlineOverride={isOnline} />
        </View>
      </View>
      <FlatList
        data={_hasHydrated ? cachedOrders : []}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={
          !_hasHydrated ? (
            <ActivityIndicator size="large" color="#003B71" />
          ) : (
            <Text style={styles.noOrdersText}>Nenhum pedido em cache no momento.</Text>
          )
        }
        contentContainerStyle={styles.scrollViewContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={8}
        removeClippedSubviews
      />

      <OrderDetailsModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onDelete={handleDeleteOrder}
        onSharePdf={handleShareOrderPdf}
        sharingPdf={!!selectedOrder && sharingOrderId === selectedOrder.id}
        visible={!!selectedOrder && !isDeleteConfirmModalVisible}
      />

      {/* Custom Delete Confirmation Modal */}
      <Modal
        visible={isDeleteConfirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelDeleteOrder}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirmar Exclusão</Text>
              <TouchableOpacity onPress={cancelDeleteOrder} style={styles.closeButton}>
                <Image source={closeIcon} style={{ width: 24, height: 24 }} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.detailText}>
                Tem certeza que deseja excluir este pedido do cache? Esta ação não pode ser desfeita.
              </Text>
              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[styles.button, styles.receiveButton]} 
                  onPress={cancelDeleteOrder}
                >
                  <Text style={styles.buttonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.button, styles.sendButton]} 
                  onPress={confirmDeleteOrder}
                >
                  <Text style={styles.buttonText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
