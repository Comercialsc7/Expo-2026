# OfflineCache - Sistema de Pré-Cache para Modo Offline

Sistema completo para preparar o app para trabalhar sem conexão com internet.

## 🎯 Problema que Resolve

Quando você perde a conexão com a internet:
- ❌ Login para de funcionar (sessão é perdida)
- ❌ Listas ficam vazias (produtos, clientes, etc)
- ❌ App fica inutilizável

## ✅ Solução

**Preparar o app ANTES de perder a conexão:**

1. Salva sessão de autenticação no AsyncStorage
2. Faz cache de todas as tabelas importantes (TableStore)
3. App funciona 100% offline após preparação

## 📚 API

### `OfflineCache.prepare(tables)`

Prepara o app para trabalhar offline.

```typescript
import OfflineCache from '@/lib/OfflineCache';

const result = await OfflineCache.prepare([
  'products',
  'clients',
  'brands',
  'categories'
]);

console.log(result.success);  // true/false
console.log(result.cached);   // ["session", "products (1000 registros)", ...]
console.log(result.errors);   // ["brands", ...]
```

### `OfflineCache.isReady()`

Verifica se está preparado para offline.

```typescript
const status = await OfflineCache.isReady();

console.log(status.ready);        // true/false
console.log(status.session);      // true/false
console.log(status.tablesCount);  // 4
console.log(status.cachedAt);     // "2025-11-19T10:00:00Z"
```

### `OfflineCache.getSession()`

Recupera sessão salva (para usar offline).

```typescript
const session = await OfflineCache.getSession();

if (session) {
  console.log(session.user);
  console.log(session.access_token);
}
```

### `OfflineCache.getUser()`

Recupera dados do usuário.

```typescript
const user = await OfflineCache.getUser();

if (user) {
  console.log(user.email);
  console.log(user.id);
}
```

### `OfflineCache.hasValidSession()`

Verifica se há sessão válida no cache.

```typescript
const valid = await OfflineCache.hasValidSession();

if (valid) {
  console.log('Pode trabalhar offline');
} else {
  console.log('Precisa preparar novamente');
}
```

### `OfflineCache.isStale(maxAgeMinutes)`

Verifica se o cache está desatualizado.

```typescript
const stale = await OfflineCache.isStale(60); // 60 minutos

if (stale) {
  console.log('Cache antigo, precisa atualizar');
}
```

### `OfflineCache.clear()`

Limpa todo o cache offline.

```typescript
await OfflineCache.clear();
```

### `OfflineCache.updateSession()`

Atualiza apenas a sessão (após login).

```typescript
await OfflineCache.updateSession();
```

## 🚀 Como Usar

### 1. Adicionar Botão de Preparação

```typescript
import { OfflinePrepareButton } from '@/components/shared/OfflinePrepareButton';

function SettingsScreen() {
  return (
    <View>
      <Text>Configurações</Text>

      {/* Botão de preparação */}
      <OfflinePrepareButton />
    </View>
  );
}
```

### 2. Preparar Manualmente

```typescript
import { useOfflineCache } from '@/hooks/useOfflineCache';

function MyComponent() {
  const { prepare } = useOfflineCache();

  const handlePrepare = async () => {
    const result = await prepare([
      'products',
      'clients',
      'brands'
    ]);

    if (result.success) {
      Alert.alert('Pronto!', 'App preparado para modo offline');
    }
  };

  return (
    <Button title="Preparar Offline" onPress={handlePrepare} />
  );
}
```

### 3. Preparar Automaticamente Após Login

```typescript
import OfflineCache from '@/lib/OfflineCache';

async function handleLogin(email: string, password: string) {
  // Faz login
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    Alert.alert('Erro', error.message);
    return;
  }

  // Prepara automaticamente para offline
  await OfflineCache.prepare([
    'products',
    'clients',
    'brands',
    'categories'
  ]);

  Alert.alert('Sucesso', 'Login realizado e app preparado para offline!');
  router.replace('/home');
}
```

### 4. Verificar Status no Layout

```typescript
import { useOfflineCache } from '@/hooks/useOfflineCache';

function AppLayout() {
  const { ready, isOnline } = useOfflineCache();

  return (
    <View>
      {/* Indicador de status */}
      {!isOnline && !ready && (
        <View style={styles.warning}>
          <Text>⚠️ Offline e não preparado</Text>
        </View>
      )}

      {!isOnline && ready && (
        <View style={styles.success}>
          <Text>✅ Modo offline ativo</Text>
        </View>
      )}

      {/* Resto do app */}
      <Outlet />
    </View>
  );
}
```

## 🔄 Fluxo Completo

### Cenário 1: Preparação Manual

```
1. Usuário está ONLINE
   └─> Abre "Configurações"
   └─> Clica em "Preparar Modo Offline"
   └─> Sistema:
       ├─> Salva sessão no AsyncStorage
       ├─> Baixa produtos do Supabase → TableStore
       ├─> Baixa clientes do Supabase → TableStore
       └─> Salva timestamp
   └─> ✅ Pronto!

2. Usuário fica OFFLINE
   └─> Login funciona (sessão em cache)
   └─> Produtos carregam (TableStore)
   └─> Clientes carregam (TableStore)
   └─> App 100% funcional!
```

### Cenário 2: Preparação Automática

```
1. Usuário faz LOGIN (online)
   └─> Sistema autentica
   └─> Prepara automaticamente:
       ├─> Salva sessão
       ├─> Faz cache de tabelas
   └─> ✅ Pronto!

2. Usuário fica OFFLINE
   └─> App continua funcionando
```

### Cenário 3: Sem Preparação

```
1. Usuário faz LOGIN (online)
   └─> Sistema autentica
   └─> NÃO prepara cache

2. Usuário fica OFFLINE
   └─> ❌ Login não funciona
   └─> ❌ Listas ficam vazias
   └─> App inutilizável
```

## 📊 Status Visual

### App Preparado + Online

```
🟢 Online (Pronto)
✓ Sessão salva
✓ 4 tabelas em cache
✓ Atualizado: 5 min atrás

[🔄 Atualizar Cache]
```

### App Preparado + Offline

```
🔴 Offline (Pronto)
✓ Sessão salva
✓ 4 tabelas em cache
✓ Atualizado: 5 min atrás

(trabalhando offline)
```

### App NÃO Preparado + Online

```
🟡 Online (Não Preparado)

[📥 Preparar Modo Offline]
```

### App NÃO Preparado + Offline

```
🔴 Offline (Não Preparado)

⚠️ Para trabalhar offline, você precisa
preparar o app enquanto estiver online
```

## 🔧 Hook Personalizado

```typescript
import { useOfflineCache } from '@/hooks/useOfflineCache';

function MyComponent() {
  const {
    ready,          // boolean - está pronto?
    preparing,      // boolean - está preparando?
    info,           // { session, tablesCount, cachedAt }
    isOnline,       // boolean - está online?
    prepare,        // (tables: string[]) => Promise<result>
    clear,          // () => Promise<void>
    checkStale,     // (minutes: number) => Promise<boolean>
    updateSession,  // () => Promise<boolean>
    checkReady,     // () => Promise<void>
  } = useOfflineCache();

  return (
    <View>
      <Text>Status: {ready ? 'Pronto' : 'Não preparado'}</Text>
      <Text>Online: {isOnline ? 'Sim' : 'Não'}</Text>
      <Text>Tabelas: {info.tablesCount}</Text>

      <Button
        title="Preparar"
        onPress={() => prepare(['products'])}
        disabled={preparing}
      />
    </View>
  );
}
```

## 🎯 Exemplos de Integração

### Tela de Login

```typescript
import { supabase } from '@/lib/supabase';
import OfflineCache from '@/lib/OfflineCache';

function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (email: string, password: string) => {
    try {
      setLoading(true);

      // Login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // Prepara offline automaticamente
      await OfflineCache.prepare([
        'products',
        'clients',
        'brands',
        'categories'
      ]);

      router.replace('/home');
    } catch (error) {
      Alert.alert('Erro', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <TextInput placeholder="Email" />
      <TextInput placeholder="Senha" secureTextEntry />
      <Button title="Entrar" onPress={handleLogin} disabled={loading} />
    </View>
  );
}
```

### Tela de Configurações

```typescript
import { OfflinePrepareButton } from '@/components/shared/OfflinePrepareButton';

function SettingsScreen() {
  return (
    <ScrollView>
      <Text style={styles.title}>Configurações</Text>

      {/* Seção de Modo Offline */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Modo Offline</Text>
        <OfflinePrepareButton />
      </View>

      {/* Outras configurações */}
    </ScrollView>
  );
}
```

### Layout Principal

```typescript
import { useAuth } from '@/hooks/useAuth';
import { useOfflineCache } from '@/hooks/useOfflineCache';

function RootLayout() {
  const { user, loading, isOffline } = useAuth();
  const { ready } = useOfflineCache();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <View>
      {/* Badge de status */}
      {isOffline && (
        <View style={styles.offlineBadge}>
          <Text>{ready ? '🔴 Modo Offline' : '⚠️ Offline sem cache'}</Text>
        </View>
      )}

      {/* App */}
      <Stack>
        <Stack.Screen name="home" />
        <Stack.Screen name="settings" />
      </Stack>
    </View>
  );
}
```

## ⚠️ Requisitos

### 1. AsyncStorage

O OfflineCache usa AsyncStorage para salvar a sessão:

```bash
npm install @react-native-async-storage/async-storage
```

### 2. TableStore

O OfflineCache depende do TableStore para cachear tabelas:

```typescript
import TableStore from '@/lib/TableStore';
```

### 3. Campo updated_at

Suas tabelas devem ter campo `updated_at` para sincronização:

```sql
ALTER TABLE products
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
```

## 🧪 Testando

### 1. Teste de Preparação

```typescript
// Com internet
const result = await OfflineCache.prepare(['products']);

console.log(result.success);  // true
console.log(result.cached);   // ["session", "products (1000 registros)"]
```

### 2. Teste de Funcionamento Offline

```typescript
// Desligue WiFi e Dados
const user = await OfflineCache.getUser();
const products = await TableStore.get('products');

console.log(user);      // { email: "...", id: "..." }
console.log(products);  // [{ id: 1, name: "..." }, ...]
```

### 3. Teste de Sessão Válida

```typescript
const valid = await OfflineCache.hasValidSession();
console.log(valid);  // true/false
```

## 📋 Checklist de Implementação

- [ ] Instalar AsyncStorage
- [ ] Criar botão/componente de preparação
- [ ] Adicionar preparação após login
- [ ] Atualizar hook useAuth para usar cache
- [ ] Testar com WiFi desligado
- [ ] Adicionar indicador visual de status
- [ ] Documentar para usuários

## 💡 Dicas

1. **Prepare após o login**: Melhor momento para fazer cache
2. **Atualize periodicamente**: Cache pode ficar desatualizado
3. **Mostre status**: Usuário precisa saber se está pronto
4. **Teste offline**: Sempre teste com WiFi desligado
5. **Cache seletivo**: Não precisa cachear tudo, só o essencial

## 🔍 Debugging

### Verificar se está preparado

```typescript
const status = await OfflineCache.isReady();
console.log('Ready:', status.ready);
console.log('Session:', status.session);
console.log('Tables:', status.tablesCount);
```

### Ver informações completas

```typescript
const info = await OfflineCache.getInfo();
console.log('Session:', info.session);
console.log('User:', info.user);
console.log('Cached At:', info.cachedAt);
console.log('Tables:', info.tables);
console.log('Is Stale:', info.isStale);
```

### Limpar e recomeçar

```typescript
await OfflineCache.clear();
await OfflineCache.prepare(['products', 'clients']);
```
