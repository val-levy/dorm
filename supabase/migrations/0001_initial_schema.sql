-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create sequences used by bigint primary keys
CREATE SEQUENCE IF NOT EXISTS users_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS chapters_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS chapter_domains_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS user_roles_id_seq START WITH 1;

-- USERS table
CREATE TABLE IF NOT EXISTS users (
  id bigint PRIMARY KEY DEFAULT nextval('users_id_seq'::regclass),
  email varchar(255) NOT NULL UNIQUE,
  name varchar(255),
  bio text,
  avatar_url text,
  chapter_id bigint,
  wallet_mpc_address varchar(255),
  wallet_external_address varchar(255),
  jurisdiction varchar(2),
  is_restricted_jurisdiction boolean DEFAULT false,
  kyc_status varchar(20) DEFAULT 'NONE',
  kyc_provider_id varchar(255),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_chapter_id ON users(chapter_id) WHERE deleted_at IS NULL;

-- CHAPTERS table
CREATE TABLE IF NOT EXISTS chapters (
  id bigint PRIMARY KEY DEFAULT nextval('chapters_id_seq'::regclass),
  name varchar(255) NOT NULL,
  description text,
  avatar_url text,
  school_name varchar(255),
  location varchar(255),
  safe_address_base varchar(255),
  safe_address_arbitrum varchar(255),
  safe_threshold_base smallint DEFAULT 2,
  safe_signers_base smallint DEFAULT 3,
  daily_spend_cap_usd numeric(15,2) DEFAULT 50000.00,
  asset_allowlist text[],
  execution_cooldown_hours smallint DEFAULT 24,
  voting_method varchar(50) DEFAULT 'QUORUM_MAJORITY',
  quorum_percentage smallint DEFAULT 50,
  voting_duration_hours smallint DEFAULT 168,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chapters_safe_base ON chapters(safe_address_base) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chapters_name ON chapters(name) WHERE deleted_at IS NULL;

-- CHAPTER_DOMAINS table (for email whitelisting)
CREATE TABLE IF NOT EXISTS chapter_domains (
  id bigint PRIMARY KEY DEFAULT nextval('chapter_domains_id_seq'::regclass),
  chapter_id bigint NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  email_domain varchar(255) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(chapter_id, email_domain)
);

CREATE INDEX IF NOT EXISTS idx_chapter_domains_domain ON chapter_domains(email_domain);

-- ROLES enum
CREATE TYPE role_enum AS ENUM (
  'MEMBER',
  'ANALYST',
  'CHAPTER_LEAD',
  'TREASURY_SIGNER',
  'ORG_ADMIN',
  'OBSERVER'
);

-- USER_ROLES table
CREATE TABLE IF NOT EXISTS user_roles (
  id bigint PRIMARY KEY DEFAULT nextval('user_roles_id_seq'::regclass),
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id bigint REFERENCES chapters(id) ON DELETE CASCADE,
  role role_enum NOT NULL,
  promoted_by bigint REFERENCES users(id) ON DELETE SET NULL,
  promoted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_chapter_id ON user_roles(chapter_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_unique ON user_roles(user_id, chapter_id, role) WHERE deleted_at IS NULL;

ALTER SEQUENCE users_id_seq OWNED BY users.id;
ALTER SEQUENCE chapters_id_seq OWNED BY chapters.id;
ALTER SEQUENCE chapter_domains_id_seq OWNED BY chapter_domains.id;
ALTER SEQUENCE user_roles_id_seq OWNED BY user_roles.id;

-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_domains ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT
  USING (auth.uid()::text = id::text);

-- RLS: Authenticated users can view chapters
CREATE POLICY "Authenticated users can view chapters" ON chapters
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS: Users can view roles they have
CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- RLS: Users can view chapter domains
CREATE POLICY "Authenticated users can view chapter domains" ON chapter_domains
  FOR SELECT
  USING (auth.role() = 'authenticated');
