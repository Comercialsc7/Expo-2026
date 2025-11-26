# SyncService - Sincronização PouchDB ↔ Supabase

Serviço completo de sincronização bidirecional entre banco local (PouchDB) e Supabase.

## 🎯 Funcionalidades

- ✅ Upload de registros locais para Supabase
- ✅ Download de registros do Supabase para local
- ✅ **Sincronização Incremental** - Baixa apenas dados novos/atualizados
- ✅ **Tabela sync_meta** - Persiste timestamps de sincronização
- ✅ Sincronização completa (upload + download)
- ✅ Eventos em tempo real para UI
- ✅ Sincronização por tabela
- ✅ Controle de última sincronização
- ✅ Tratamento de erros robusto

## 🚀 Novidade: Sincronização Incremental

A partir de agora, o SyncService usa uma tabela interna `sync_meta` no PouchDB para salvar:
- `last_upload_at` - Timestamp do último upload
- `last_download_at` - Timestamp do último download

### Como funciona:

1. **Primeira sincronização**: Baixa todos os dados
2. **Sincronizações seguintes**: Baixa apenas dados com `updated_at > last_download_at`
3. **Economia**: Reduz drasticamente o tráfego de rede e tempo de sincronização

## 📦 Importação

```typescript
import SyncService from '@/lib/SyncService';
```

## 🚀 Métodos Principais

### `sync(config: SyncConfig)`

Executa sincronização completa: primeiro upload, depois download.

```typescript
await SyncService.sync({
  tables: ['products', 'orders', 'clients'],
});
```

**Parâmetros:**
- `tables`: Array com nomes das tabelas a sincronizar
- `batchSize` (opcional): Tamanho do lote para processamento
- `onProgress` (opcional): Callback para progresso

**Retorna:**
```typescript
{
  upload: {
    success: number,
    failed: number,
    errors: Array<{table: string, error: Error}>
  },
  download: {
    downloaded: Record<string, number>,
    errors: Array<{table: string, error: Error}>
  }
}
```

### `upload(config?: Partial<SyncConfig>)`

Envia registros não sincronizados do local para Supabase.

```typescript
const result = await SyncService.upload();
console.log(`${result.success} registros enviados`);
console.log(`${result.failed} falharam`);
```

**Processo:**
1. Busca todos os registros locais onde `_synced !== true`
2. Para cada registro:
   - Identifica a tabela (`record.table`)
   - Envia `record.payload` para Supabase via `upsert()`
   - Remove do PouchDB após sucesso
3. Retorna estatísticas

### `download(config: SyncConfig)`

Baixa registros do Supabase para o banco local.

```typescript
const result = await SyncService.download({
  tables: ['products', 'orders'],
});

console.log(result.downloaded);
// { products: 50, orders: 23 }
```

**Processo:**
1. Para cada tabela:
   - Busca registros do Supabase
   - Se houver `lastSyncTime`, busca apenas registros mais recentes
   - Limpa a tabela local
   - Salva todos os registros com `_synced: true`
2. Atualiza `lastSyncTime` para cada tabela

### `uploadTable(table: string)`

Sincroniza uma tabela específica (upload apenas).

```typescript
await SyncService.uploadTable('orders');
```

### `downloadTable(table: string, fullRefresh?: boolean)`

Baixa dados de uma tabela específica.

```typescript
// Download incremental (desde última sync)
await SyncService.downloadTable('products');

// Download completo (limpa e baixa tudo)
await SyncService.downloadTable('products', true);
```

## 🎪 Sistema de Eventos

O SyncService emite eventos que podem ser capturados na UI.

### Tipos de Eventos

```typescript
type SyncEventType =
  | 'sync-start'      // Sincronização iniciada
  | 'sync-progress'   // Progresso atualizado
  | 'sync-completed'  // Sincronização concluída
  | 'sync-error';     // Erro ocorrido
```

### Estrutura do Evento

```typescript
interface SyncEvent {
  type: SyncEventType;
  message?: string;
  progress?: number;    // Itens processados
  total?: number;       // Total de itens
  error?: Error;
  data?: any;          // Dados adicionais
}
```

### Escutando Eventos

```typescript
// Registrar listener
const handleProgress = (event: SyncEvent) => {
  console.log(`${event.progress}/${event.total} - ${event.message}`);
};

SyncService.on('sync-progress', handleProgress);

// Remover listener
SyncService.off('sync-progress', handleProgress);
```

### Exemplo Completo

```typescript
SyncService.on('sync-start', (event) => {
  console.log('Iniciando:', event.message);
});

SyncService.on('sync-progress', (event) => {
  const percent = (event.progress! / event.total!) * 100;
  console.log(`Progresso: ${percent.toFixed(0)}%`);
});

SyncService.on('sync-completed', (event) => {
  console.log('Concluído:', event.message);
  console.log('Resultados:', event.data);
});

SyncService.on('sync-error', (event) => {
  console.error('Erro:', event.error);
});

// Executar sync
await SyncService.sync({ tables: ['products'] });

// Limpar listeners quando não precisar mais
SyncService.clearListeners();
```

## 🎣 Hook React: useSyncService

Hook para integração fácil com componentes React.

```typescript
import { useSyncService } from '@/hooks/useSyncService';

function SyncButton() {
  const {
    syncing,
    progress,
    total,
    message,
    error,
    lastSync,
    sync,
    upload,
    download,
  } = useSyncService();

  const handleSync = async () => {
    await sync(['products', 'orders']);
  };

  if (syncing) {
    return (
      <View>
        <Text>{message}</Text>
        <Text>{progress}/{total}</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={handleSync}>
      <Text>Sincronizar</Text>
    </TouchableOpacity>
  );
}
```

### API do Hook

```typescript
const {
  syncing,        // boolean - está sincronizando?
  progress,       // number - progresso atual
  total,          // number - total de itens
  message,        // string - mensagem atual
  error,          // Error | null - erro ocorrido
  lastSync,       // Date | null - última sincronização
  sync,           // (tables: string[]) => Promise<void>
  upload,         // () => Promise<void>
  download,       // (tables: string[]) => Promise<void>
  uploadTable,    // (table: string) => Promise<void>
  downloadTable,  // (table: string, fullRefresh?) => Promise<void>
} = useSyncService();
```

## 💡 Casos de Uso

### 1. Sincronização Automática ao Voltar Online

```typescript
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSyncService } from '@/hooks/useSyncService';

function AutoSync() {
  const isOnline = useOnlineStatus();
  const { sync } = useSyncService();

  useEffect(() => {
    if (isOnline) {
      sync(['orders', 'products']);
    }
  }, [isOnline]);

  return null;
}
```

### 2. Salvar Pedido Offline

```typescript
import LocalDB from '@/lib/LocalDB';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSyncService } from '@/hooks/useSyncService';

async function saveOrder(order: Order) {
  const isOnline = useOnlineStatus();

  // Salvar localmente
  await LocalDB.save('orders', {
    ...order,
    _synced: false,  // Marcar como não sincronizado
  });

  // Se online, sincronizar imediatamente
  if (isOnline) {
    const { uploadTable } = useSyncService();
    await uploadTable('orders');
  }
}
```

### 3. Sincronização Periódica

```typescript
function PeriodicSync() {
  const { sync } = useSyncService();

  useEffect(() => {
    // Sincronizar a cada 5 minutos
    const interval = setInterval(() => {
      sync(['products', 'orders']);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
```

### 4. Botão Manual de Sincronização

```typescript
function SyncButton() {
  const { syncing, progress, total, sync } = useSyncService();
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  useEffect(() => {
    async function checkUnsynced() {
      const orders = await LocalDB.getAll('orders');
      const unsynced = orders.filter(o => !o.payload._synced);
      setUnsyncedCount(unsynced.length);
    }
    checkUnsynced();
  }, []);

  return (
    <TouchableOpacity
      onPress={() => sync(['orders', 'products'])}
      disabled={syncing}
    >
      {syncing ? (
        <Text>Sincronizando {progress}/{total}</Text>
      ) : (
        <Text>Sincronizar ({unsyncedCount} pendentes)</Text>
      )}
    </TouchableOpacity>
  );
}
```

## 📋 Estrutura de Dados

### Registros Locais (PouchDB)

```typescript
{
  _id: string,
  _rev: string,
  table: string,
  payload: {
    ...yourData,
    _synced: boolean  // false = não sincronizado
  },
  createdAt: string,
  updatedAt: string
}
```

### Envio para Supabase

O `payload` é limpo antes do envio:
- Remove `_synced`
- Remove `_id`
- Remove `_createdAt`
- Remove `_updatedAt`

Apenas os dados originais são enviados.

## ⚙️ Configuração Avançada

### Sincronização com Filtros

```typescript
// Sincronizar apenas pedidos dos últimos 7 dias
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const { data, error } = await supabase
  .from('orders')
  .select('*')
  .gte('created_at', sevenDaysAgo.toISOString());

for (const order of data || []) {
  await LocalDB.save('orders', { ...order, _synced: true });
}
```

### Sincronização Seletiva

```typescript
// Sincronizar apenas produtos em estoque
const { data } = await supabase
  .from('products')
  .select('*')
  .gt('stock', 0);

for (const product of data || []) {
  await LocalDB.save('products', { ...product, _synced: true });
}
```

## 🔍 Métodos Auxiliares

### `isSyncInProgress()`

Verifica se há sincronização em andamento.

```typescript
if (SyncService.isSyncInProgress()) {
  console.log('Já está sincronizando...');
}
```

### `getLastSyncTime(table?: string)`

Retorna data da última sincronização.

```typescript
// Última sync de uma tabela específica
const lastSync = SyncService.getLastSyncTime('products');
console.log(lastSync); // Date | null

// Última sync de todas as tabelas
const allSyncs = SyncService.getLastSyncTime();
console.log(allSyncs); // { products: Date, orders: Date }
```

### `clearListeners()`

Remove todos os event listeners.

```typescript
SyncService.clearListeners();
```

### `getSyncMetadata(table: string)`

Retorna metadados de sincronização de uma tabela.

```typescript
const meta = await SyncService.getSyncMetadata('products');

console.log(`Tabela: ${meta.table}`);
console.log(`Último upload: ${meta.last_upload_at}`);
console.log(`Último download: ${meta.last_download_at}`);
```

### `getAllSyncMetadata()`

Retorna metadados de todas as tabelas.

```typescript
const allMeta = await SyncService.getAllSyncMetadata();

allMeta.forEach(meta => {
  console.log(`${meta.table}:`);
  console.log(`  Upload: ${meta.last_upload_at}`);
  console.log(`  Download: ${meta.last_download_at}`);
});
```

### `resetSyncMetadata(table: string)`

Reseta os metadados de sincronização de uma tabela (força download completo na próxima vez).

```typescript
await SyncService.resetSyncMetadata('products');
// Próximo download será completo, não incremental
```

### `resetAllSyncMetadata()`

Reseta todos os metadados de sincronização.

```typescript
await SyncService.resetAllSyncMetadata();
// Todas as tabelas farão download completo na próxima sincronização
```

## 📊 Monitoramento de Sincronização

### Verificar Status de Sincronização

```typescript
import SyncService from '@/lib/SyncService';

async function checkSyncStatus() {
  const allMeta = await SyncService.getAllSyncMetadata();

  console.log('📊 Status de Sincronização:');
  console.log('');

  for (const meta of allMeta) {
    console.log(`Tabela: ${meta.table}`);

    if (meta.last_download_at) {
      const lastDownload = new Date(meta.last_download_at);
      const minutesAgo = Math.floor((Date.now() - lastDownload.getTime()) / 60000);
      console.log(`  ⬇️ Último download: ${minutesAgo} minutos atrás`);
    } else {
      console.log(`  ⬇️ Último download: Nunca`);
    }

    if (meta.last_upload_at) {
      const lastUpload = new Date(meta.last_upload_at);
      const minutesAgo = Math.floor((Date.now() - lastUpload.getTime()) / 60000);
      console.log(`  ⬆️ Último upload: ${minutesAgo} minutos atrás`);
    } else {
      console.log(`  ⬆️ Último upload: Nunca`);
    }

    console.log('');
  }
}

// Usar em um componente
checkSyncStatus();
```

### Forçar Sincronização Completa

```typescript
// Reseta metadados para forçar download completo
await SyncService.resetSyncMetadata('products');

// Baixa tudo novamente
await SyncService.downloadTable('products');
```

## ⚠️ Avisos Importantes

1. **Conexão Obrigatória**: Download e upload requerem conexão com internet.

2. **Conflitos**: O serviço usa `upsert()` que sobrescreve dados. Para conflitos complexos, implemente lógica customizada.

3. **Tabelas no Supabase**: As tabelas devem existir no Supabase com a mesma estrutura.

4. **Campo updated_at**: Para sincronização incremental, suas tabelas no Supabase devem ter campo `updated_at`.

5. **Performance**: Para grandes volumes, considere:
   - Usar `batchSize`
   - Sincronizar em horários de baixo uso
   - Implementar paginação

6. **Segurança**: O serviço usa as credenciais do Supabase configuradas. Certifique-se de ter RLS configurado.

## 🧪 Exemplo Completo

Veja o componente `SyncExample.tsx` para um exemplo completo de interface.

## 📚 Recursos

- [PouchDB Sync](https://pouchdb.com/guides/replication.html)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Offline-First Architecture](https://offlinefirst.org/)
