/*
  # Complete Database Schema Recreation

  This migration recreates the entire database structure for the D'Muller application.

  ## New Tables

  ### 1. users
  - `id` (uuid, primary key) - Unique user identifier
  - `email` (text, unique, not null) - User email address
  - `created_at` (timestamptz) - Record creation timestamp

  ### 2. clients
  - `id` (uuid, primary key) - Unique client identifier
  - `code` (text, unique, not null) - Client code
  - `name` (text, not null) - Legal company name
  - `fantasy_name` (text) - Trade/fantasy name
  - `cnpj` (text, unique, not null) - Brazilian tax ID
  - `address` (text) - Client address
  - `created_at` (timestamptz) - Record creation timestamp
  - `created_by` (uuid, references users) - User who created the client

  ### 3. products
  - `id` (uuid, primary key) - Unique product identifier
  - `code` (text, unique, not null) - Product code
  - `name` (text, not null) - Product name
  - `price` (decimal) - Product price
  - `box_size` (integer) - Units per box
  - `is_accelerator` (boolean) - Whether product is an accelerator
  - `image_url` (text) - Product image URL
  - `created_at` (timestamptz) - Record creation timestamp

  ### 4. orders
  - `id` (uuid, primary key) - Unique order identifier
  - `client_id` (uuid, references clients, not null) - Associated client
  - `user_id` (uuid, references users, not null) - User who created the order
  - `payment_term_days` (integer, not null) - Payment term in days
  - `payment_term_description` (text, not null) - Payment term description
  - `subtotal` (decimal, default 0) - Order subtotal
  - `discount` (decimal, default 0) - Order discount
  - `total` (decimal, default 0) - Order total amount
  - `status` (text, default 'pending') - Order status
  - `created_at` (timestamptz) - Record creation timestamp

  ### 5. order_items
  - `id` (uuid, primary key) - Unique order item identifier
  - `order_id` (uuid, references orders, not null) - Associated order
  - `product_id` (uuid, references products, not null) - Associated product
  - `quantity` (integer, default 0) - Quantity ordered
  - `price` (decimal, default 0) - Unit price
  - `discount` (decimal, default 0) - Item discount
  - `total` (decimal, default 0) - Item total

  ### 6. brands
  - `id` (uuid, primary key) - Unique brand identifier
  - `code` (text, unique, not null) - Brand code
  - `name` (text, not null) - Brand name
  - `image_url` (text) - Brand logo URL
  - `created_at` (timestamptz) - Record creation timestamp

  ### 7. spin_prizes
  - `id` (uuid, primary key) - Unique prize identifier
  - `order_id` (uuid, references orders, not null) - Associated order
  - `prize_description` (text, not null) - Prize description
  - `photo_url` (text) - Prize photo URL
  - `created_at` (timestamptz) - Record creation timestamp

  ### 8. teams
  - `id` (uuid, primary key) - Unique team identifier
  - `code` (integer, unique, not null) - Team code
  - `name` (text, not null) - Team name
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security

  - Row Level Security (RLS) is enabled on ALL tables
  - Policies are created for authenticated users to:
    - Read their own user data
    - Read and create clients, orders, products, brands, teams
    - Read and create order items and spin prizes

  ## Important Notes

  1. All tables use UUID as primary keys for better scalability
  2. Foreign keys ensure referential integrity
  3. Default values are set for numeric and boolean fields
  4. Timestamps are automatically set on creation
  5. RLS policies restrict access to authenticated users only
*/

-- ============================================================================
-- TABLE CREATION
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  fantasy_name text,
  cnpj text UNIQUE NOT NULL,
  address text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id)
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  price decimal(10,2) NOT NULL DEFAULT 0,
  box_size integer NOT NULL DEFAULT 0,
  is_accelerator boolean NOT NULL DEFAULT false,
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) NOT NULL,
  user_id uuid REFERENCES users(id) NOT NULL,
  payment_term_days integer NOT NULL,
  payment_term_description text NOT NULL,
  subtotal decimal(10,2) NOT NULL DEFAULT 0,
  discount decimal(10,2) NOT NULL DEFAULT 0,
  total decimal(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) NOT NULL,
  product_id uuid REFERENCES products(id) NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  price decimal(10,2) NOT NULL DEFAULT 0,
  discount decimal(10,2) NOT NULL DEFAULT 0,
  total decimal(10,2) NOT NULL DEFAULT 0
);

-- Brands table
CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- Spin prizes table
CREATE TABLE IF NOT EXISTS spin_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) NOT NULL,
  prize_description text NOT NULL,
  photo_url text,
  created_at timestamptz DEFAULT now()
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code integer UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE spin_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Users policies
CREATE POLICY "Users can read own data" ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Clients policies
CREATE POLICY "Users can read all clients" ON clients
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create clients" ON clients
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Products policies
CREATE POLICY "Users can read all products" ON products
  FOR SELECT TO authenticated
  USING (true);

-- Orders policies
CREATE POLICY "Users can read all orders" ON orders
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create orders" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Order items policies
CREATE POLICY "Users can read all order items" ON order_items
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create order items" ON order_items
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Brands policies
CREATE POLICY "Users can read all brands" ON brands
  FOR SELECT TO authenticated
  USING (true);

-- Spin prizes policies
CREATE POLICY "Users can read all spin prizes" ON spin_prizes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create spin prizes" ON spin_prizes
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Teams policies
CREATE POLICY "Users can read all teams" ON teams
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert initial teams data
INSERT INTO teams (code, name) VALUES
  (49, 'Litoral M'),
  (35, 'Litoral D'),
  (14, 'Floripa M'),
  (18, 'Floripa D')
ON CONFLICT (code) DO NOTHING;
