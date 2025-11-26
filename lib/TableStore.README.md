# TableStore

Camada de abstração para gerenciar tabelas locais completas no PouchDB.

## 🎯 O que faz

TableStore permite armazenar e gerenciar cadastros completos offline:
- Produtos
- Clientes
- Estoque
- Categorias
- Marcas
- Configurações

## 📚 API

### SET - Substituir tabela inteira

Substitui todos os registros da tabela local.

```typescript
import TableStore from '@/lib/TableStore';

// Sincronizar produtos do servidor
const produtos = await supabase.from('products').select('*');
await TableStore.set('products', produtos.data);

// Agora os produtos estão disponíveis offline
```

### GET - Buscar todos os registros

```typescript
// Buscar todos os produtos locais
const produtos = await TableStore.get('products');

console.log(`${produtos.length} produtos no cache`);
```

### GET BY ID - Buscar registro específico

```typescript
const produto = await TableStore.getById('products', 'prod-123');

if (produto) {
  console.log(produto.name, produto.price);
}
```

### FIND - Buscar com filtro

```typescript
// Buscar produtos acima de R$ 100
const caros = await TableStore.find('products',
  item => item.price > 100
);

// Buscar clientes ativos
const ativos = await TableStore.find('clients',
  item => item.status === 'ativo'
);
```

### UPDATE - Atualizar registro

```typescript
await TableStore.update('products', 'prod-123', {
  price: 150.00,
  stock: 50
});
```

### REMOVE - Remover registro

```typescript
const removido = await TableStore.remove('products', 'prod-123');

if (removido) {
  console.log('Produto removido');
}
```

### CLEAR - Limpar tabela

```typescript
// Remove todos os registros da tabela
const count = await TableStore.clear('products');
console.log(`${count} produtos removidos`);
```

### COUNT - Contar registros

```typescript
const total = await TableStore.count('products');
console.log(`${total} produtos em cache`);
```

### EXISTS - Verificar existência

```typescript
const existe = await TableStore.exists('products', 'prod-123');

if (existe) {
  console.log('Produto existe no cache');
}
```

### GET METADATA - Metadados da tabela

```typescript
const meta = await TableStore.getMetadata('products');

console.log(`Tabela: ${meta.table}`);
console.log(`Registros: ${meta.count}`);
console.log(`Última sincronização: ${meta.lastSync}`);
```

### BATCH UPDATE - Atualizar vários registros

```typescript
const updates = [
  { id: 'prod-1', changes: { stock: 10 } },
  { id: 'prod-2', changes: { stock: 20 } },
  { id: 'prod-3', changes: { stock: 30 } }
];

const count = await TableStore.batchUpdate('products', updates);
console.log(`${count} produtos atualizados`);
```

### SEARCH - Buscar por texto

```typescript
// Buscar produtos por nome ou código
const resultados = await TableStore.search('products', 'camisa', ['name', 'code']);

// Buscar clientes por nome ou email
const clientes = await TableStore.search('clients', 'silva', ['name', 'email']);
```

## 🔄 Fluxo de Sincronização

### 1. Download inicial (app abre pela primeira vez)

```typescript
async function syncInitialData() {
  try {
    // Buscar produtos do Supabase
    const { data: produtos } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    // Salvar localmente
    await TableStore.set('products', produtos || []);

    // Buscar clientes
    const { data: clientes } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

    await TableStore.set('clients', clientes || []);

    console.log('✅ Sincronização inicial concluída');
  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
  }
}
```

### 2. Uso offline

```typescript
// Mesmo offline, os dados estão disponíveis
const produtos = await TableStore.get('products');
const clientes = await TableStore.get('clients');

// Buscar produto específico
const produto = await TableStore.getById('products', produtoId);

// Filtrar
const emEstoque = await TableStore.find('products',
  p => p.stock > 0
);
```

### 3. Atualização periódica

```typescript
async function updateCache() {
  // Verificar se está online
  if (!navigator.onLine) {
    console.log('Offline - usando cache');
    return;
  }

  try {
    // Buscar dados atualizados
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    // Atualizar cache local
    await TableStore.set('products', data || []);

    console.log('✅ Cache atualizado');
  } catch (error) {
    console.error('❌ Erro ao atualizar cache:', error);
  }
}

// Atualizar cache a cada 5 minutos (quando online)
setInterval(updateCache, 5 * 60 * 1000);
```

## 📋 Exemplo Completo - Produtos

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import TableStore from '@/lib/TableStore';

function ProductsScreen() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Carregar produtos (online ou offline)
  const loadProducts = async () => {
    try {
      setLoading(true);

      if (navigator.onLine) {
        // Online: busca do Supabase e atualiza cache
        const { data } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true });

        await TableStore.set('products', data || []);
        setProducts(data || []);
      } else {
        // Offline: busca do cache local
        const cached = await TableStore.get('products');
        setProducts(cached);
      }
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      // Em caso de erro, tenta buscar do cache
      const cached = await TableStore.get('products');
      setProducts(cached);
    } finally {
      setLoading(false);
    }
  };

  // Buscar produto
  const searchProducts = async (term: string) => {
    const results = await TableStore.search('products', term, ['name', 'code']);
    setProducts(results);
  };

  // Atualizar estoque local
  const updateStock = async (productId: string, newStock: number) => {
    await TableStore.update('products', productId, { stock: newStock });
    await loadProducts(); // Recarregar
  };

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <View>
      {loading ? (
        <Text>Carregando...</Text>
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View>
              <Text>{item.name}</Text>
              <Text>R$ {item.price.toFixed(2)}</Text>
              <Text>Estoque: {item.stock}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
```

## 📋 Exemplo - Clientes

```typescript
import TableStore from '@/lib/TableStore';

// Sincronizar clientes
async function syncClients() {
  const { data } = await supabase
    .from('clients')
    .select('*')
    .order('name', { ascending: true });

  await TableStore.set('clients', data || []);
}

// Buscar cliente por código
async function findClientByCode(code: string) {
  const clients = await TableStore.find('clients',
    c => c.code === code
  );
  return clients[0] || null;
}

// Buscar clientes ativos
async function getActiveClients() {
  return await TableStore.find('clients',
    c => c.status === 'ativo'
  );
}

// Atualizar status do cliente
async function updateClientStatus(clientId: string, status: string) {
  await TableStore.update('clients', clientId, { status });
}
```

## 📋 Exemplo - Estoque

```typescript
// Sincronizar estoque
async function syncStock() {
  const { data } = await supabase
    .from('stock')
    .select('*');

  await TableStore.set('stock', data || []);
}

// Buscar estoque de um produto
async function getProductStock(productId: string) {
  const items = await TableStore.find('stock',
    s => s.product_id === productId
  );
  return items[0] || null;
}

// Atualizar quantidade em estoque
async function updateStockQuantity(productId: string, quantity: number) {
  const items = await TableStore.find('stock',
    s => s.product_id === productId
  );

  if (items.length > 0) {
    await TableStore.update('stock', items[0].id, { quantity });
  }
}

// Produtos com estoque baixo
async function getLowStockProducts(threshold: number = 10) {
  return await TableStore.find('stock',
    s => s.quantity < threshold
  );
}
```

## 🔧 Hook Personalizado

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import TableStore from '@/lib/TableStore';

/**
 * Hook para gerenciar tabela com cache offline
 */
export function useTableStore<T>(tableName: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sincronizar tabela
  const sync = async () => {
    try {
      setLoading(true);
      setError(null);

      if (navigator.onLine) {
        // Buscar do Supabase
        const { data: serverData, error: serverError } = await supabase
          .from(tableName)
          .select('*');

        if (serverError) throw serverError;

        // Atualizar cache local
        await TableStore.set(tableName, serverData || []);
        setData(serverData || []);
      } else {
        // Buscar do cache
        const cached = await TableStore.get(tableName);
        setData(cached as T[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao sincronizar');
      // Tenta buscar cache em caso de erro
      const cached = await TableStore.get(tableName);
      setData(cached as T[]);
    } finally {
      setLoading(false);
    }
  };

  // Buscar por ID
  const getById = async (id: string): Promise<T | null> => {
    return await TableStore.getById(tableName, id) as T | null;
  };

  // Buscar com filtro
  const find = async (predicate: (item: T) => boolean): Promise<T[]> => {
    return await TableStore.find(tableName, predicate) as T[];
  };

  // Atualizar
  const update = async (id: string, changes: Partial<T>): Promise<T | null> => {
    const result = await TableStore.update(tableName, id, changes);
    await sync(); // Recarrega
    return result as T | null;
  };

  // Remover
  const remove = async (id: string): Promise<boolean> => {
    const result = await TableStore.remove(tableName, id);
    await sync(); // Recarrega
    return result;
  };

  // Buscar por texto
  const search = async (term: string, fields: string[]): Promise<T[]> => {
    return await TableStore.search(tableName, term, fields) as T[];
  };

  useEffect(() => {
    sync();
  }, []);

  return {
    data,
    loading,
    error,
    sync,
    getById,
    find,
    update,
    remove,
    search,
  };
}

// Uso:
// const { data: products, loading, sync } = useTableStore<Product>('products');
```

## ✨ Benefícios

- ✅ **Cache Offline Completo**: Tabelas inteiras disponíveis offline
- ✅ **API Simples**: Métodos intuitivos e fáceis de usar
- ✅ **Type-Safe**: TypeScript completo
- ✅ **Logs Detalhados**: Todas operações registradas no console
- ✅ **Sincronização Fácil**: Um comando substitui a tabela inteira
- ✅ **Busca Rápida**: Find, search, filter localmente
- ✅ **Metadados**: Informações sobre cache (count, lastSync)
- ✅ **Batch Operations**: Atualizar múltiplos registros

## 🎯 Casos de Uso

### 1. App de Vendas Offline
```typescript
// Sincronizar produtos ao abrir app
await TableStore.set('products', produtosDoServidor);

// Offline: buscar produtos para vender
const produtos = await TableStore.get('products');
```

### 2. Catálogo de Produtos
```typescript
// Cache de produtos com imagens
await TableStore.set('products', produtos);

// Buscar offline
const produto = await TableStore.getById('products', id);
```

### 3. Lista de Clientes
```typescript
// Cache de clientes
await TableStore.set('clients', clientes);

// Buscar cliente por nome
const results = await TableStore.search('clients', 'joão', ['name', 'email']);
```

## ⚠️ Diferenças: TableStore vs SmartRequest

### TableStore
- ✅ Gerencia **tabelas completas** (cadastros)
- ✅ SET substitui tudo de uma vez
- ✅ Ideal para: produtos, clientes, categorias
- ✅ Leitura local rápida

### SmartRequest
- ✅ Gerencia **transações** (operações individuais)
- ✅ INSERT/UPDATE cria pendências para sincronizar
- ✅ Ideal para: pedidos, vendas, logs
- ✅ Sincronização automática

## 🔄 Uso Combinado

```typescript
// TableStore para cadastros
await TableStore.set('products', produtos);
await TableStore.set('clients', clientes);

// SmartRequest para transações
await SmartRequest.insert('pedidos', novoPedido);
await SmartRequest.insert('vendas', novaVenda);
```
