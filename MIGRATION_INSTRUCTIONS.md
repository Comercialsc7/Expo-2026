# 🗄️ Instruções para Aplicar Migrações no Novo Banco Supabase

## ✅ Conexão Verificada
- URL: `https://wuappvtbbjzdtgrcenwk.supabase.co`
- Conexão testada com sucesso!

## 📋 Passos para Aplicar as Migrações

### Opção 1: Via Dashboard do Supabase (Recomendado)

1. **Acesse o SQL Editor do seu projeto:**
   ```
   https://supabase.com/dashboard/project/wuappvtbbjzdtgrcenwk/sql/new
   ```

2. **Aplique a migração principal:**
   - Abra o arquivo: `supabase/migrations/20250120_complete_schema.sql`
   - Copie TODO o conteúdo
   - Cole no SQL Editor do Supabase
   - Clique em "Run" (ou pressione Ctrl+Enter)

3. **Verifique se foi criado com sucesso:**
   - Vá em "Table Editor" no dashboard
   - Você deve ver as seguintes tabelas:
     - users
     - clients
     - products
     - orders
     - order_items
     - brands
     - spin_prizes
     - teams

### Opção 2: Via Linha de Comando (Se tiver Supabase CLI instalado)

```bash
# 1. Faça login no Supabase CLI
supabase login

# 2. Link com o projeto
supabase link --project-ref wuappvtbbjzdtgrcenwk

# 3. Aplique as migrações
supabase db push
```

## 📊 O Que Será Criado

### Tabelas:
- **users** - Usuários do sistema
- **clients** - Clientes da empresa
- **products** - Produtos disponíveis
- **orders** - Pedidos realizados
- **order_items** - Itens dos pedidos
- **brands** - Marcas dos produtos
- **spin_prizes** - Prêmios da roleta
- **teams** - Times de vendas (com 4 times pré-cadastrados)

### Segurança:
- Row Level Security (RLS) habilitado em todas as tabelas
- Políticas de acesso para usuários autenticados
- Restrições de leitura/escrita apropriadas

## ✅ Após Aplicar a Migração

Seu aplicativo estará pronto para:
- Criar e gerenciar pedidos
- Cadastrar clientes e produtos
- Gerenciar marcas
- Sistema de roleta de prêmios
- Gestão de times de vendas

## 🔍 Verificação

Para verificar se tudo foi aplicado corretamente, execute esta query no SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Você deve ver as 8 tabelas listadas acima.
