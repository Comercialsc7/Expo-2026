# SQLiteStore - Persistencia Local Offline

SQLiteStore e a camada de persistencia local unificada do app.
Ele oferece API simples por tabela para salvar, consultar, atualizar e limpar dados offline.

## Uso Basico

```typescript
import SQLiteStore from '@/lib/SQLiteStore';
```

## API

### save(table, record)
Salva ou atualiza um registro.

```typescript
await SQLiteStore.save('products', { id: 'p1', name: 'Produto A' });
```

### getAll(table)
Retorna todos os registros no formato interno (`_id`, `table`, `payload`, `createdAt`, `updatedAt`).

```typescript
const rows = await SQLiteStore.getAll('products');
const products = rows.map((r) => r.payload);
```

### getById(table, id)
Busca um registro especifico por ID.

```typescript
const row = await SQLiteStore.getById('products', 'p1');
```

### remove(table, id)
Remove um registro por ID.

```typescript
await SQLiteStore.remove('products', 'p1');
```

### clear(table)
Remove todos os registros da tabela.

```typescript
await SQLiteStore.clear('products');
```

### count(table)
Conta registros da tabela.

```typescript
const total = await SQLiteStore.count('products');
```

### getAllTables()
Lista tabelas existentes.

```typescript
const tables = await SQLiteStore.getAllTables();
```

### clearAll()
Limpa todo o banco local.

```typescript
await SQLiteStore.clearAll();
```

## Hook React

Use o hook principal em `hooks/useSQLiteStore.ts`.

```typescript
import { useSQLiteStore } from '@/hooks/useSQLiteStore';

const { data, loading, error, save, remove, clear, refresh, count } =
  useSQLiteStore<Product>('products');
```

## Exemplos

- `lib/SQLiteStore.example.ts`
- `components/shared/SQLiteStoreExample.tsx`

