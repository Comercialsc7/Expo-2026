/*
  # Schema Inicial do Sistema

  1. Novas Tabelas
    - `teams` - Equipes de vendas
      - `id` (uuid, primary key)
      - `code` (integer, unique) - Código numérico da equipe
      - `name` (text) - Nome da equipe
      - `created_at` (timestamptz)
    
    - `users` - Usuários/Vendedores do sistema
      - `id` (uuid, primary key)
      - `user_id` (text, unique) - Código do vendedor
      - `name` (text) - Nome do vendedor
      - `team_id` (integer) - FK para teams.code
      - `created_at` (timestamptz)

    - `clients` - Clientes
      - `id` (uuid, primary key)
      - `code` (text, unique) - Código do cliente
      - `name` (text) - Nome do cliente
      - `cnpj` (text) - CNPJ do cliente
      - `address` (text) - Endereço
      - `equipe` (integer) - Código da equipe
      - `repre` (text) - Código do representante
      - `created_at` (timestamptz)

    - `prazos` - Prazos de pagamento
      - `id` (uuid, primary key)
      - `prazo` (text) - Descrição do prazo
      - `dias` (integer) - Número de dias
      - `created_at` (timestamptz)

    - `relacao_prazo` - Relação entre clientes e prazos
      - `id` (uuid, primary key)
      - `codcli` (text) - FK para clients.code
      - `diamax` (integer) - Dias máximos permitidos
      - `created_at` (timestamptz)

    - `products` - Produtos
      - `id` (uuid, primary key)
      - `code` (text, unique) - Código do produto
      - `name` (text) - Nome do produto
      - `price` (decimal) - Preço
      - `box_size` (integer) - Tamanho da embalagem
      - `is_accelerator` (boolean) - Se é item acelerador
      - `image_url` (text) - URL da imagem
      - `created_at` (timestamptz)

    - `brands` - Marcas
      - `id` (uuid, primary key)
      - `code` (text, unique) - Código da marca
      - `name` (text) - Nome da marca
      - `image_url` (text) - URL da imagem
      - `created_at` (timestamptz)

    - `pedidos` - Pedidos
      - `id` (uuid, primary key)
      - `pedido_id` (text, unique) - ID do pedido
      - `vendedor_codigo` (text) - Código do vendedor
      - `cliente_code` (text) - Código do cliente
      - `cliente_nome` (text) - Nome do cliente
      - `email` (text) - Email
      - `produtos` (jsonb) - Array de produtos
      - `subtotal` (decimal) - Subtotal
      - `desconto` (decimal) - Desconto
      - `total` (decimal) - Total
      - `prazo_pagamento` (text) - Prazo de pagamento
      - `premio_imagem_url` (text) - URL da imagem do prêmio
      - `status_envio` (text) - Status do envio
      - `created_at` (timestamptz)

  2. Segurança
    - Habilitar RLS em todas as tabelas
    - Adicionar políticas de acesso para usuários autenticados
    
  3. Dados Iniciais
    - Criar equipe "Vendas Internas" com código 1
    - Criar vendedor 899 na equipe "Vendas Internas"
*/

-- Criar tabela de equipes
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code integer UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text UNIQUE NOT NULL,
  name text NOT NULL,
  team_id integer NOT NULL REFERENCES teams(code),
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de clientes
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  cnpj text NOT NULL,
  address text DEFAULT '',
  equipe integer DEFAULT 0,
  repre text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de prazos
CREATE TABLE IF NOT EXISTS prazos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prazo text NOT NULL,
  dias integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de relação de prazos
CREATE TABLE IF NOT EXISTS relacao_prazo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codcli text NOT NULL REFERENCES clients(code),
  diamax integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de produtos
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  price decimal(10,2) NOT NULL DEFAULT 0,
  box_size integer DEFAULT 0,
  is_accelerator boolean DEFAULT false,
  image_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de marcas
CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  image_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id text UNIQUE NOT NULL,
  vendedor_codigo text DEFAULT '',
  cliente_code text NOT NULL,
  cliente_nome text NOT NULL,
  email text DEFAULT '',
  produtos jsonb DEFAULT '[]'::jsonb,
  subtotal decimal(10,2) DEFAULT 0,
  desconto decimal(10,2) DEFAULT 0,
  total decimal(10,2) DEFAULT 0,
  prazo_pagamento text DEFAULT '',
  premio_imagem_url text DEFAULT '',
  status_envio text DEFAULT 'pendente',
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE prazos ENABLE ROW LEVEL SECURITY;
ALTER TABLE relacao_prazo ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- Políticas para teams
CREATE POLICY "Permitir leitura de equipes para todos"
  ON teams FOR SELECT
  TO public
  USING (true);

-- Políticas para users
CREATE POLICY "Permitir leitura de usuários para todos"
  ON users FOR SELECT
  TO public
  USING (true);

-- Políticas para clients
CREATE POLICY "Permitir leitura de clientes para todos"
  ON clients FOR SELECT
  TO public
  USING (true);

-- Políticas para prazos
CREATE POLICY "Permitir leitura de prazos para todos"
  ON prazos FOR SELECT
  TO public
  USING (true);

-- Políticas para relacao_prazo
CREATE POLICY "Permitir leitura de relação de prazos para todos"
  ON relacao_prazo FOR SELECT
  TO public
  USING (true);

-- Políticas para products
CREATE POLICY "Permitir leitura de produtos para todos"
  ON products FOR SELECT
  TO public
  USING (true);

-- Políticas para brands
CREATE POLICY "Permitir leitura de marcas para todos"
  ON brands FOR SELECT
  TO public
  USING (true);

-- Políticas para pedidos
CREATE POLICY "Permitir inserção de pedidos para todos"
  ON pedidos FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Permitir leitura de pedidos para todos"
  ON pedidos FOR SELECT
  TO public
  USING (true);

-- Inserir equipe "Vendas Internas"
INSERT INTO teams (code, name) VALUES (1, 'Vendas Internas')
ON CONFLICT (code) DO NOTHING;

-- Inserir vendedor 899 na equipe "Vendas Internas"
INSERT INTO users (user_id, name, team_id) VALUES ('899', 'Vendedor 899', 1)
ON CONFLICT (user_id) DO NOTHING;