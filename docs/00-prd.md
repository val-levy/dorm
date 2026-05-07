# DormDAO Product Requirements Document

## Vision

DormDAO is a production-grade crypto fund management platform for decentralized chapters spanning 20–25 universities. It replaces fragmented manual processes and unsafe key handling with unified collaboration, auditable voting, and institutional-grade custody infrastructure.

**Core mission**: Enable university student investment clubs to make fast, safe, auditable investment decisions through real-time collaboration and MPC-backed key management.

---

## User Personas

| Role | Who | Needs | Permissions |
|------|-----|-------|-------------|
| **Member** | Rank-and-file student investor | Discuss pitches, vote on proposals, track portfolio | Read chat/posts, vote (1 per proposal), view portfolio |
| **Analyst** | Research-focused member | Author pitches, build thesis documents, drive discussion | Write posts, edit own posts, upload files, @ mention |
| **Chapter Lead** | School chapter admin | Manage chapter membership, co-sign capital moves | Manage members, sign transactions (Chapter wallet), set policies |
| **Treasury Signer** | Cross-school elevated signer | Sign treasury-tier transactions, approve large moves | Sign treasury Safe, view all proposals, access audit logs |
| **Org Admin** | DormDAO HQ | Manage chapters, view audit logs, enforce compliance | Add chapters, manage roles, suspend members, view audit logs |
| **Observer** | Alumni, advisors, LPs | Track fund activity, view proposals and results | Read all posts, read-only proposal access, no voting |

---

## Jobs to Be Done

1. **As a Member**: I want to read a well-researched pitch and vote immediately, so I can participate in capital decisions without email lag.
2. **As an Analyst**: I want to author rich-media pitches and see them directly feed into a proposal, so I don't duplicate work across Discord/Notion/Snapshots.
3. **As a Chapter Lead**: I want to co-sign transactions with other leads (never alone), so capital moves are safe and auditable.
4. **As a Treasury Signer**: I want to receive a mobile notification of a pending treasury transaction, review it offline-capable, and sign from my hardware wallet, so custody risk is minimized.
5. **As Org Admin**: I want a tamper-proof audit log of every vote, sign, and approval, so we stay compliant and can reconstruct incidents.

---

## Feature Specification

### 1. Account System

**Signup & Onboarding**
- Email signup via Supabase Auth with magic-link + Google OAuth.
- Auto-assign chapter based on email domain whitelist (e.g., `*@harvard.edu` → Harvard chapter).
- Reject non-whitelisted domains; allow manual override by Org Admin.
- New members default to **Member** role; Chapter Lead must promote to Analyst or higher.

**Profile**
- Fields: name, school chapter, bio, avatar (Supabase Storage), role(s), linked wallet addresses (custodial MPC + optional external like Metamask).
- Wallet addresses indexed for compliance screening (OFAC, jurisdiction checks).
- Acceptance: Members can view and edit own profile; Chapter Leads can edit members in their chapter.

**Role Assignment Workflow**
- Chapter Lead: Can promote Member ↔ Analyst (within chapter).
- Org Admin: Can promote Member ↔ Chapter Lead, add Treasury Signers, remove/suspend any user.
- Transactions logged to audit_log with timestamp and assigner ID.
- Acceptance: Role changes take effect in <1 minute; UI reflects changes without refresh.

**Feature Gating**
- Per-role matrix enforced at UI and database (RLS) levels (see 03-permissions-matrix.md).
- Acceptance: Unauthorized actions (e.g., Member creating a proposal) rejected at API layer with 403 Forbidden.

---

### 2. Chat — Slack-Style Collaboration

**Workspaces & Channels**
- One workspace per chapter; one org-wide workspace for all members.
- Public channels (discoverable, all members can read); private channels (invite-only).
- DMs and group DMs with presence + typing indicators.
- Acceptance: Create channel in <2s; add member to channel in <1s.

**Message Features**
- Rich text (bold, links, code blocks, @mentions, reactions).
- File attachments (Supabase Storage, 50 MB max per file, 10 files per message).
- Unread badge per channel; last-read marker; notification on @mention and DM.
- Threads: reply in-thread to any message; thread count shown on parent.
- Reactions: emoji reactions with sender list (click to expand).
- Presence: "Online", "Away", "Offline" with last-seen timestamp.
- Typing indicators: "User is typing…" visible to other channel members.
- Acceptance: Send message in <500 ms; load message history in <1s; threads collapse/expand in <200 ms.

**Search**
- Full-text search across chapter channels (Postgres `tsvector`).
- Filters: by channel, by sender, by date range.
- Later upgrade path: vector search (pgvector) for semantic "similar discussions".
- Acceptance: Search 50k messages in <2s; show top 20 results ranked by relevance.

**Audit & Retention**
- All messages retained in database; deletion soft-deletes (marks `deleted_at`).
- Audit log captures message author, channel, timestamp, content hash (SHA256).
- Acceptance: Recover deleted message metadata (author, timestamp) for 2 years post-deletion.

---

### 3. Blog / Pitches — LinkedIn-Style Posts

**Post Structure**
- Rich-text body (heading, paragraphs, inline images, links, @mentions).
- Author, chapter, publish date, edit history.
- Metadata: target asset(s) (e.g., "BTC"), time horizon (1M / 3M / 1Y / 5Y+), conviction score (1–10).
- Attachments: files (PDF, XLSX, PNG, CSV) stored in Supabase Storage.
- Acceptance: Post publish in <2s; edit publishes in <1s.

**Visibility & Discovery**
- Public feed: all posts, sorted by recency; chapter-specific feed; "following" feed (posts by users you follow).
- Posts marked as "pinned" (by author or Chapter Lead) appear at top of chapter feed.
- Acceptance: Load 20 posts in <1s; scroll to older posts with infinite scroll.

**Engagement**
- Reactions (👍, ❤️, 🚀, 🧠, custom); comment threads below post.
- Comments are threaded (reply to comment or post root) and support @mentions.
- Share button copies post link to clipboard.
- Acceptance: Add reaction in <200 ms; load comments in <500 ms.

**Promotion to Proposal**
- "Promote to Proposal" button on any post (author or Chapter Lead only).
- Pre-fills proposal title (from post title), body (from post body), linked pitch (reference to post).
- Transitions post to "linked to proposal" state (shows banner "This pitch is now a proposal").
- Acceptance: Create proposal from post in <1s; proposal is immediately votable.

**Analytics** (MVP: deferred to Phase 2.5)
- Track views, reactions, comments per post; visible to author.

---

### 4. DAO Voting

**Proposal Structure**
- Title, body (rich text), linked pitch (optional), proposed action (BUY/SELL/REBALANCE/GOVERNANCE).
- Target wallet (Member / Chapter / Treasury), asset, amount (in native token or USD equivalent).
- Voting window (start, end); quorum threshold %; voting method; result.
- Acceptance: Create proposal in <2s; proposal appears in voting list immediately.

**Voting Methods** (support all four)
- **Simple Majority**: >50% of votes cast wins.
- **Quorum + Majority**: Quorum reached AND >50% of votes cast wins.
- **Token-Weighted**: Each member's voting power = their contribution tokens in chapter. Requires members to have internal token balance (tracked in DB, manually or via on-chain oracle).
- **Conviction Voting**: Voting power increases with lock-in period. E.g., vote for 1M = 1x power, for 3M = 3x power. Requires members to pre-announce lock period.
- Acceptance: Quorum and tally calculated in real-time; proposal auto-closes and locks at end time.

**Voting Process**
- Members in chapter can vote (read permission + role-based); observers cannot.
- Vote is YES, NO, or ABSTAIN.
- Votes are cast off-chain (stored in Postgres).
- Voting is private during window (results hidden); revealed after close.
- Delegation: member can delegate vote to another member (Analyst or Chapter Lead only); chain up to 2 hops (A delegates to B, B to C: A's vote goes to C, but cap at 2 hops to prevent cycles).
- Acceptance: Vote cast in <500 ms; delegation updated in <1s.

**Results & Audit**
- On proposal close (end time):
  - Calculate votes, apply voting method, determine PASS/FAIL.
  - Generate Merkle root of all votes (off-chain) + sign with an org key.
  - Post vote root + signature to Base (or Arbitrum) in a simple on-chain vote receipt contract (stores proposal ID, root hash, sig, timestamp).
  - Store receipt contract address + tx hash in Postgres proposal record.
- Members can verify their vote in receipt (provide their vote data, Merkle proof to contract; contract verifies membership in root).
- Acceptance: Results published in <1 min after close; on-chain receipt posted in <5 min (next batched tx); verification gas <100k.

**Discussion Thread**
- Each proposal has a channel-style discussion thread (reuses Chat components).
- Members can comment, @mention; Chapter Lead can pin important comments.
- Threads appear in proposal detail view; unread count shown in proposal list.
- Acceptance: Load proposal + comments in <1s.

---

### 5. Investment Execution & Key Management

**Wallet Tiers**

| Tier | Holder | Tech | Signers | Threshold | Risk Profile |
|------|--------|------|---------|-----------|--------------|
| **Member** | Individual member | MPC (Turnkey) | 1 (member device) | 1-of-1 | Personal, no custody risk; Turnkey holds key shards |
| **Chapter** | School chapter | Safe multisig | 3–5 Chapter Leads | N-of-M (recommend 2-of-3 or 3-of-5) | Chapter-controlled capital; social consensus |
| **Treasury** | Cross-school fund | Safe multisig | 7 Treasury Signers (Ledger) | 4-of-7 | Institutional-grade; high-security signing |

**Custody Model**

**Member-Level Wallets (MPC)**
- Each member has an embedded MPC wallet (Turnkey; see justification in 04-custody-spec.md).
- On signup, Turnkey API creates a wallet shard on member's device (Expo Secure Store on mobile; localStorage + encryption on web, with eventual biometric unlock).
- Member never sees or handles a raw seed phrase.
- Transactions signed locally; Turnkey holds a key shard but cannot sign alone.
- Used for: personal contributions to chapter wallet (opt-in), receiving personal rewards/distributions.

**Chapter-Level Wallets (Safe)**
- Each chapter has a Safe multisig deployed on Base (primary) and Arbitrum (secondary) at deployment.
- N signers = Chapter Leads (3–5 recommended); N-of-M threshold = Chapter-defined policy (recommend 2-of-3 for fast execution, 3-of-5 for higher security).
- Safe holds chapter's capital: fundraised member contributions, allocation from DormDAO treasury, generated returns.
- Safe is a standard Gnosis Safe v1.4.1 contract; signers are Externally Owned Accounts (EOAs) with private keys NOT stored in app or Supabase.

**Treasury-Level Wallet (Safe)**
- Single Safe multisig on Base with 7 Treasury Signers (e.g., one from each seed chapter + HQ rep).
- Threshold: 4-of-7 (can adjust; 4 avoids need for all signers, 7 provides geographic distribution + redundancy).
- Each Treasury Signer connects via Ledger Nano X (hardware wallet) over WalletConnect v2.
- Used for: inter-chapter capital allocation, emergency moves, large transactions requiring highest security.

**Approval & Execution Flow**

1. **Proposal Passes**
   - Voting concludes; tally shows PASS.
   - On-chain receipt posted to Base.
   - Proposal transitions to "Approved" state.

2. **Transaction Construction**
   - Org Admin or Treasury Signer initiates execution via "Execute Proposal" button.
   - Edge Function `construct_transaction` determines wallet tier:
     - **BUY**: source = Chapter wallet, dest = external exchange or DeFi protocol.
     - **SELL**: source = protocol or exchange, dest = Chapter wallet.
     - **REBALANCE**: Chapter wallet internal swap (via CoW Swap or Uniswap).
   - Function builds Safe transaction (not `eth_sendTransaction`, but Safe-specific `addTransaction` + `execTransaction` flow).
   - Unsigned tx serialized to JSON, stored in `transactions` table with status `UNSIGNED`.

3. **Signer Notification**
   - Required signers notified via:
     - Push notification (Expo) with tx ID and action (BUY/SELL).
     - Email fallback (Resend) with same info + deep link.
   - Notification includes: amount, asset, destination/source address, estimated gas (for on-chain txs).
   - Signers have X hours to sign (deadline, configurable per proposal; default 48 hours).

4. **Signing**
   - **Chapter Signers (software MPC)**: Open app, navigate to "Pending Signatures", view tx details (amount, recipient, gas estimate), tap "Sign", biometric/PIN unlock, sign locally, submit.
   - **Treasury Signers (Ledger)**: Open app, navigate to "Pending Signatures", view tx, tap "Sign via Ledger", WalletConnect modal pops up, user confirms on Ledger hardware, signature returned to app, submitted to Edge Function.
   - Each signature stored in `transaction_signatures` table with signer ID, timestamp, signature.
   - Acceptance: Sign flow <30 sec for chapter signer; <2 min for treasury signer (includes Ledger interaction).

5. **Threshold Met & Broadcast**
   - Once N signatures collected:
     - Edge Function `broadcast_transaction` executes Safe `execTransaction` call.
     - Tx broadcast to mempool (Base or Arbitrum).
   - Acceptance: Broadcast within 1 min of final signature collected.

6. **On-Chain Confirmation & Notifications**
   - Edge Function polls RPC for tx inclusion.
   - Once confirmed (1 block), proposal status → "Executed", transaction status → "CONFIRMED".
   - Notification sent to all chapter members: "BUY proposal [name] executed: [amount] [asset]".
   - Execution receipt (tx hash, block number, timestamp) stored in `transactions` table.
   - Acceptance: Confirmation detected in <30 sec after tx mined; member notified in <1 min.

**Policy Engine**

Per-wallet rules (Chapter and Treasury Safes; configurable by Chapter Lead / Org Admin):
- **Daily Spend Cap**: Max USD notional per day (e.g., $50k per day for chapter).
- **Asset Allowlist**: Only BTC, ETH, USDC, DAI (e.g.).
- **Cooldown**: Min hours between approval and execution (e.g., 24 hours; allows pause/audit time).
- **Signer Geo-fencing** (optional): Signers can only sign from certain countries/regions (via IP geolocation; flagged if signer location changes mid-signing).
- **Emergency Pause**: Org Admin can pause any wallet (blocks all new tx constructions) for 24 hours without explanation; auto-resumes. Used for incident response.

Policies enforced at `construct_transaction` step; rejected txs return 400 with reason (e.g., "Exceeds daily cap").

Acceptance: Policy check in <100 ms; policy changes take effect immediately.

**Audit Log**

Append-only table `audit_log` (Postgres):
```
id, event_type, user_id, wallet_id, proposal_id, tx_id, 
action (SIGNER_ADDED, SIGNER_REMOVED, PROPOSAL_CREATED, VOTE_CAST, TX_SIGNED, TX_BROADCAST, POLICY_CHANGED, EMERGENCY_PAUSE), 
timestamp, details (JSON: old_value, new_value, ip_address, user_agent),
signature (HMAC-SHA256 of event, signed with org key — for integrity)
```

Mirrored to immutable storage:
- Daily batch export to S3 Object Lock (immutable, cannot be deleted; legal hold available).
- Quarterly export to Arweave (permanent, censorship-resistant).

Visibility:
- Org Admin: view all audit logs.
- Chapter Lead: view logs for their chapter.
- Member: view anonymized logs (see vote cast, tx broadcast, but not IP/user agent).

Acceptance: Audit entry written in <100 ms; immutable storage sync within 24 hours.

**Compliance Hooks**

1. **KYC for Treasury Signers**
   - On promotion to Treasury Signer role: system triggers KYC flow via Persona (recommended; alternatives: Sumsub, Onfido).
   - KYC includes: identity verification, address verification, sanctions check (OFAC).
   - KYC result (APPROVED / DECLINED / PENDING) stored in `audit_log`.
   - If DECLINED: Org Admin notified; promotion blocked; user not added as signer.
   - Acceptance: KYC decision in <24 hours; rejection reason logged.

2. **Jurisdiction Flags**
   - On user creation: infer jurisdiction from IP geolocation + email domain.
   - Flag members in restricted jurisdictions (e.g., Iran, North Korea, Crimea, Cuba).
   - Flagged members: can read/chat but cannot vote, cannot be promoted to signer, cannot be added to proposals.
   - Acceptance: Flag set in <1 sec; UI reflects restriction (grayed out buttons, explanatory message).

3. **Transaction Screening**
   - Before `broadcast_transaction`: call Chainalysis or TRM Labs API with recipient address.
   - API returns risk level (LOW / MEDIUM / HIGH) and reason (e.g., "Known sanctions address", "High-risk exchange").
   - If MEDIUM/HIGH: flag in UI, require Org Admin approval to override; log decision.
   - Acceptance: Screening in <2 sec; decision cached per address (24 hours).

**Disaster Recovery**

1. **Lost Member Device (MPC Wallet)**
   - Member lost phone; Turnkey key shard inaccessible.
   - Process: Member logs in via backup email/Google, proves identity (KYC check), Turnkey reissues shard to new device.
   - Chapter Lead approval not required (member's own wallet).
   - Timeline: Reissue in <24 hours.
   - RTO: Member cannot send from personal wallet for 24 hours.

2. **Lost Chapter Signer (Safe)**
   - Chapter Lead lost private key / hardware wallet.
   - Process: Remaining Chapter Leads sign a tx to remove lost signer and add replacement. Requires N-1 of M threshold (e.g., if 3-of-5, need 2 of remaining 4).
   - Org Admin approves replacement signer (must pass KYC if Treasury).
   - Acceptance: New signer added in <1 hour (after tx confirmation).

3. **Lost Treasury Signer (Ledger)**
   - Same as Chapter, but:
   - Replacement must be Treasury Signer candidate (KYC required).
   - Org Admin must also approve.
   - New signer must be geographically distributed (not in same region as >2 existing signers, if possible).
   - Timeline: <48 hours (KYC + tx confirmation).

4. **Safe Contract Compromised (Unlikely)**
   - If Safe contract exploited or funds drained: emergency pause triggered.
   - Org Admin signs a tx to migrate remaining funds to new Safe (manual, high-touch).
   - Members notified immediately.
   - Post-incident: security audit required before operations resume.

---

### 6. Notifications

**Channels**
- Push notifications (Expo): real-time on mobile.
- Email (Resend): fallback + scheduled digests.
- In-app badge: unread count on chat channels, proposals, posts.

**Events Triggering Notifications**
- @mention in chat: push + email.
- Reply to your message: push + email.
- Proposal vote opened: push + email (to all chapter members).
- Proposal vote closing (6 hours remaining): email.
- Proposal passed + execution initiated: push (to signers).
- Pending signature (new tx waiting for you): push + email.
- Tx confirmed on-chain: push (all chapter members).
- New post in followed feed: push (weekly digest default, settable).

**User Preferences**
- Per-channel mute (silence notifications for 1 hour / 8 hours / forever).
- Per-proposal notification (enable/disable).
- Digest frequency: instant / daily / weekly / never.
- Acceptance: Preference updated in <1 sec; takes effect immediately.

---

### 7. Settings & User Management

**User Settings**
- Notification preferences (as above).
- Display: light/dark theme, font size.
- Privacy: public/private profile, follow management.
- Security: linked wallet addresses, session management, connected devices.

**Chapter Settings** (Chapter Lead / Org Admin)
- Name, description, avatar, domain whitelist (for auto-assignment).
- Safe thresholds (e.g., 2-of-3 vs 3-of-5).
- Policy engine rules (spend cap, asset allowlist, cooldown).
- Member list + roles, pending invites.
- Acceptance: Setting changes reflect in <1 sec (UI + RLS re-evaluated for all users in chapter).

**Organization Settings** (Org Admin only)
- Chapter list + status (active/archived).
- KYC provider config (Persona API key, workflow ID).
- Compliance provider config (Chainalysis API key).
- On-chain receipt contract address (for vote Merkle root).
- Emergency pause active/inactive.

---

## Acceptance Criteria Summary

| Feature | Acceptance Criterion |
|---------|---------------------|
| Signup | <30 sec via email magic link; auto chapter assignment; can vote immediately |
| Chat message | Sent in <500 ms; received in <1 sec; reactions in <200 ms |
| Post publish | Visible in feed in <2 sec |
| Proposal create | Visible in voting list in <2 sec; all members notified in <1 min |
| Vote cast | Recorded in <500 ms; tally updated in real-time |
| Proposal pass → execution | Signers notified in <1 min; signature request in-app in <30 sec (chapter) / <2 min (treasury) |
| Tx broadcast | Within 1 min of final signature |
| Tx confirm | Detected in <30 sec; members notified in <1 min |
| Audit log | Entry written in <100 ms; immutable copy synced within 24 hours |

---

## Out of Scope (Phase 1 MVP)

- Advanced analytics dashboard (views, sentiment analysis).
- Convict voting implementation (Phase 3.5).
- Inter-chapter capital transfers (Phase 5).
- Automated on-chain oracle integration for token-weighted voting (manual input only, Phase 3.5).
- Ledger hardware wallet integration (Phase 5).
- Compliance integrations (KYC, transaction screening; Phase 5).
- Arweave immutable backup (S3 only in Phase 5; Arweave in Phase 6).
- iOS/Android App Store submission (Phase 6).
- Advanced search (semantic search via pgvector; Phase 6).

---

## Success Metrics

**Speed**
- Median proposal-to-execution time: <2 weeks (target; <3 weeks in weeks 1–8).
- Median time from vote close to tx broadcast: <10 min.

**Adoption**
- % of chapters with ≥1 Treasury Signer KYC'd: >80% by month 3.
- Active members per chapter: >30 (5 chapters × 30 = 150 active users).

**Safety**
- Zero unintended fund transfers (manual code review gate on execution flow).
- 100% audit log completeness (automated integrity checks).
- Zero OFAC-sanctioned address accepted for payment (compliance screening 100% hit rate).

**Engagement**
- Quorum: >70% of chapter members voting on proposals.
- Comment activity: >1 comment per post avg.

**Reliability**
- Platform uptime: >99.9% (excluding planned maintenance).
- Signature request response time (treasury signer): <120 sec p95.
- No lost transactions (all stored + retrievable).

---

## Success Metrics Ownership & Cadence

- **Speed & Adoption**: Reviewed weekly by Org Admin; flagged if >10% miss.
- **Safety & Compliance**: Reviewed weekly; any compliance failure → immediate incident.
- **Engagement**: Reviewed bi-weekly.
- **Reliability**: Real-time dashboards (Sentry, Supabase logs); alerting on failures.

---

## Launch Plan

**Soft Launch (Weeks 1–4)**
- 5 seed chapters (Harvard, Stanford, MIT, Berkeley, UT Austin).
- All users invited; operations team monitors.
- Focus on Phase 0–3 stability (auth, chat, voting).

**Public Beta (Weeks 5–8)**
- All 20 chapters invited.
- Phase 4–5 (custody, execution) goes live for chapter wallets.
- Org Admin team on-call for incidents.

**General Availability (Week 9+)**
- All features enabled by default.
- Support team manages onboarding.
