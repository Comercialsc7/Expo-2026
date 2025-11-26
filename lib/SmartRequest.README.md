# SmartRequest

Helper inteligente para requisições que funciona automaticamente online e offline.

## 🎯 O que faz

SmartRequest detecta automaticamente se o app está online ou offline e decide:

- **Online**: Requisições vão direto para o Supabase
- **Offline**: Dados são salvos no PouchDB como pendências (serão sincronizados depois)

## 📚 API

### INSERT

Insere um novo registro.

```typescript
import SmartRequest from '@/lib/SmartRequest';

// Online: insere no Supabase
// Offline: salva no PouchDB como pendência
const result = await SmartRequest.insert('pedidos', {
  cliente_nome: 'João Silva',
  total: 1500.00,
  status: 'pendente'
});
```

### SELECT

Busca registros.

```typescript
// Buscar todos
const pedidos = await SmartRequest.select('pedidos');

// Buscar com filtros
const pedidos = await SmartRequest.select('pedidos', {
  select: 'id, cliente_nome, total',
  eq: { column: 'status', value: 'pendente' },
  order: { column: 'created_at', ascending: false },
  limit: 10
});

// Buscar por cliente específico
const pedidosCliente = await SmartRequest.select('pedidos', {
  eq: { column: 'cliente_code', value: 'CLI001' }
});
```

### UPDATE

Atualiza um registro existente.

```typescript
await SmartRequest.update('pedidos', 'pedido-123', {
  status: 'enviado',
  updated_at: new Date().toISOString()
});
```

### DELETE

Remove um registro.

```typescript
await SmartRequest.delete('pedidos', 'pedido-123');
```

### UPSERT

Insere ou atualiza (baseado em chave única).

```typescript
await SmartRequest.upsert('pedidos', {
  id: 'pedido-123',
  cliente_nome: 'João Silva',
  total: 1500.00
});
```

## 🔄 Como funciona

### Modo Online

```typescript
// SmartRequest detecta: navigator.onLine === true
await SmartRequest.insert('pedidos', data);
// ↓
// INSERT direto no Supabase
// ↓
// Retorna dados inseridos
```

### Modo Offline

```typescript
// SmartRequest detecta: navigator.onLine === false
await SmartRequest.insert('pedidos', data);
// ↓
// LocalDB.save('pedidos', { ...data, _synced: false })
// ↓
// Retorna dados salvos localmente
// ↓
// Quando voltar online, SyncService.upload() sincroniza
```

## 📋 Exemplo Completo

### Antes (sem SmartRequest)

```typescript
// Código antigo - só funciona online
const { data, error } = await supabase
  .from('pedidos')
  .insert({
    cliente_nome: 'João Silva',
    total: 1500.00
  })
  .select()
  .single();

if (error) {
  // Se offline, o usuário vê erro ❌
  Alert.alert('Erro', 'Falha ao salvar pedido');
}
```

### Depois (com SmartRequest)

```typescript
// Código novo - funciona online E offline
try {
  const pedido = await SmartRequest.insert('pedidos', {
    cliente_nome: 'João Silva',
    total: 1500.00
  });

  // Sucesso tanto online quanto offline ✅
  Alert.alert('Sucesso', 'Pedido salvo!');

  // Se offline, será sincronizado automaticamente quando voltar online
} catch (error) {
  Alert.alert('Erro', 'Falha ao salvar pedido');
}
```

## 🔍 SELECT com Fallback

```typescript
// Busca produtos
const produtos = await SmartRequest.select('products', {
  order: { column: 'nome', ascending: true },
  limit: 50
});

// Online: busca do Supabase (dados atualizados)
// Offline: busca do PouchDB (dados em cache)
// O usuário sempre vê dados, mesmo offline! ✅
```

## 🎨 Logs

SmartRequest registra todas as operações no console:

```
📡 [SmartRequest] INSERT online em 'pedidos'
✅ [SmartRequest] INSERT concluído em 'pedidos'

💾 [SmartRequest] SELECT offline em 'products'
✅ [SmartRequest] SELECT offline concluído em 'products' (45 registros)
```

## ⚙️ Integração com SyncService

Quando o app volta online:

1. `useOnlineStatus` detecta conexão
2. `SyncService.upload()` é chamado automaticamente
3. Todos os registros com `_synced: false` são enviados ao Supabase
4. PouchDB é atualizado com `_synced: true`

## 🚀 Migração

### Passo 1: Substituir imports

```typescript
// Antes
import { supabase } from '@/lib/supabase';

// Depois
import SmartRequest from '@/lib/SmartRequest';
```

### Passo 2: Substituir chamadas

```typescript
// Antes
const { data } = await supabase.from('pedidos').insert(payload);

// Depois
const data = await SmartRequest.insert('pedidos', payload);
```

```typescript
// Antes
const { data } = await supabase.from('pedidos').select('*');

// Depois
const data = await SmartRequest.select('pedidos');
```

## ✨ Benefícios

- ✅ **Zero Configuração**: Funciona automaticamente
- ✅ **Offline-First**: App nunca quebra sem internet
- ✅ **Sincronização Automática**: Dados são enviados quando voltar online
- ✅ **API Simples**: Mesma sintaxe para online/offline
- ✅ **Logs Claros**: Fácil debug
- ✅ **Type-Safe**: TypeScript completo
- ✅ **Fallback Inteligente**: Se falhar online, tenta offline

## ⚠️ Considerações

1. **IDs**: Use UUIDs gerados localmente para evitar conflitos
2. **Validação**: Valide dados antes de enviar
3. **Conflitos**: Em caso de conflito, o último registro vence (last-write-wins)
4. **Cache**: SELECT offline retorna dados do cache local (podem estar desatualizados)

## 🔧 Casos de Uso

### Criar Pedido Offline

```typescript
const novoPedido = await SmartRequest.insert('pedidos', {
  pedido_id: nanoid(),
  cliente_code: 'CLI001',
  total: 1500.00,
  produtos: [...],
  created_at: new Date().toISOString()
});

// Salvo offline, será sincronizado automaticamente
```

### Listar Produtos (sempre funciona)

```typescript
const produtos = await SmartRequest.select('products', {
  order: { column: 'nome', ascending: true }
});

// Mostra produtos do Supabase (online) ou PouchDB (offline)
setProducts(produtos);
```

### Atualizar Status

```typescript
await SmartRequest.update('pedidos', pedidoId, {
  status: 'enviado',
  updated_at: new Date().toISOString()
});

// Online: atualiza no Supabase imediatamente
// Offline: marca para sincronizar depois
```
