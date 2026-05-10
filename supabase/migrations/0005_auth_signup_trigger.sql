-- Provision a public user profile and MEMBER role when a new auth user signs up.
-- SECURITY DEFINER runs as the function owner (postgres superuser), bypassing RLS.
-- In production, wire the on_auth_signup Edge Function as a Supabase Auth webhook instead.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain     text;
  v_chapter_id bigint;
  v_user_id    bigint;
BEGIN
  v_domain := lower(split_part(NEW.email, '@', 2));

  SELECT chapter_id INTO v_chapter_id
  FROM chapter_domains
  WHERE email_domain = v_domain
  LIMIT 1;

  INSERT INTO users (email, auth_id, chapter_id)
  VALUES (NEW.email, NEW.id, v_chapter_id)
  ON CONFLICT (email) DO UPDATE
    SET auth_id    = EXCLUDED.auth_id,
        chapter_id = COALESCE(users.chapter_id, EXCLUDED.chapter_id)
  RETURNING id INTO v_user_id;

  IF v_chapter_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, chapter_id, role)
    VALUES (v_user_id, v_chapter_id, 'MEMBER')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
