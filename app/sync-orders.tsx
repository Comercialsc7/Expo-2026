import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, Alert, Modal, Image, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { useNavigation } from '../hooks/useNavigation';
import { useCachedOrdersStore, CachedOrder } from '../store/useCachedOrdersStore';
import { supabase } from '../lib/supabase';
import { decode } from 'base64-arraybuffer';
import { OrderItem } from './components/OrderItem';
import { OrderDetailsModal } from './components/OrderDetailsModal';
import { styles } from './styles/_sync-orders.styles';
import { useSyncService } from '../hooks/useSyncService';
import SQLiteStore from '../lib/SQLiteStore';
import { ConnectionBadge } from '../components/shared/ConnectionBadge';
import OfflineSQLiteService from '../lib/OfflineSQLiteService';
import OfflineMutationQueue from '../lib/OfflineMutationQueue';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const closeIcon = require('../assets/images/x.png');
const backIcon = require('../assets/images/voltar.png');
const lixeiraIcon = require('../assets/images/lixeira.png');

export default function SyncOrdersScreen() {
  const syncTables = ['pedidos', 'products', 'clients', 'teams', 'brands', 'users', 'prazos', 'relacao_prazo'];

  const { goBack } = useNavigation();
  const { cachedOrders, clearCachedOrders, getOrderById, _hasHydrated, removeCachedOrder } = useCachedOrdersStore();
  const { syncing, progress, total, message, error: syncError, sync, upload, download, downloadTable } = useSyncService();
  const isOnline = useOnlineStatus();
  const [isSending, setIsSending] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [selectedOrder, _setSelectedOrder] = useState<CachedOrder | null>(null);
  const [isDeleteConfirmModalVisible, setIsDeleteConfirmModalVisible] = useState(false);
  const [orderIdToDelete, setOrderIdToDelete] = useState<string | null>(null);
  const [sentOrders, setSentOrders] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [requiresManualUpdate, setRequiresManualUpdate] = useState(false);
  const [showReconnectNotice, setShowReconnectNotice] = useState(false);
  const [lastNoticeDismissAt, setLastNoticeDismissAt] = useState<number | null>(null);
  const previousOnlineRef = useRef<boolean | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    async function countPending() {
      try {
        const stats = await OfflineMutationQueue.getStats();
        setPendingCount(stats.pending);
      } catch (error) {
        console.error('Erro ao contar registros pendentes:', error);
      }
    }
    countPending();
    const interval = setInterval(countPending, 3000);
    return () => clearInterval(interval);
  }, [syncing]);

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

  const dismissReconnectNotice = useCallback(() => {
    setShowReconnectNotice(false);
    setLastNoticeDismissAt(Date.now());
  }, []);

  const handleSendData = useCallback(async () => {
    try {
      setIsSending(true);
      setSyncStatus('idle');

      if (cachedOrders.length === 0) {
        Alert.alert('Nenhum pedido', 'Não há pedidos em cache para enviar.');
        setIsSending(false);
        return;
      }

      const sentIds: string[] = [];
      for (const order of cachedOrders) {
        if (sentOrders.includes(order.id)) {
          // Ignora pedidos já enviados
          continue;
        }

        let prizePhotoUrl: string | null = null;

        // 1. Upload da imagem do prêmio, se existir
        if (order.spinPrize?.photo) {
          // Se for uma URI local (file://), converte para Blob
          let blob = null;
          try {
            const response = await fetch(order.spinPrize.photo);
            blob = await response.blob();
          } catch (e) {
            console.error('Erro ao converter foto em Blob:', e);
            Alert.alert('Erro', `Falha ao processar a imagem do prêmio para o pedido ${order.id}.`);
            throw e;
          }
          const fileName = `spin_prize_${order.id}_${Date.now()}.png`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('spinprizeimages')
            .upload(fileName, blob, { contentType: 'image/png' });

          if (uploadError) {
            console.error('Erro ao fazer upload da imagem do prêmio:', uploadError);
            Alert.alert('Erro', `Falha ao fazer upload da imagem do prêmio para o pedido ${order.id}.`);
            throw uploadError;
          }
          // Use o método getPublicUrl do cliente Supabase quando disponível
          try {
            const publicUrlResult = supabase.storage.from('spinprizeimages').getPublicUrl(fileName);
            // compatibiliza com retorno que pode estar em { data: { publicUrl } }
            if (publicUrlResult && (publicUrlResult as any).data && (publicUrlResult as any).data.publicUrl) {
              prizePhotoUrl = (publicUrlResult as any).data.publicUrl;
            } else if ((publicUrlResult as any).publicUrl) {
              prizePhotoUrl = (publicUrlResult as any).publicUrl;
            } else {
              // fallback para montar manualmente com variável de ambiente
              const base = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
              prizePhotoUrl = `${base}/storage/v1/object/public/spinprizeimages/${fileName}`;
            }
          } catch (e) {
            const base = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
            prizePhotoUrl = `${base}/storage/v1/object/public/spinprizeimages/${fileName}`;
          }
        }

        // 2. Montar array de produtos
        const produtos = order.items.map(item => ({
          produto_id: item.code,
          produto_nome: item.name,
          quantidade: item.quantity,
          preco_unitario: item.price,
          desconto: item.discount,
          embalagem: item.box,
          acelerador: item.isAccelerator
        }));

        // NOVO: Verificar se o pedido já existe no banco
        const { data: existing, error: checkError } = await supabase
          .from('pedidos')
          .select('pedido_id')
          .eq('pedido_id', order.id)
          .single();
        if (checkError && checkError.code !== 'PGRST116') {
          // PGRST116 = Not found, pode ignorar
          console.error('Erro ao verificar pedido existente:', checkError);
          continue;
        }
        if (existing) {
          // Já existe, não insere de novo
          console.log(`Pedido ${order.id} já existe no banco, pulando inserção.`);
          sentIds.push(order.id);
          continue;
        }

        // 3. Inserir o pedido na tabela 'pedidos'
        const { error: insertError } = await supabase
          .from('pedidos')
          .insert({
            pedido_id: order.id,
            vendedor_codigo: order.sellerCode,
            cliente_code: order.client.code,
            cliente_nome: order.client.name,
            email: order.email ? order.email : '',
            produtos: produtos,
            subtotal: order.subtotal,
            desconto: order.discount,
            total: order.total,
            prazo_pagamento: order.paymentTerm?.description || '',
            premio_imagem_url: prizePhotoUrl,
            status_envio: 'pendente',
          });

        if (insertError) {
          console.error('Erro ao inserir pedido:', insertError);
          Alert.alert('Erro', `Falha ao salvar o pedido ${order.id} na tabela de pedidos.`);
          throw insertError;
        }
        sentIds.push(order.id);
      }
      setSentOrders((prev) => [...prev, ...sentIds]);
      setSyncStatus('success');
      Alert.alert('Sucesso', 'Dados enviados com sucesso!');
    } catch (error) {
      setSyncStatus('error');
      console.error('Erro geral ao enviar dados:', error);
      Alert.alert('Erro', 'Falha ao enviar dados. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  }, [cachedOrders, clearCachedOrders, sentOrders]);

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

  const handleReceiveData = useCallback(async () => {
    try {
      setIsReceiving(true);
      setSyncStatus('idle');

      await new Promise(resolve => setTimeout(resolve, 2000));

      setSyncStatus('success');
      Alert.alert('Sucesso', 'Dados recebidos com sucesso!');
    } catch (error) {
      setSyncStatus('error');
      Alert.alert('Erro', 'Falha ao receber dados. Tente novamente.');
    } finally {
      setIsReceiving(false);
    }
  }, []);

  const handleSyncUpload = useCallback(async () => {
    try {
      await upload();
      Alert.alert('Sucesso', 'Pendências enviadas com sucesso!');
    } catch (error) {
      Alert.alert('Erro', 'Falha ao enviar pendências. Tente novamente.');
    }
  }, [upload]);

  const handleSyncDownload = useCallback(async () => {
    try {
      // Download completo dos dados necessários para operação offline
      await download(syncTables, 60000);

      // Espelha também em SQLite para telas sqlite-first
      for (const table of syncTables) {
        try {
          const localRecords = await SQLiteStore.getAll(table);
          const payloads = localRecords.map((record) => record.payload);
          await OfflineSQLiteService.replaceTable(table, payloads);
        } catch (sqliteError) {
          console.warn(`⚠️ Falha ao espelhar '${table}' para SQLite após download:`, sqliteError);
        }
      }

      Alert.alert('Sucesso', 'Dados atualizados do servidor!');
      setRequiresManualUpdate(false);
      setShowReconnectNotice(false);
      setLastNoticeDismissAt(null);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao baixar dados. Tente novamente.');
    }
  }, [download, syncTables]);

  const handleFullSync = useCallback(async () => {
    try {
      // 1) Envia pendências locais
      await upload();

      // 2) Força download completo de cada tabela crítica para garantir cache offline
      for (const table of syncTables) {
        await downloadTable(table, true);

        // 3) Espelha os dados no SQLite para persistência offline robusta
        try {
          const localRecords = await SQLiteStore.getAll(table);
          const payloads = localRecords.map((record) => record.payload);
          await OfflineSQLiteService.replaceTable(table, payloads);
        } catch (sqliteError) {
          console.warn(`⚠️ Falha ao espelhar '${table}' para SQLite:`, sqliteError);
        }
      }

      Alert.alert('Sucesso', 'Sincronização completa concluída!');
      setRequiresManualUpdate(false);
      setShowReconnectNotice(false);
      setLastNoticeDismissAt(null);
    } catch (error) {
      Alert.alert('Erro', 'Falha na sincronização. Tente novamente.');
    }
  }, [upload, downloadTable, syncTables]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const renderSyncStatus = () => {
    if (!syncing && syncStatus === 'idle' && !syncError) return null;

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
        {!syncing && syncStatus === 'success' && (
          <Text style={[styles.syncStatusText, styles.successText]}>
            Sincronização concluída!
          </Text>
        )}
      </View>
    );
  };

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
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.content}>
          <Text style={styles.descriptionText}>Gerencie o envio e recebimento de dados de pedidos.</Text>

          {showReconnectNotice && requiresManualUpdate && isOnline && (
            <View style={styles.reconnectNotice}>
              <Text style={styles.reconnectNoticeText}>
                Conexão restabelecida. Realize "Atualizar Dados" para recarregar o cache offline.
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
            {!_hasHydrated ? (
              <ActivityIndicator size="large" color="#003B71" />
            ) : cachedOrders.length === 0 ? (
              <Text style={styles.noOrdersText}>Nenhum pedido em cache no momento.</Text>
            ) : (
              <FlatList
                data={cachedOrders}
                renderItem={({ item }) => (
                  <OrderItem
                    item={item}
                    enviado={sentOrders.includes(item.id)}
                    onPress={setSelectedOrder}
                  />
                )}
                keyExtractor={(item) => item.id}
                nestedScrollEnabled={true}
              />
            )}
          </View>
        </View>
      </ScrollView>

      <OrderDetailsModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onDelete={handleDeleteOrder}
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
