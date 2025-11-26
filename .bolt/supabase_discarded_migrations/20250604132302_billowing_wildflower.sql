/*
  # Initial Schema Setup

  1. New Tables
    - users
      - id (uuid, primary key)
      - email (text)
      - created_at (timestamp)
      
    - clients
      - id (uuid, primary key)
      - code (text)
      - name (text)
      - fantasy_name (text)
      - cnpj (text)
      - address (text)
      - created_at (timestamp)
      - created_by (uuid, references users)
      
    - orders
      - id (uuid, primary key)
      - client_id (uuid, references clients)
      - user_id (uuid, references users)
      - payment_term_days (integer)
      - payment_term_description (text)
      - subtotal (decimal)
      - discount (decimal)
      - total (decimal)
      - status (text)
      - created_at (timestamp)
      
    - order_items
      - id (uuid, primary key)
      - order_id (uuid, references orders)
      - product_id (uuid, references products)
      - quantity (integer)
      - price (decimal)
      - discount (decimal)
      - total (decimal)
      
    - products
      - id (uuid, primary key)
      - code (text)
      - name (text)
      - price (decimal)
      - box_size (integer)
      - is_accelerator (boolean)
      - image_url (text)
      - created_at (timestamp)
      
    - brands
      - id (uuid, primary key)
      - code (text)
      - name (text)
      - image_url (text)
      - created_at (timestamp)
      
    - spin_prizes
      - id (uuid, primary key)
      - order_id (uuid, references orders)
      - prize_description (text)
      - photo_url (text)
      - created_at (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create tables
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) NOT NULL,
  product_id uuid REFERENCES products(id) NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  price decimal(10,2) NOT NULL DEFAULT 0,
  discount decimal(10,2) NOT NULL DEFAULT 0,
  total decimal(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spin_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) NOT NULL,
  prize_description text NOT NULL,
  photo_url text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE spin_prizes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own data" ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can read all clients" ON clients
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create clients" ON clients
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read all orders" ON orders
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create orders" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read all products" ON products
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can read all order items" ON order_items
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create order items" ON order_items
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read all brands" ON brands
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can read all spin prizes" ON spin_prizes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create spin prizes" ON spin_prizes
  FOR INSERT TO authenticated
  WITH CHECK (true);