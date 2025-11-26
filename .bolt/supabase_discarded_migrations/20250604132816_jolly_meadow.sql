/*
  # Create teams table

  1. New Tables
    - `teams`
      - `id` (uuid, primary key)
      - `code` (integer, unique, not null)
      - `name` (text, not null)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `teams` table
    - Add policy for authenticated users to read all teams
*/

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code integer UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Create policy for reading teams
CREATE POLICY "Users can read all teams" ON teams
  FOR SELECT TO authenticated
  USING (true);

-- Insert initial teams data
INSERT INTO teams (code, name) VALUES
  (49, 'Litoral M'),
  (35, 'Litoral D'),
  (14, 'Floripa M'),
  (18, 'Floripa D');