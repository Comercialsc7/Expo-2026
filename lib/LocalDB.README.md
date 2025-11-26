# LocalDB - Sistema de Banco de Dados Local com PouchDB

Sistema de persistência local usando PouchDB e IndexedDB para funcionalidade offline.

## 📦 Instalação

As dependências já estão instaladas:
- `pouchdb-browser`
- `pouchdb-find`

## 🚀 Como Usar

### 1. Importação Básica

```typescript
import LocalDB from '@/lib/LocalDB';
```

### 2. Métodos Disponíveis

#### `save(table: string, record: any)`
Salva ou atualiza um registro na tabela especificada.

```typescript
const product = {
  id: '123',
  name: 'Produto A',
  price: 99.90
};

const saved = await LocalDB.save('products', product);
console.log(saved);
// {
//   _id: '123',
//   _rev: '1-xxx',
//   table: 'products',
//   payload: { id: '123', name: 'Produto A', price: 99.90 },
//   createdAt: '2025-01-01T00:00:00.000Z',
//   updatedAt: '2025-01-01T00:00:00.000Z'
// }
```

#### `getAll(table: string)`
Retorna todos os registros de uma tabela.

```typescript
const products = await LocalDB.getAll('products');
console.log(products);
// [
//   { _id: '123', table: 'products', payload: {...}, ... },
//   { _id: '456', table: 'products', payload: {...}, ... }
// ]
```

#### `getById(table: string, id: string)`
Busca um registro específico pelo ID.

```typescript
const product = await LocalDB.getById('products', '123');
if (product) {
  console.log(product.payload);
}
```

#### `remove(table: string, id: string)`
Remove um registro da tabela.

```typescript
const removed = await LocalDB.remove('products', '123');
console.log(removed); // true ou false
```

#### `clear(table: string)`
Remove todos os registros de uma tabela.

```typescript
const deletedCount = await LocalDB.clear('products');
console.log(`${deletedCount} registros deletados`);
```

#### `count(table: string)`
Conta quantos registros existem em uma tabela.

```typescript
const count = await LocalDB.count('products');
console.log(`Total: ${count} produtos`);
```

#### `search(table: string, searchFn: Function)`
Busca registros usando uma função de filtro.

```typescript
const expensiveProducts = await LocalDB.search('products', (product) => {
  return product.price > 100;
});
```

#### `getAllTables()`
Lista todas as tabelas existentes no banco.

```typescript
const tables = await LocalDB.getAllTables();
console.log(tables); // ['products', 'orders', 'clients']
```

#### `getInfo()`
Retorna informações sobre o banco de dados.

```typescript
const info = await LocalDB.getInfo();
console.log(info);
// {
//   db_name: 'offline_db',
//   doc_count: 150,
//   update_seq: 200,
//   ...
// }
```

#### `clearAll()`
**CUIDADO!** Remove completamente o banco de dados.

```typescript
await LocalDB.clearAll();
```

## 🎣 Hook React: useLocalDB

Hook para integração fácil com componentes React.

### Uso Básico

```typescript
import { useLocalDB } from '@/hooks/useLocalDB';

function ProductList() {
  const { data, loading, error, save, remove, clear, count } = useLocalDB('products');

  if (loading) return <Text>Carregando...</Text>;
  if (error) return <Text>Erro: {error}</Text>;

  return (
    <View>
      <Text>Total: {count} produtos</Text>
      {data.map(product => (
        <Text key={product._id}>{product.name}</Text>
      ))}
    </View>
  );
}
```

### API do Hook

```typescript
const {
  data,        // Array com os registros
  loading,     // Boolean - carregando?
  error,       // String | null - erro?
  save,        // Function - salvar registro
  remove,      // Function - remover por ID
  clear,       // Function - limpar tabela
  refresh,     // Function - recarregar dados
  count        // Number - total de registros
} = useLocalDB<YourType>('table_name');
```

## 📋 Estrutura dos Dados

Todos os registros são armazenados no seguinte formato:

```typescript
{
  _id: string,           // ID único (gerado automaticamente se não fornecido)
  _rev: string,          // Revisão do PouchDB (gerenciado internamente)
  table: string,         // Nome da tabela
  payload: any,          // Seus dados
  createdAt: string,     // Data de criação (ISO)
  updatedAt: string      // Data de última atualização (ISO)
}
```

## 💡 Casos de Uso

### 1. Pedidos Offline

```typescript
// Salvar pedido quando offline
const order = {
  clientName: 'João Silva',
  items: [{ product: 'A', qty: 2 }],
  total: 199.80,
  synced: false
};

await LocalDB.save('orders', order);

// Buscar pedidos não sincronizados
const unsynced = await LocalDB.search('orders', (order) => {
  return !order.synced;
});

// Sincronizar com servidor
for (const order of unsynced) {
  await syncWithServer(order.payload);
  await LocalDB.save('orders', { ...order.payload, synced: true });
}
```

### 2. Cache de Produtos

```typescript
// Salvar produtos do catálogo
const products = await fetchProductsFromAPI();
for (const product of products) {
  await LocalDB.save('products_cache', product);
}

// Usar cache quando offline
const cachedProducts = await LocalDB.getAll('products_cache');
```

### 3. Rascunhos

```typescript
// Salvar rascunho automaticamente
const draft = {
  clientId: '123',
  items: selectedItems,
  lastModified: new Date().toISOString()
};

await LocalDB.save('drafts', draft);

// Recuperar rascunhos
const drafts = await LocalDB.getAll('drafts');
```

## ⚙️ Configuração

O banco é criado automaticamente ao importar o módulo:

```typescript
// lib/pouchdb.ts
import PouchDB from 'pouchdb-browser';

const db = new PouchDB('offline_db', {
  auto_compaction: true,  // Limpeza automática
  revs_limit: 1,          // Manter apenas 1 revisão
});
```

## 🔍 Debugging

### Ver informações do banco

```typescript
const info = await LocalDB.getInfo();
console.log('Database Info:', info);
```

### Listar todas as tabelas

```typescript
const tables = await LocalDB.getAllTables();
console.log('Tables:', tables);
```

### Verificar tamanho

```typescript
const info = await LocalDB.getInfo();
console.log(`Documents: ${info.doc_count}`);
console.log(`Data Size: ${info.data_size} bytes`);
```

## ⚠️ Avisos Importantes

1. **Sincronização**: LocalDB NÃO sincroniza automaticamente com servidor. Você precisa implementar a lógica de sync.

2. **Tamanho**: IndexedDB tem limites de armazenamento (geralmente 50MB-1GB dependendo do navegador).

3. **Tipos**: Use TypeScript interfaces para type safety:
   ```typescript
   interface Product {
     id: string;
     name: string;
     price: number;
   }

   const { data } = useLocalDB<Product>('products');
   ```

4. **Performance**: Para grandes volumes de dados, considere usar índices ou filtros no lado do servidor.

## 🧪 Exemplo Completo

Veja o arquivo `LocalDB.example.ts` para exemplos completos de uso.

Veja o componente `LocalDBExample.tsx` para um exemplo de interface React.

## 📚 Recursos

- [PouchDB Documentation](https://pouchdb.com/guides/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
