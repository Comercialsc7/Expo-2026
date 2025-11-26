/**
 * EXEMPLOS DE USO - TableStore
 *
 * Como usar TableStore para gerenciar cadastros offline
 */

import TableStore from './TableStore';
import { supabase } from './supabase';

// ============================================
// EXEMPLO 1: Sincronizar Produtos
// ============================================

async function syncProducts() {
  try {
    console.log('🔄 Sincronizando produtos...');

    // Buscar do Supabase
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    // Substituir cache local completo
    await TableStore.set('products', data || []);

    console.log(`✅ ${data?.length || 0} produtos sincronizados`);
  } catch (error) {
    console.error('❌ Erro ao sincronizar produtos:', error);
  }
}

// ============================================
// EXEMPLO 2: Buscar Produtos Offline
// ============================================

async function getProductsOffline() {
  // Busca do cache local (funciona offline)
  const produtos = await TableStore.get('products');

  console.log(`📦 ${produtos.length} produtos em cache`);
  return produtos;
}

// ============================================
// EXEMPLO 3: Buscar Produto por ID
// ============================================

async function findProduct(productId: string) {
  const produto = await TableStore.getById('products', productId);

  if (produto) {
    console.log(`Produto: ${produto.name}`);
    console.log(`Preço: R$ ${produto.price.toFixed(2)}`);
    console.log(`Estoque: ${produto.stock}`);
    return produto;
  }

  console.log('Produto não encontrado no cache');
  return null;
}

// ============================================
// EXEMPLO 4: Filtrar Produtos
// ============================================

async function filterProducts() {
  // Produtos em estoque
  const emEstoque = await TableStore.find('products',
    p => p.stock > 0
  );
  console.log(`${emEstoque.length} produtos em estoque`);

  // Produtos acima de R$ 100
  const caros = await TableStore.find('products',
    p => p.price > 100
  );
  console.log(`${caros.length} produtos acima de R$ 100`);

  // Produtos aceleradores
  const aceleradores = await TableStore.find('products',
    p => p.is_accelerator === true
  );
  console.log(`${aceleradores.length} produtos aceleradores`);

  return { emEstoque, caros, aceleradores };
}

// ============================================
// EXEMPLO 5: Buscar Produtos por Nome
// ============================================

async function searchProducts(searchTerm: string) {
  // Busca em nome e código
  const resultados = await TableStore.search('products', searchTerm, ['name', 'code']);

  console.log(`🔍 Encontrados ${resultados.length} produtos para "${searchTerm}"`);
  return resultados;
}

// ============================================
// EXEMPLO 6: Atualizar Estoque Local
// ============================================

async function updateProductStock(productId: string, newStock: number) {
  const updated = await TableStore.update('products', productId, {
    stock: newStock,
    updated_at: new Date().toISOString()
  });

  if (updated) {
    console.log(`✅ Estoque atualizado: ${updated.stock}`);
  }

  return updated;
}

// ============================================
// EXEMPLO 7: Sincronizar Clientes
// ============================================

async function syncClients() {
  try {
    console.log('🔄 Sincronizando clientes...');

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    await TableStore.set('clients', data || []);

    console.log(`✅ ${data?.length || 0} clientes sincronizados`);
  } catch (error) {
    console.error('❌ Erro ao sincronizar clientes:', error);
  }
}

// ============================================
// EXEMPLO 8: Buscar Cliente por Código
// ============================================

async function findClientByCode(clientCode: string) {
  const clientes = await TableStore.find('clients',
    c => c.code === clientCode
  );

  return clientes[0] || null;
}

// ============================================
// EXEMPLO 9: Buscar Clientes Ativos
// ============================================

async function getActiveClients() {
  const ativos = await TableStore.find('clients',
    c => c.status === 'ativo' || c.status === 'active'
  );

  console.log(`${ativos.length} clientes ativos`);
  return ativos;
}

// ============================================
// EXEMPLO 10: Sincronizar Múltiplas Tabelas
// ============================================

async function syncAllData() {
  try {
    console.log('🔄 Sincronização completa iniciada...');

    // Produtos
    const { data: produtos } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });
    await TableStore.set('products', produtos || []);
    console.log(`✅ ${produtos?.length || 0} produtos`);

    // Clientes
    const { data: clientes } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });
    await TableStore.set('clients', clientes || []);
    console.log(`✅ ${clientes?.length || 0} clientes`);

    // Categorias (se existir)
    const { data: categorias } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    await TableStore.set('categories', categorias || []);
    console.log(`✅ ${categorias?.length || 0} categorias`);

    console.log('✅ Sincronização completa concluída!');
  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
  }
}

// ============================================
// EXEMPLO 11: Verificar Status do Cache
// ============================================

async function checkCacheStatus() {
  const productsMeta = await TableStore.getMetadata('products');
  const clientsMeta = await TableStore.getMetadata('clients');

  console.log('📊 Status do Cache:');
  console.log(`Produtos: ${productsMeta.count} registros`);
  console.log(`Última sync: ${productsMeta.lastSync || 'Nunca'}`);
  console.log(`Clientes: ${clientsMeta.count} registros`);
  console.log(`Última sync: ${clientsMeta.lastSync || 'Nunca'}`);

  return { productsMeta, clientsMeta };
}

// ============================================
// EXEMPLO 12: Limpar Cache Antigo
// ============================================

async function clearOldCache() {
  console.log('🗑️ Limpando cache antigo...');

  const productsRemoved = await TableStore.clear('products');
  const clientsRemoved = await TableStore.clear('clients');

  console.log(`✅ ${productsRemoved} produtos removidos`);
  console.log(`✅ ${clientsRemoved} clientes removidos`);
}

// ============================================
// EXEMPLO 13: Componente React - Lista de Produtos
// ============================================

import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput } from 'react-native';

function ProductListScreen() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Carregar produtos
  const loadProducts = async () => {
    try {
      setLoading(true);

      if (navigator.onLine) {
        // Online: sincroniza com servidor
        await syncProducts();
      }

      // Busca do cache local
      const cached = await TableStore.get('products');
      setProducts(cached);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Buscar produtos
  const handleSearch = async (term: string) => {
    setSearchTerm(term);

    if (term.trim() === '') {
      const all = await TableStore.get('products');
      setProducts(all);
    } else {
      const results = await TableStore.search('products', term, ['name', 'code']);
      setProducts(results);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <TextInput
        placeholder="Buscar produtos..."
        value={searchTerm}
        onChangeText={handleSearch}
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          padding: 10,
          borderRadius: 8,
          marginBottom: 16
        }}
      />

      {loading ? (
        <Text>Carregando...</Text>
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={{
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#eee'
              }}
            >
              <Text style={{ fontWeight: 'bold' }}>{item.name}</Text>
              <Text>Código: {item.code}</Text>
              <Text>Preço: R$ {item.price.toFixed(2)}</Text>
              <Text>Estoque: {item.stock}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

// ============================================
// EXEMPLO 14: Hook Personalizado
// ============================================

function useProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const sync = async () => {
    try {
      setLoading(true);

      if (navigator.onLine) {
        await syncProducts();
      }

      const cached = await TableStore.get('products');
      setProducts(cached);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const search = async (term: string) => {
    const results = await TableStore.search('products', term, ['name', 'code']);
    setProducts(results);
  };

  const getById = async (id: string) => {
    return await TableStore.getById('products', id);
  };

  const filterByStock = async (minStock: number) => {
    const filtered = await TableStore.find('products',
      p => p.stock >= minStock
    );
    setProducts(filtered);
  };

  useEffect(() => {
    sync();
  }, []);

  return {
    products,
    loading,
    sync,
    search,
    getById,
    filterByStock
  };
}

// Uso:
// const { products, loading, search } = useProducts();

// ============================================
// EXEMPLO 15: Sincronização Periódica
// ============================================

class DataSyncManager {
  private syncInterval: NodeJS.Timeout | null = null;

  // Iniciar sincronização automática a cada X minutos
  startAutoSync(intervalMinutes: number = 5) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (navigator.onLine) {
        console.log('🔄 Auto-sync iniciado...');
        await syncAllData();
      } else {
        console.log('⚠️ Offline - pulando auto-sync');
      }
    }, intervalMinutes * 60 * 1000);

    console.log(`✅ Auto-sync configurado (a cada ${intervalMinutes} minutos)`);
  }

  // Parar sincronização automática
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ Auto-sync parado');
    }
  }

  // Sincronizar agora
  async syncNow() {
    if (navigator.onLine) {
      await syncAllData();
    } else {
      console.log('⚠️ Sem conexão - não é possível sincronizar');
    }
  }
}

// Uso:
// const syncManager = new DataSyncManager();
// syncManager.startAutoSync(5); // Sincroniza a cada 5 minutos

// ============================================
// EXEMPLO 16: Atualização em Lote
// ============================================

async function updateMultipleProducts() {
  const updates = [
    { id: 'prod-1', changes: { stock: 10, price: 99.90 } },
    { id: 'prod-2', changes: { stock: 20, price: 149.90 } },
    { id: 'prod-3', changes: { stock: 5, price: 199.90 } }
  ];

  const count = await TableStore.batchUpdate('products', updates);
  console.log(`✅ ${count} produtos atualizados`);
}

export {
  syncProducts,
  getProductsOffline,
  findProduct,
  filterProducts,
  searchProducts,
  updateProductStock,
  syncClients,
  findClientByCode,
  getActiveClients,
  syncAllData,
  checkCacheStatus,
  clearOldCache,
  ProductListScreen,
  useProducts,
  DataSyncManager,
  updateMultipleProducts
};
