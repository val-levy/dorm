# DormDAO Data Model

## Schema Overview

All tables use `bigint` IDs (auto-increment primary keys). Timestamps are UTC `timestamptz`. Soft deletes use `deleted_at` column (null = not deleted). Every table has `created_at` and `updated_at` for audit.

### Tables

1. **users** — user accounts
2. **chapters** — university chapters
3. **user_roles** — user role assignments (join table)
4. **channels** — chat channels
5. **users_in_channels** — channel membership
6. **messages** — chat messages
7. **message_reactions** — emoji reactions
8. **threads** — message threads
9. **posts** — blog/pitch posts
10. **comments** — post comments
11. **wallets** — member, chapter, treasury wallets
12. **proposals** — DAO proposals
13. **votes** — proposal votes
14. **transactions** — transaction records (unsigned → signed → broadcast → confirmed)
15. **transaction_signatures** — tx signature records
16. **policies** — wallet policies (spend cap, asset allowlist, etc.)
17. **audit_log** — immutable audit trail
18. **chapter_domains** — whitelisted email domains per chapter

---

## Full DDL

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "trgm";  -- for full-text search
CREATE EXTENSION IF NOT EXISTS "btree-gin";  -- for multi-column indexes

-- ============================================================================
-- USERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id bigint PRIMARY KEY DEFAULT nextval('users_id_seq'::regclass),
  
  -- Auth
  email varchar(255) NOT NULL UNIQUE,
  
  -- Profile
  name varchar(255),
  bio text,
  avatar_url text,  -- Supabase Storage URL
  
  -- Chapter & Role (denormalized for convenience; also in user_roles table)
  chapter_id bigint REFERENCES chapters(id) ON DELETE SET NULL,
  
  -- Wallets
  wallet_mpc_address varchar(255),  -- Turnkey MPC wallet address (e.g., 0x...)
  wallet_external_address varchar(255),  -- Optional: external wallet (e.g., Metamask)
  
  -- Compliance
  jurisdiction varchar(2),  -- ISO country code (inferred from IP/email)
  is_restricted_jurisdiction boolean DEFAULT false,  -- Cannot vote if true
  kyc_status varchar(20) DEFAULT 'NONE',  -- NONE, PENDING, APPROVED, DECLINED
  kyc_provider_id varchar(255),  -- Persona workflow ID or similar
  
  -- Lifecycle
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_chapter_id ON users(chapter_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_wallet_mpc ON users(wallet_mpc_address);

-- ============================================================================
-- CHAPTERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS chapters (
  id bigint PRIMARY KEY DEFAULT nextval('chapters_id_seq'::regclass),
  
  name varchar(255) NOT NULL,
  description text,
  avatar_url text,
  
  -- Geographic
  school_name varchar(255),
  location varchar(255),
  
  -- Wallet Addresses
  safe_address_base varchar(255) NOT NULL,  -- Safe multisig on Base
  safe_address_arbitrum varchar(255),  -- Safe multisig on Arbitrum (backup)
  safe_threshold_base smallint DEFAULT 2,  -- N-of-M (N value)
  safe_signers_base smallint DEFAULT 3,  -- N-of-M (M value)
  
  -- Policies
  daily_spend_cap_usd numeric(15,2) DEFAULT 50000.00,
  asset_allowlist text[],  -- ['BTC', 'ETH', 'USDC', ...]
  execution_cooldown_hours smallint DEFAULT 24,
  
  -- Governance
  voting_method varchar(50) DEFAULT 'QUORUM_MAJORITY',  -- SIMPLE_MAJORITY, QUORUM_MAJORITY, TOKEN_WEIGHTED, CONVICTION
  quorum_percentage smallint DEFAULT 50,  -- % of members required for quorum
  voting_duration_hours smallint DEFAULT 168,  -- 1 week default
  
  -- Lifecycle
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chapters_safe_base ON chapters(safe_address_base) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chapters_name ON chapters(name) WHERE deleted_at IS NULL;

-- ============================================================================
-- CHAPTER DOMAINS (for email whitelisting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chapter_domains (
  id bigint PRIMARY KEY DEFAULT nextval('chapter_domains_id_seq'::regclass),
  
  chapter_id bigint NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  email_domain varchar(255) NOT NULL,  -- e.g., 'harvard.edu'
  
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(chapter_id, email_domain)
);

CREATE INDEX IF NOT EXISTS idx_chapter_domains_domain ON chapter_domains(email_domain);

-- ============================================================================
-- ROLES
-- ============================================================================

CREATE TYPE role_enum AS ENUM (
  'MEMBER',
  'ANALYST',
  'CHAPTER_LEAD',
  'TREASURY_SIGNER',
  'ORG_ADMIN',
  'OBSERVER'
);

CREATE TABLE IF NOT EXISTS user_roles (
  id bigint PRIMARY KEY DEFAULT nextval('user_roles_id_seq'::regclass),
  
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id bigint REFERENCES chapters(id) ON DELETE CASCADE,  -- null = org-wide role
  role role_enum NOT NULL,
  
  promoted_by bigint REFERENCES users(id) ON DELETE SET NULL,  -- who promoted this user
  promoted_at timestamptz DEFAULT now(),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_chapter_id ON user_roles(chapter_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_unique ON user_roles(user_id, chapter_id, role) WHERE deleted_at IS NULL;

-- ============================================================================
-- CHANNELS (Chat)
-- ============================================================================

CREATE TABLE IF NOT EXISTS channels (
  id bigint PRIMARY KEY DEFAULT nextval('channels_id_seq'::regclass),
  
  chapter_id bigint NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  
  name varchar(255) NOT NULL,
  description text,
  
  is_public boolean DEFAULT false,
  is_announcement_only boolean DEFAULT false,  -- only Chapter Leads can post
  
  created_by bigint NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_channels_chapter_id ON channels(chapter_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_name_chapter ON channels(chapter_id, name) WHERE deleted_at IS NULL;

-- Special org-wide channel (created at init)
-- INSERT INTO channels (chapter_id, name, is_public, created_by) VALUES (null, '#announcements', true, 1);

-- ============================================================================
-- CHANNEL MEMBERSHIP
-- ============================================================================

CREATE TABLE IF NOT EXISTS users_in_channels (
  id bigint PRIMARY KEY DEFAULT nextval('users_in_channels_id_seq'::regclass),
  
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id bigint NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  
  last_read_message_id bigint,  -- for unread badge
  muted_until timestamptz,  -- null = not muted
  
  joined_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_users_in_channels_user_id ON users_in_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_users_in_channels_channel_id ON users_in_channels(channel_id);

-- ============================================================================
-- MESSAGES (Chat)
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id bigint PRIMARY KEY DEFAULT nextval('messages_id_seq'::regclass),
  
  channel_id bigint NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  thread_id bigint REFERENCES threads(id) ON DELETE SET NULL,  -- null = root message
  
  author_id bigint NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  content text NOT NULL,
  
  -- Rich text metadata (JSON)
  attachments jsonb DEFAULT '[]'::jsonb,  -- [{url, name, size, type}, ...]
  mentions jsonb DEFAULT '[]'::jsonb,  -- [{user_id, display_name}, ...]
  
  -- Full-text search
  content_search tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  
  -- Lifecycle
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz  -- soft delete
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_author_id ON messages(author_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_content_search ON messages USING GIN (content_search);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ============================================================================
-- THREADS
-- ============================================================================

CREATE TABLE IF NOT EXISTS threads (
  id bigint PRIMARY KEY DEFAULT nextval('threads_id_seq'::regclass),
  
  root_message_id bigint NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
  
  reply_count bigint DEFAULT 0,
  last_reply_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_threads_root_message_id ON threads(root_message_id);

-- ============================================================================
-- MESSAGE REACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_reactions (
  id bigint PRIMARY KEY DEFAULT nextval('message_reactions_id_seq'::regclass),
  
  message_id bigint NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  emoji varchar(10) NOT NULL,  -- '👍', '❤️', '🚀', '🧠', custom text
  
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;

-- ============================================================================
-- PRESENCE (cached, not stored long-term)
-- ============================================================================

CREATE TABLE IF NOT EXISTS presence (
  id bigint PRIMARY KEY DEFAULT nextval('presence_id_seq'::regclass),
  
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id bigint NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  
  status varchar(20) DEFAULT 'OFFLINE',  -- ONLINE, AWAY, OFFLINE
  last_seen_at timestamptz DEFAULT now(),
  
  is_typing boolean DEFAULT false,
  typing_in_channel_id bigint REFERENCES channels(id) ON DELETE SET NULL,
  
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, chapter_id)
);

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE presence;

-- ============================================================================
-- POSTS (Blog / Pitches)
-- ============================================================================

CREATE TABLE IF NOT EXISTS posts (
  id bigint PRIMARY KEY DEFAULT nextval('posts_id_seq'::regclass),
  
  chapter_id bigint NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  author_id bigint NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  
  title varchar(500) NOT NULL,
  body text NOT NULL,  -- Rich text (Tiptap JSON or Markdown)
  
  target_assets text[],  -- ['BTC', 'ETH', 'USDC']
  time_horizon varchar(20),  -- '1M', '3M', '1Y', '5Y+'
  conviction_score smallint,  -- 1-10
  
  is_pinned boolean DEFAULT false,
  pinned_by bigint REFERENCES users(id) ON DELETE SET NULL,
  pinned_at timestamptz,
  
  -- For full-text search
  content_search tsvector GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || body)) STORED,
  
  -- Lifecycle
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_posts_chapter_id ON posts(chapter_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_content_search ON posts USING GIN (content_search);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_target_assets ON posts USING GIN (target_assets);

-- ============================================================================
-- POST COMMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS comments (
  id bigint PRIMARY KEY DEFAULT nextval('comments_id_seq'::regclass),
  
  post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id bigint NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  parent_comment_id bigint REFERENCES comments(id) ON DELETE CASCADE,  -- for nested comments
  
  body text NOT NULL,
  mentions jsonb DEFAULT '[]'::jsonb,  -- [{user_id, display_name}, ...]
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id ON comments(parent_comment_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- POST REACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS post_reactions (
  id bigint PRIMARY KEY DEFAULT nextval('post_reactions_id_seq'::regclass),
  
  post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  emoji varchar(10) NOT NULL,  -- '👍', '❤️', '🚀', etc.
  
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(post_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON post_reactions(post_id);

-- ============================================================================
-- PROPOSALS (DAO Voting)
-- ============================================================================

CREATE TYPE proposal_action AS ENUM ('BUY', 'SELL', 'REBALANCE', 'GOVERNANCE');
CREATE TYPE proposal_status AS ENUM ('DRAFT', 'VOTING', 'PASSED', 'FAILED', 'APPROVED', 'EXECUTING', 'EXECUTED', 'CANCELLED');
CREATE TYPE voting_method AS ENUM ('SIMPLE_MAJORITY', 'QUORUM_MAJORITY', 'TOKEN_WEIGHTED', 'CONVICTION');

CREATE TABLE IF NOT EXISTS proposals (
  id bigint PRIMARY KEY DEFAULT nextval('proposals_id_seq'::regclass),
  
  chapter_id bigint NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  proposer_id bigint NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  linked_post_id bigint REFERENCES posts(id) ON DELETE SET NULL,  -- link to pitch
  
  title varchar(500) NOT NULL,
  body text NOT NULL,  -- Rich text
  
  -- Action Details
  action proposal_action NOT NULL,
  target_wallet varchar(50),  -- 'MEMBER' / 'CHAPTER' / 'TREASURY'
  target_asset varchar(20),  -- 'BTC', 'ETH', etc.
  target_amount numeric(20, 8),  -- in native units (e.g., 0.5 BTC)
  target_usd_equivalent numeric(15, 2),  -- for quick reference
  recipient_address varchar(255),  -- for BUY (destination); null for internal transfers
  
  -- Voting Config
  voting_method voting_method,
  quorum_percentage smallint,  -- 0-100
  voting_start_at timestamptz DEFAULT now(),
  voting_end_at timestamptz NOT NULL,
  
  -- Results
  status proposal_status DEFAULT 'DRAFT',
  
  yes_votes bigint DEFAULT 0,
  no_votes bigint DEFAULT 0,
  abstain_votes bigint DEFAULT 0,
  total_eligible_voters bigint,  -- snapshot at vote start
  
  vote_merkle_root varchar(255),  -- Merkle root of all votes (hex string)
  vote_merkle_signature varchar(500),  -- Signed by org key
  on_chain_receipt_tx_hash varchar(255),  -- Base chain tx that posted merkle root
  on_chain_receipt_contract_address varchar(255),  -- Vote receipt contract address
  
  -- Execution (if action is BUY/SELL)
  execution_tx_id bigint REFERENCES transactions(id) ON DELETE SET NULL,
  
  -- Discussion Channel
  discussion_channel_id bigint REFERENCES channels(id) ON DELETE SET NULL,
  
  -- Lifecycle
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_proposals_chapter_id ON proposals(chapter_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_voting_end_at ON proposals(voting_end_at) WHERE deleted_at IS NULL AND status = 'VOTING';
CREATE INDEX IF NOT EXISTS idx_proposals_proposer_id ON proposals(proposer_id) WHERE deleted_at IS NULL;

-- Realtime publication (for vote count updates)
ALTER PUBLICATION supabase_realtime ADD TABLE proposals;

-- ============================================================================
-- VOTES
-- ============================================================================

CREATE TYPE vote_choice AS ENUM ('YES', 'NO', 'ABSTAIN');

CREATE TABLE IF NOT EXISTS votes (
  id bigint PRIMARY KEY DEFAULT nextval('votes_id_seq'::regclass),
  
  proposal_id bigint NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  voter_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  choice vote_choice NOT NULL,
  
  -- For conviction voting
  lock_in_days smallint DEFAULT 0,  -- voter pre-committed to lock for N days
  voting_power numeric(10, 2) DEFAULT 1.0,  -- 1.0 = 1x power; 3.0 for 3M lock = 3x
  
  -- Delegation (voter delegates to someone else)
  delegated_to bigint REFERENCES users(id) ON DELETE SET NULL,
  delegation_depth smallint DEFAULT 0,  -- depth in delegation chain (max 2)
  
  -- Verification data (for on-chain verification of vote)
  vote_hash varchar(255),  -- Keccak256 hash of (proposalId, voterAddress, choice)
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(proposal_id, voter_id)  -- one vote per voter per proposal
);

CREATE INDEX IF NOT EXISTS idx_votes_proposal_id ON votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_id ON votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_votes_delegated_to ON votes(delegated_to);

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE votes;

-- ============================================================================
-- WALLETS (Member, Chapter, Treasury)
-- ============================================================================

CREATE TYPE wallet_type AS ENUM ('MEMBER_MPC', 'CHAPTER_SAFE', 'TREASURY_SAFE');
CREATE TYPE wallet_status AS ENUM ('ACTIVE', 'PAUSED', 'EMERGENCY_PAUSE');

CREATE TABLE IF NOT EXISTS wallets (
  id bigint PRIMARY KEY DEFAULT nextval('wallets_id_seq'::regclass),
  
  type wallet_type NOT NULL,
  
  -- Ownership
  user_id bigint REFERENCES users(id) ON DELETE CASCADE,  -- for MEMBER_MPC
  chapter_id bigint REFERENCES chapters(id) ON DELETE CASCADE,  -- for CHAPTER_SAFE and TREASURY_SAFE
  
  address varchar(255) NOT NULL UNIQUE,  -- 0x...
  chain varchar(20) NOT NULL,  -- 'base', 'arbitrum'
  
  label varchar(255),  -- e.g., "Harvard Chapter Main Safe"
  
  -- Safe Specifics
  threshold smallint,  -- N-of-M
  signer_count smallint,
  signer_addresses text[],  -- array of signer EOAs
  
  -- Status
  status wallet_status DEFAULT 'ACTIVE',
  emergency_pause_until timestamptz,  -- when emergency pause expires
  
  -- Balances (cached, updated off-chain)
  balance_native numeric(20, 8),  -- in native token (ETH, etc.)
  balance_updated_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_wallets_type ON wallets(type);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_chapter_id ON wallets(chapter_id);
CREATE INDEX IF NOT EXISTS idx_wallets_chain ON wallets(chain);

-- ============================================================================
-- TRANSACTIONS (Proposal Execution)
-- ============================================================================

CREATE TYPE tx_status AS ENUM (
  'UNSIGNED',      -- constructed, awaiting signatures
  'SIGNED',        -- all required signatures collected
  'BROADCASTING',  -- being broadcast to chain
  'PENDING',       -- in mempool
  'CONFIRMED',     -- mined and confirmed
  'FAILED',        -- reverted or dropped
  'CANCELLED'      -- manually cancelled
);

CREATE TABLE IF NOT EXISTS transactions (
  id bigint PRIMARY KEY DEFAULT nextval('transactions_id_seq'::regclass),
  
  proposal_id bigint NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  wallet_id bigint NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  
  -- Execution Details
  status tx_status DEFAULT 'UNSIGNED',
  
  -- Safe Transaction Encoding
  to_address varchar(255) NOT NULL,  -- recipient
  amount numeric(20, 8) NOT NULL,  -- in native token
  data text,  -- hex-encoded tx data (for swaps, etc.)
  
  -- Blockchain
  chain varchar(20) NOT NULL,
  estimated_gas numeric(10, 0),
  actual_gas_used numeric(10, 0),
  gas_price numeric(20, 0),  -- in wei
  
  -- Signing
  required_signers bigint[],  -- array of user IDs
  signatures_collected bigint DEFAULT 0,
  threshold_signatures smallint,  -- how many needed
  
  -- On-Chain
  tx_hash varchar(255),  -- 0x...
  block_number bigint,
  block_hash varchar(255),
  confirmed_at timestamptz,
  
  -- Metadata
  error_reason text,  -- if FAILED, why
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_proposal_id ON transactions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_chain ON transactions(chain);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- ============================================================================
-- TRANSACTION SIGNATURES
-- ============================================================================

CREATE TABLE IF NOT EXISTS transaction_signatures (
  id bigint PRIMARY KEY DEFAULT nextval('transaction_signatures_id_seq'::regclass),
  
  tx_id bigint NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  signer_id bigint NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  
  signature varchar(500) NOT NULL,  -- hex-encoded signature
  signed_at timestamptz DEFAULT now(),
  
  -- Metadata
  signer_ip_address varchar(45),  -- for geo-check
  signer_device_info text,  -- user agent, etc.
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_signatures_tx_id ON transaction_signatures(tx_id);
CREATE INDEX IF NOT EXISTS idx_transaction_signatures_signer_id ON transaction_signatures(signer_id);

-- ============================================================================
-- POLICIES (Wallet-Level Rules)
-- ============================================================================

CREATE TABLE IF NOT EXISTS policies (
  id bigint PRIMARY KEY DEFAULT nextval('policies_id_seq'::regclass),
  
  wallet_id bigint NOT NULL UNIQUE REFERENCES wallets(id) ON DELETE CASCADE,
  
  -- Spend Limits
  daily_spend_cap_usd numeric(15, 2),
  
  -- Asset Allowlist
  asset_allowlist text[],  -- ['BTC', 'ETH', 'USDC']
  
  -- Timing
  execution_cooldown_hours smallint DEFAULT 24,
  min_time_between_txs_minutes smallint,
  
  -- Geo-Fencing (optional)
  allowed_signer_countries varchar(2)[],  -- ['US', 'CA', 'GB']
  
  -- Signer Rules
  max_signers_per_region smallint,  -- e.g., max 2 from US
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by bigint REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_policies_wallet_id ON policies(wallet_id);

-- ============================================================================
-- AUDIT LOG (Immutable)
-- ============================================================================

CREATE TYPE audit_event_type AS ENUM (
  'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
  'CHAPTER_CREATED', 'CHAPTER_UPDATED',
  'ROLE_ASSIGNED', 'ROLE_REVOKED',
  'SIGNER_ADDED', 'SIGNER_REMOVED',
  'PROPOSAL_CREATED', 'PROPOSAL_UPDATED',
  'VOTE_CAST', 'VOTE_CHANGED',
  'TX_CONSTRUCTED', 'TX_SIGNED', 'TX_BROADCAST', 'TX_CONFIRMED', 'TX_FAILED',
  'POLICY_CHANGED',
  'EMERGENCY_PAUSE_ACTIVATED', 'EMERGENCY_PAUSE_LIFTED',
  'COMPLIANCE_FLAG_SET',
  'AUDIT_LOG_EXPORTED'
);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigint PRIMARY KEY DEFAULT nextval('audit_log_id_seq'::regclass),
  
  event_type audit_event_type NOT NULL,
  
  -- Actor
  actor_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  actor_ip_address varchar(45),
  actor_user_agent text,
  
  -- Subject
  subject_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  subject_chapter_id bigint REFERENCES chapters(id) ON DELETE SET NULL,
  subject_wallet_id bigint REFERENCES wallets(id) ON DELETE SET NULL,
  subject_proposal_id bigint REFERENCES proposals(id) ON DELETE SET NULL,
  subject_tx_id bigint REFERENCES transactions(id) ON DELETE SET NULL,
  
  -- Details (JSON)
  details jsonb,  -- {old_value, new_value, reason, ...}
  
  -- Integrity
  signature varchar(500),  -- HMAC-SHA256(id + timestamp + actor_user_id + event_type, org_signing_key)
  
  -- Immutability marker
  is_exported boolean DEFAULT false,  -- marked after export to S3/Arweave
  
  created_at timestamptz DEFAULT now()
  -- NO updated_at or deleted_at; immutable record
);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_subject_user_id ON audit_log(subject_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_subject_chapter_id ON audit_log(subject_chapter_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_signature ON audit_log(signature);  -- for integrity checks

-- ============================================================================
-- RLS POLICIES (Row-Level Security)
-- ============================================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_in_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_domains ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS: USERS
-- ============================================================================

-- Users can see their own profile + public profiles
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT
  USING (auth.uid()::bigint = id);

CREATE POLICY "Users can view public profiles in their chapter" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid()::bigint
      AND (u.chapter_id = users.chapter_id OR users.chapter_id IS NULL)
    )
  );

-- Users can update own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid()::bigint = id)
  WITH CHECK (auth.uid()::bigint = id);

-- Org Admin can view all users
CREATE POLICY "Org Admin can view all users" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()::bigint AND role = 'ORG_ADMIN' AND chapter_id IS NULL
    )
  );

-- ============================================================================
-- RLS: CHAPTERS
-- ============================================================================

-- All authenticated users can view chapters
CREATE POLICY "Authenticated users can view chapters" ON chapters
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Chapter Leads can update their chapter
CREATE POLICY "Chapter Leads can update their chapter" ON chapters
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()::bigint AND chapter_id = chapters.id AND role = 'CHAPTER_LEAD'
    )
  );

-- Org Admin can update all chapters
CREATE POLICY "Org Admin can update chapters" ON chapters
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()::bigint AND role = 'ORG_ADMIN'
    )
  );

-- ============================================================================
-- RLS: CHANNELS
-- ============================================================================

-- Users can view public channels in their chapter or private channels they joined
CREATE POLICY "Users can view accessible channels" ON channels
  FOR SELECT
  USING (
    is_public = true
    OR EXISTS (
      SELECT 1 FROM users_in_channels
      WHERE user_id = auth.uid()::bigint AND channel_id = channels.id
    )
  );

-- Users can create channels in their chapter
CREATE POLICY "Users can create channels in their chapter" ON channels
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::bigint AND u.chapter_id = channels.chapter_id
    )
  );

-- Chapter Leads can delete channels in their chapter
CREATE POLICY "Chapter Leads can delete channels" ON channels
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()::bigint AND chapter_id = channels.chapter_id AND role = 'CHAPTER_LEAD'
    )
  );

-- ============================================================================
-- RLS: MESSAGES
-- ============================================================================

-- Users can view messages in channels they're in
CREATE POLICY "Users can view messages in accessible channels" ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users_in_channels uc
      WHERE uc.user_id = auth.uid()::bigint AND uc.channel_id = messages.channel_id
    )
  );

-- Users can insert messages in channels they're in
CREATE POLICY "Users can post in accessible channels" ON messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_in_channels uc
      WHERE uc.user_id = auth.uid()::bigint AND uc.channel_id = messages.channel_id
    )
    AND author_id = auth.uid()::bigint
  );

-- Users can update/delete their own messages
CREATE POLICY "Users can update own messages" ON messages
  FOR UPDATE
  USING (author_id = auth.uid()::bigint);

CREATE POLICY "Users can delete own messages" ON messages
  FOR DELETE
  USING (author_id = auth.uid()::bigint);

-- ============================================================================
-- RLS: PROPOSALS
-- ============================================================================

-- Users can view proposals in their chapter (or public proposals)
CREATE POLICY "Users can view proposals in their chapter" ON proposals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::bigint AND u.chapter_id = proposals.chapter_id
    )
  );

-- Analysts / Chapter Leads can create proposals
CREATE POLICY "Analysts can create proposals" ON proposals
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()::bigint
      AND ur.chapter_id = proposals.chapter_id
      AND ur.role IN ('ANALYST', 'CHAPTER_LEAD')
    )
  );

-- Proposer or Chapter Lead can update proposal
CREATE POLICY "Proposer can update proposal" ON proposals
  FOR UPDATE
  USING (proposer_id = auth.uid()::bigint OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()::bigint AND ur.chapter_id = proposals.chapter_id AND ur.role = 'CHAPTER_LEAD'
  ));

-- ============================================================================
-- RLS: VOTES
-- ============================================================================

-- Users can view votes in their chapter (or only vote hashes if privacy desired)
CREATE POLICY "Users can view votes in their chapter" ON votes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proposals p, users u
      WHERE p.id = votes.proposal_id
      AND u.id = auth.uid()::bigint
      AND u.chapter_id = p.chapter_id
    )
  );

-- Users can insert votes for proposals in their chapter
CREATE POLICY "Users can vote in their chapter" ON votes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proposals p, users u, user_roles ur
      WHERE p.id = votes.proposal_id
      AND u.id = auth.uid()::bigint
      AND u.chapter_id = p.chapter_id
      AND ur.user_id = u.id
      AND ur.chapter_id = p.chapter_id
      AND ur.role != 'OBSERVER'
      AND u.is_restricted_jurisdiction = false
    )
    AND voter_id = auth.uid()::bigint
  );

-- Users can update their own votes
CREATE POLICY "Users can update own votes" ON votes
  FOR UPDATE
  USING (voter_id = auth.uid()::bigint);

-- ============================================================================
-- RLS: WALLETS
-- ============================================================================

-- Users can view their own wallets
CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT
  USING (user_id = auth.uid()::bigint);

-- Users can view chapter wallets if in chapter
CREATE POLICY "Users can view chapter wallet if in chapter" ON wallets
  FOR SELECT
  USING (
    type IN ('CHAPTER_SAFE', 'TREASURY_SAFE')
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::bigint AND u.chapter_id = wallets.chapter_id
    )
  );

-- Chapter Leads can update chapter wallet policies
CREATE POLICY "Chapter Lead can update chapter wallet policies" ON wallets
  FOR UPDATE
  USING (
    type = 'CHAPTER_SAFE'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()::bigint
      AND chapter_id = wallets.chapter_id
      AND role = 'CHAPTER_LEAD'
    )
  );

-- ============================================================================
-- RLS: AUDIT LOG
-- ============================================================================

-- Org Admin can view all audit logs
CREATE POLICY "Org Admin can view audit log" ON audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()::bigint AND role = 'ORG_ADMIN'
    )
  );

-- Chapter Lead can view audit logs for their chapter
CREATE POLICY "Chapter Lead can view chapter audit log" ON audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()::bigint AND role = 'CHAPTER_LEAD'
      AND chapter_id = audit_log.subject_chapter_id
    )
  );

-- Users can view anonymized logs (no IP/user agent)
-- This is handled in app layer (don't expose sensitive fields)

-- ============================================================================
-- SEQUENCE CREATION (if not already exists)
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS users_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS chapters_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS chapter_domains_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS user_roles_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS channels_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS users_in_channels_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS messages_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS threads_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS message_reactions_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS presence_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS posts_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS comments_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS post_reactions_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS proposals_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS votes_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS wallets_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS transactions_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS transaction_signatures_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS policies_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS audit_log_id_seq START WITH 1;
```

---

## Key Design Decisions

**Denormalization of User Role**
- `users.chapter_id` is denormalized from `user_roles` for query convenience.
- `user_roles` is the source of truth; `users.chapter_id` synced via trigger.
- Reason: most queries filter by chapter; denormalization avoids constant joins.

**Soft Deletes**
- All sensitive tables use `deleted_at` (not hard deletes).
- Reason: audit trail preservation, disaster recovery, GDPR right-to-be-forgotten can be handled at app layer (logical deletion, not database wipe).

**Audit Log Immutability**
- `audit_log` has no `updated_at` or `deleted_at` column.
- Reason: tamper-proof. If row needs correction, insert new row + reference old row in details.

**Proposal Status Enum**
- Fine-grained states (DRAFT, VOTING, PASSED, FAILED, APPROVED, EXECUTING, EXECUTED).
- Reason: allows UI to show proposal lifecycle clearly; prevents invalid state transitions.

**Transaction Status Enum**
- Granular states (UNSIGNED → SIGNED → BROADCASTING → PENDING → CONFIRMED) map to custody flow.
- Reason: clarity for UI, webhooks, and recovery.

**Vote Merkle Root Storage**
- `vote_merkle_root`, `vote_merkle_signature`, `on_chain_receipt_tx_hash` stored in proposals table.
- Reason: single source of truth for vote authenticity.

**Realtime Publications**
- Only selected tables (messages, votes, transactions, presence) enable Realtime.
- Reason: cost & performance; other tables updated via polling (TanStack Query).

---

## Indexes Strategy

- **Primary**: all primary keys (implicit).
- **Foreign Keys**: `chapter_id`, `user_id`, `proposal_id`, `wallet_id` (for join performance).
- **Filters**: `status`, `deleted_at`, `created_at` (common WHERE clauses).
- **Search**: GIN indexes on `content_search` (full-text) and `target_assets` (array contains).
- **Unique Constraints**: enforce business logic (one vote per voter per proposal, one role per user per chapter).

