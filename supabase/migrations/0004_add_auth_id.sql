-- Add auth_id (Supabase Auth UUID) to users so RLS can use auth.uid() correctly.
-- The original users.id is bigint which cannot be compared to auth.uid() (uuid).

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id) WHERE auth_id IS NOT NULL;

-- Fix the broken SELECT policy (was comparing uuid to bigint via ::text cast)
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT
  USING (auth_id = auth.uid() OR email = auth.jwt() ->> 'email');

-- Fix user_roles SELECT policy (was comparing uuid to bigint)
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT
  USING (user_id IN (
    SELECT id FROM users WHERE auth_id = auth.uid()
  ));
