/**
 * EXEMPLOS DE USO - SmartRequest
 *
 * Como migrar código existente para usar SmartRequest
 * e ter suporte offline automático
 */

import SmartRequest from './SmartRequest';
import { supabase } from './supabase';
import { nanoid } from 'nanoid/non-secure';

// ============================================
// EXEMPLO 1: Criar Pedido
// ============================================

// ❌ ANTES (só funciona online)
async function createOrderOld(orderData: any) {
  const { data, error } = await supabase
    .from('pedidos')
    .insert(orderData)
    .select()
    .single();

  if (error) {
    // Se offline, vai dar erro!
    throw new Error('Falha ao criar pedido');
  }

  return data;
}

// ✅ DEPOIS (funciona online E offline)
async function createOrderNew(orderData: any) {
  // SmartRequest decide automaticamente
  const pedido = await SmartRequest.insert('pedidos', {
    pedido_id: nanoid(),
    ...orderData,
    created_at: new Date().toISOString(),
  });

  // Offline: salva no PouchDB, sincroniza depois
  // Online: salva direto no Supabase
  return pedido;
}

// ============================================
// EXEMPLO 2: Buscar Produtos
// ============================================

// ❌ ANTES
async function getProductsOld() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error('Falha ao buscar produtos');
  }

  return data || [];
}

// ✅ DEPOIS
async function getProductsNew() {
  // Online: busca do Supabase (dados atualizados)
  // Offline: busca do PouchDB (cache local)
  const produtos = await SmartRequest.select('products', {
    order: { column: 'name', ascending: true }
  });

  return produtos;
}

// ============================================
// EXEMPLO 3: Atualizar Status de Pedido
// ============================================

// ❌ ANTES
async function updateOrderStatusOld(orderId: string, status: string) {
  const { error } = await supabase
    .from('pedidos')
    .update({ status })
    .eq('id', orderId);

  if (error) {
    throw new Error('Falha ao atualizar status');
  }
}

// ✅ DEPOIS
async function updateOrderStatusNew(orderId: string, status: string) {
  await SmartRequest.update('pedidos', orderId, {
    status,
    updated_at: new Date().toISOString(),
  });

  // Online: atualiza no Supabase imediatamente
  // Offline: salva pendência, sincroniza depois
}

// ============================================
// EXEMPLO 4: Buscar Pedidos de um Cliente
// ============================================

// ❌ ANTES
async function getClientOrdersOld(clientCode: string) {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('cliente_code', clientCode)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Falha ao buscar pedidos');
  }

  return data || [];
}

// ✅ DEPOIS
async function getClientOrdersNew(clientCode: string) {
  const pedidos = await SmartRequest.select('pedidos', {
    eq: { column: 'cliente_code', value: clientCode },
    order: { column: 'created_at', ascending: false }
  });

  return pedidos;
}

// ============================================
// EXEMPLO 5: Deletar Pedido
// ============================================

// ❌ ANTES
async function deleteOrderOld(orderId: string) {
  const { error } = await supabase
    .from('pedidos')
    .delete()
    .eq('id', orderId);

  if (error) {
    throw new Error('Falha ao deletar pedido');
  }
}

// ✅ DEPOIS
async function deleteOrderNew(orderId: string) {
  await SmartRequest.delete('pedidos', orderId);

  // Online: deleta do Supabase imediatamente
  // Offline: marca para deletar, sincroniza depois
}

// ============================================
// EXEMPLO 6: Componente React com SmartRequest
// ============================================

import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';

function OrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Buscar pedidos (funciona online e offline)
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await SmartRequest.select('pedidos', {
        order: { column: 'created_at', ascending: false },
        limit: 50
      });
      setOrders(data);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  };

  // Criar novo pedido (funciona online e offline)
  const createOrder = async (orderData: any) => {
    try {
      await SmartRequest.insert('pedidos', {
        pedido_id: nanoid(),
        ...orderData,
        status: 'pendente',
        created_at: new Date().toISOString()
      });

      Alert.alert('Sucesso', 'Pedido criado!');
      fetchOrders(); // Recarrega lista
    } catch (error) {
      Alert.alert('Erro', 'Falha ao criar pedido');
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <View>
      <FlatList
        data={orders}
        keyExtractor={(item: any) => item.pedido_id}
        renderItem={({ item }) => (
          <TouchableOpacity>
            <Text>{item.cliente_nome}</Text>
            <Text>R$ {item.total.toFixed(2)}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

// ============================================
// EXEMPLO 7: Sincronização Manual
// ============================================

import SyncService from './SyncService';

async function manualSync() {
  try {
    const syncService = SyncService.getInstance();

    // Upload de pendências
    await syncService.upload();
    console.log('✅ Pendências enviadas');

    // Download de dados novos
    await syncService.download(['pedidos', 'products', 'clients']);
    console.log('✅ Dados atualizados');

    // Ou sincronização completa
    await syncService.sync(['pedidos', 'products', 'clients']);
    console.log('✅ Sincronização completa');
  } catch (error) {
    console.error('Erro na sincronização:', error);
  }
}

// ============================================
// EXEMPLO 8: Verificar Status Online/Offline
// ============================================

function MyComponent() {
  const isOnline = useOnlineStatus(); // Hook personalizado

  return (
    <View>
      {isOnline ? (
        <Text>🟢 Online - Dados em tempo real</Text>
      ) : (
        <Text>🔴 Offline - Usando cache local</Text>
      )}
    </View>
  );
}

// ============================================
// EXEMPLO 9: Tratamento de Erros
// ============================================

async function saveWithErrorHandling() {
  try {
    const pedido = await SmartRequest.insert('pedidos', {
      pedido_id: nanoid(),
      cliente_nome: 'João Silva',
      total: 1500.00
    });

    console.log('Pedido salvo:', pedido);
    return pedido;
  } catch (error) {
    // Mesmo offline, não deveria dar erro
    // (SmartRequest salva no PouchDB)
    console.error('Erro inesperado:', error);
    return null;
  }
}

// ============================================
// EXEMPLO 10: Batch Operations
// ============================================

async function saveMultipleOrders(orders: any[]) {
  const results = [];

  for (const order of orders) {
    try {
      const saved = await SmartRequest.insert('pedidos', {
        pedido_id: nanoid(),
        ...order,
        created_at: new Date().toISOString()
      });
      results.push(saved);
    } catch (error) {
      console.error('Erro ao salvar pedido:', error);
    }
  }

  console.log(`${results.length}/${orders.length} pedidos salvos`);
  return results;
}

export {
  createOrderNew,
  getProductsNew,
  updateOrderStatusNew,
  getClientOrdersNew,
  deleteOrderNew,
  manualSync,
  saveWithErrorHandling,
  saveMultipleOrders
};
