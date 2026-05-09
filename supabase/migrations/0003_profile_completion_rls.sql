-- Allow authenticated users to create and update their own profile row.
-- Auth users are UUIDs while the current public.users table uses bigint IDs,
-- so Phase 0 profile completion is matched by verified auth email.

CREATE POLICY "Users can create own profile" ON users
  FOR INSERT
  WITH CHECK (email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (email = auth.jwt() ->> 'email')
  WITH CHECK (email = auth.jwt() ->> 'email');
