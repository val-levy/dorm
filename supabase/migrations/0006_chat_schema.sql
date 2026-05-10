-- Phase 1: Chat Schema
-- channels, users_in_channels, messages, threads, message_reactions, presence
-- Note: threads <-> messages have a circular FK; threads is created first as a shell,
--       then root_message_id is added after messages exists.

-- ============================================================================
-- SEQUENCES
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS channels_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS users_in_channels_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS messages_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS threads_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS message_reactions_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS presence_id_seq START WITH 1;

-- ============================================================================
-- THREADS (shell — root_message_id FK added after messages)
-- ============================================================================
CREATE TABLE IF NOT EXISTS threads (
  id          bigint PRIMARY KEY DEFAULT nextval('threads_id_seq'::regclass),
  reply_count bigint DEFAULT 0,
  last_reply_at timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================================================
-- CHANNELS
-- ============================================================================
CREATE TABLE IF NOT EXISTS channels (
  id                    bigint PRIMARY KEY DEFAULT nextval('channels_id_seq'::regclass),
  chapter_id            bigint NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name                  varchar(255) NOT NULL,
  description           text,
  is_public             boolean DEFAULT true,
  is_announcement_only  boolean DEFAULT false,
  created_by            bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  deleted_at            timestamptz
);

CREATE INDEX IF NOT EXISTS idx_channels_chapter_id
  ON channels(chapter_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_name_chapter
  ON channels(chapter_id, name) WHERE deleted_at IS NULL;

-- ============================================================================
-- CHANNEL MEMBERSHIP
-- ============================================================================
CREATE TABLE IF NOT EXISTS users_in_channels (
  id                    bigint PRIMARY KEY DEFAULT nextval('users_in_channels_id_seq'::regclass),
  user_id               bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id            bigint NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  last_read_message_id  bigint,
  muted_until           timestamptz,
  joined_at             timestamptz DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_users_in_channels_user_id    ON users_in_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_users_in_channels_channel_id ON users_in_channels(channel_id);

-- ============================================================================
-- MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id             bigint PRIMARY KEY DEFAULT nextval('messages_id_seq'::regclass),
  channel_id     bigint NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  thread_id      bigint REFERENCES threads(id) ON DELETE SET NULL,
  author_id      bigint NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  content        text NOT NULL,
  attachments    jsonb DEFAULT '[]'::jsonb,
  mentions       jsonb DEFAULT '[]'::jsonb,
  content_search tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  deleted_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_id
  ON messages(channel_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_thread_id
  ON messages(thread_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_author_id
  ON messages(author_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_content_search
  ON messages USING GIN (content_search);
CREATE INDEX IF NOT EXISTS idx_messages_created_at
  ON messages(created_at DESC);

-- ============================================================================
-- COMPLETE THREADS — add root_message_id now that messages exists
-- ============================================================================
ALTER TABLE threads ADD COLUMN IF NOT EXISTS root_message_id bigint;

ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_root_message_id_fkey;
ALTER TABLE threads ADD CONSTRAINT threads_root_message_id_fkey
  FOREIGN KEY (root_message_id) REFERENCES messages(id) ON DELETE CASCADE;

ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_root_message_id_key;
ALTER TABLE threads ADD CONSTRAINT threads_root_message_id_key
  UNIQUE (root_message_id);

CREATE INDEX IF NOT EXISTS idx_threads_root_message_id ON threads(root_message_id);

-- ============================================================================
-- MESSAGE REACTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_reactions (
  id         bigint PRIMARY KEY DEFAULT nextval('message_reactions_id_seq'::regclass),
  message_id bigint NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      varchar(10) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);

-- ============================================================================
-- PRESENCE
-- ============================================================================
CREATE TABLE IF NOT EXISTS presence (
  id                    bigint PRIMARY KEY DEFAULT nextval('presence_id_seq'::regclass),
  user_id               bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id            bigint NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  status                varchar(20) DEFAULT 'OFFLINE',
  last_seen_at          timestamptz DEFAULT now(),
  is_typing             boolean DEFAULT false,
  typing_in_channel_id  bigint REFERENCES channels(id) ON DELETE SET NULL,
  updated_at            timestamptz DEFAULT now(),
  UNIQUE(user_id, chapter_id)
);

-- ============================================================================
-- REALTIME PUBLICATIONS
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE presence;

-- ============================================================================
-- ENABLE RLS
-- ============================================================================
ALTER TABLE channels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_in_channels  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads            ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence           ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS: CHANNELS
-- ============================================================================
CREATE POLICY "view accessible channels" ON channels
  FOR SELECT USING (
    deleted_at IS NULL AND (
      -- public channel in the user's chapter
      (is_public = true AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.auth_id = auth.uid() AND u.chapter_id = channels.chapter_id
      ))
      OR
      -- private channel the user explicitly joined
      EXISTS (
        SELECT 1 FROM users_in_channels uic
        JOIN users u ON u.id = uic.user_id
        WHERE u.auth_id = auth.uid() AND uic.channel_id = channels.id
      )
    )
  );

CREATE POLICY "create channels in own chapter" ON channels
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid() AND u.chapter_id = channels.chapter_id
    )
    AND (created_by IS NULL OR created_by IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    ))
  );

CREATE POLICY "chapter leads delete channels" ON channels
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN users u ON u.id = ur.user_id
      WHERE u.auth_id = auth.uid()
        AND ur.chapter_id = channels.chapter_id
        AND ur.role = 'CHAPTER_LEAD'
    )
  );

-- ============================================================================
-- RLS: USERS_IN_CHANNELS
-- ============================================================================
CREATE POLICY "view own channel memberships" ON users_in_channels
  FOR SELECT USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "join channels in own chapter" ON users_in_channels
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM channels c
      JOIN users u ON u.auth_id = auth.uid()
      WHERE c.id = channel_id
        AND c.chapter_id = u.chapter_id
        AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "leave channels" ON users_in_channels
  FOR DELETE USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "update own membership" ON users_in_channels
  FOR UPDATE
  USING    (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- ============================================================================
-- RLS: MESSAGES
-- ============================================================================
CREATE POLICY "view messages in joined channels" ON messages
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM users_in_channels uc
      JOIN users u ON u.id = uc.user_id
      WHERE u.auth_id = auth.uid() AND uc.channel_id = messages.channel_id
    )
  );

CREATE POLICY "post in joined channels" ON messages
  FOR INSERT WITH CHECK (
    author_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users_in_channels uc
      JOIN users u ON u.id = uc.user_id
      WHERE u.auth_id = auth.uid() AND uc.channel_id = messages.channel_id
    )
  );

CREATE POLICY "edit own messages" ON messages
  FOR UPDATE USING (
    author_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "delete own messages" ON messages
  FOR DELETE USING (
    author_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- ============================================================================
-- RLS: THREADS
-- ============================================================================
CREATE POLICY "view threads via channel membership" ON threads
  FOR SELECT USING (
    root_message_id IS NULL OR EXISTS (
      SELECT 1 FROM messages m
      JOIN users_in_channels uc ON uc.channel_id = m.channel_id
      JOIN users u ON u.id = uc.user_id
      WHERE u.auth_id = auth.uid() AND m.id = threads.root_message_id
    )
  );

CREATE POLICY "create threads" ON threads
  FOR INSERT WITH CHECK (true);

CREATE POLICY "update threads" ON threads
  FOR UPDATE USING (true);

-- ============================================================================
-- RLS: MESSAGE_REACTIONS
-- ============================================================================
CREATE POLICY "view reactions in joined channels" ON message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN users_in_channels uc ON uc.channel_id = m.channel_id
      JOIN users u ON u.id = uc.user_id
      WHERE u.auth_id = auth.uid() AND m.id = message_reactions.message_id
    )
  );

CREATE POLICY "add reactions" ON message_reactions
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM messages m
      JOIN users_in_channels uc ON uc.channel_id = m.channel_id
      JOIN users u ON u.id = uc.user_id
      WHERE u.auth_id = auth.uid() AND m.id = message_reactions.message_id
    )
  );

CREATE POLICY "remove own reactions" ON message_reactions
  FOR DELETE USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- ============================================================================
-- RLS: PRESENCE
-- ============================================================================
CREATE POLICY "view presence in own chapter" ON presence
  FOR SELECT USING (
    chapter_id IN (SELECT chapter_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "upsert own presence" ON presence
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "update own presence" ON presence
  FOR UPDATE USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- ============================================================================
-- SEED: Default channels for Oregon Blockchain
-- Seeded without a created_by user (system channels).
-- ============================================================================
INSERT INTO channels (chapter_id, name, description, is_public, is_announcement_only)
SELECT id, 'general', 'General discussion', true, false
FROM chapters WHERE name = 'Oregon Blockchain'
ON CONFLICT DO NOTHING;

INSERT INTO channels (chapter_id, name, description, is_public, is_announcement_only)
SELECT id, 'announcements', 'Chapter announcements', true, true
FROM chapters WHERE name = 'Oregon Blockchain'
ON CONFLICT DO NOTHING;
