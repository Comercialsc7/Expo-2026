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
  const itemsRows = order.items.length
    ? order.items
        .map((item) => {
          const subtotal = item.price * item.quantity;
          return `
            <tr>
              <td style="padding:10px 0;font-size:10px;color:#999;border-bottom:1px solid #f7f7f5;">${escapeHtml(item.code || '')}</td>
              <td style="padding:10px 8px 10px 0;font-size:12px;font-weight:500;color:#1a1a1a;border-bottom:1px solid #f7f7f5;">${escapeHtml(item.name)}</td>
              <td align="center" style="padding:10px 0;font-size:12px;color:#555;border-bottom:1px solid #f7f7f5;">${item.quantity}</td>
              <td align="right" style="padding:10px 0;font-size:11px;color:#777;border-bottom:1px solid #f7f7f5;">${formatCurrency(item.price)}</td>
              <td align="right" style="padding:10px 0;font-size:12px;font-weight:600;color:#1a1a1a;border-bottom:1px solid #f7f7f5;">${formatCurrency(subtotal)}</td>
            </tr>
          `;
        })
        .join('')
    : '<tr><td colspan="5" style="padding:16px 0;font-size:13px;color:#aaa;text-align:center;">Nenhum produto encontrado.</td></tr>';

  const prizes = order.spinPrizes?.length
    ? order.spinPrizes
    : (order.spinPrize ? [order.spinPrize] : []);

  const prizeRows = prizes.slice(0, 5).length
    ? prizes.slice(0, 5).map((prize, index) => {
        const isNoPrize = prize.type === 'no_prize';
        const hasImage = !!prize.photo && prize.photo !== 'null' && prize.photo !== '[null]';
        const imageCell = hasImage
          ? `<img src="${escapeHtml(prize.photo || '')}" width="42" height="42" style="display:block;width:42px;height:42px;object-fit:cover;border-radius:8px;border:1px solid #eee;">`
          : `<div style="width:42px;height:42px;border-radius:8px;background:#f5f5f3;border:1px dashed #ddd;text-align:center;line-height:42px;font-size:18px;">${isNoPrize ? '🙁' : '🎁'}</div>`;
        const badge = isNoPrize
          ? '<span style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.04em;">Sem prêmio</span>'
          : '<span style="font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.04em;">Prêmio</span>';
        const border = index < Math.min(prizes.length, 5) - 1 ? 'border-bottom:1px solid #f0f0ed;' : '';

        return `
          <table width="100%" cellpadding="0" cellspacing="0" style="${border}">
            <tr>
              <td width="56" style="vertical-align:middle;padding:10px 14px 10px 0;">${imageCell}</td>
              <td style="vertical-align:middle;padding:10px 0;">
                <div style="font-size:13px;font-weight:600;color:#1a1a1a;margin-bottom:2px;">${escapeHtml(prize.description || 'Prêmio')}</div>
                <div style="font-size:11px;color:#bbb;margin-bottom:4px;">Giro ${index + 1} de ${Math.min(prizes.length, 5)}</div>
                ${badge}
              </td>
            </tr>
          </table>
        `;
      }).join('')
    : '<div style="font-size:13px;color:#aaa;">Nenhum prêmio vinculado a este pedido.</div>';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novo Pedido</title>
</head>
<body style="margin:0;padding:0;background:#f0f0ed;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0ed;padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <tr>
          <td style="padding-bottom:12px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#00558f;border-radius:20px;padding:5px 12px;">
                  <span style="font-size:10px;font-weight:700;color:#ffffff;letter-spacing:0.08em;text-transform:uppercase;">Novo pedido · ${escapeHtml(getDisplayOrderNumber(order))}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e2dc;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#00558f;">
              <tr>
                <td style="padding:22px 26px 20px 26px;border-bottom:1px solid #004a7a;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;line-height:1.2;">${escapeHtml(order.client.name)}</div>
                        <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:3px;">Cód. ${escapeHtml(order.client.code)} · Vendedor ${escapeHtml(order.sellerCode || '-')}</div>
                      </td>
                      <td align="right" style="vertical-align:top;">
                        <div style="font-size:11px;color:rgba(255,255,255,0.55);">${escapeHtml(order.paymentTerm.description)} (${order.paymentTerm.prazo_dias || 0} dias)</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:20px 26px 0 26px;">
                  <div style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Produtos</div>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <thead>
                      <tr>
                        <th align="left" width="14%" style="font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:8px;border-bottom:1px solid #f0f0ed;">Código</th>
                        <th align="left" style="font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:8px;border-bottom:1px solid #f0f0ed;">Descrição</th>
                        <th align="center" width="8%" style="font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:8px;border-bottom:1px solid #f0f0ed;">Qtd</th>
                        <th align="right" width="15%" style="font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:8px;border-bottom:1px solid #f0f0ed;">Unit.</th>
                        <th align="right" width="18%" style="font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:8px;border-bottom:1px solid #f0f0ed;">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsRows}
                    </tbody>
                  </table>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:0 26px 22px 26px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf8;border-radius:10px;padding:14px 16px;margin-top:16px;">
                    <tr>
                      <td style="padding-bottom:6px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size:12px;color:#999;">Subtotal</td>
                            <td align="right" style="font-size:12px;color:#555;">${formatCurrency(order.subtotal)}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:10px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size:12px;color:#999;">Desconto</td>
                            <td align="right" style="font-size:12px;color:#059669;font-weight:600;">- ${formatCurrency(order.discount || 0)}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="border-top:1px solid #e8e8e4;padding-top:12px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size:13px;font-weight:600;color:#1a1a1a;">Total</td>
                            <td align="right" style="font-size:20px;font-weight:700;color:#00558f;letter-spacing:-0.02em;">${formatCurrency(order.total)}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #f0f0ed;"></td></tr></table>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff2dc;border-top:1px solid #f59e0b;border-bottom:1px solid #f59e0b;">
              <tr>
                <td style="padding:14px 26px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="52" style="vertical-align:middle;padding-right:14px;">
                        <div style="width:42px;height:42px;border-radius:9px;background:#fdc96b;text-align:center;line-height:42px;font-size:20px;">🎟️</div>
                      </td>
                      <td style="vertical-align:middle;">
                        <div style="font-size:11px;color:#854f0b;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">Bilhetes de sorteio</div>
                        <div style="font-size:12px;color:#633806;">Este pedido gerou tickets para o sorteio</div>
                      </td>
                      <td align="right" style="vertical-align:middle;">
                        <div style="display:inline-block;background:#00558f;color:#ffffff;font-size:12px;font-weight:700;border-radius:999px;padding:7px 14px;white-space:nowrap;">${order.ticketsMoto || 0} tickets</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #f0f0ed;"></td></tr></table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:20px 26px 24px 26px;">
                  <div style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Prêmios vinculados</div>
                  ${prizeRows}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 0 0 0;text-align:center;">
            <span style="font-size:11px;color:#bbb;">Mensagem automática · Sistema de pedidos da feira</span>
          </td>
        </tr>

      </table>
    </td>
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

  const handleShareOrder = useCallback(async (order: CachedOrder) => {
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
        onShare={handleShareOrder}
        sharing={!!selectedOrder && sharingOrderId === selectedOrder.id}
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
