# DormDAO Phased Build Plan

## Overview

DormDAO is built in 7 phases, each 1–3 weeks, each independently shippable. Phases are sequential (Phase 0 blocks Phase 1) but can overlap in development (e.g., build Phase 2 UI while Phase 1 backend deploys).

Each phase includes:
- **Goals**: What success looks like.
- **Deliverables**: Code, docs, deployed services.
- **Dependencies**: What must be done first.
- **Testing Strategy**: How to validate.
- **Demo Checklist**: Concrete steps to show feature works.
- **Definition of Done**: Acceptance criteria for the phase.

---

## Phase 0: Repo, CI, Expo Skeleton, Auth

**Duration**: 2 weeks

**Goals**
- Repo initialized, GitHub Actions CI configured.
- Expo app boots to authenticated home screen.
- Supabase project created with initial schema (users, chapters).
- Magic-link email + Google OAuth working.
- Chapter domain whitelist functional (auto-assignment on signup).

### Deliverables

**Code**
- GitHub repo (dorm) with `.github/workflows/` (iOS/Android/web builds).
- Expo project with `app/` directory structure (Expo Router).
- Auth context (`AuthContext.tsx`, Supabase session management).
- Onboarding flow (signup, email verification, profile creation).
- App shell (bottom tab navigator: Chat, Proposals, Posts, Settings).

**Infrastructure**
- Supabase project created, API keys in GitHub Secrets.
- Edge Function `on_auth_signup` deployed.
- Database: `users`, `chapters`, `chapter_domains` tables + RLS policies.
- EAS Build configured (iOS + Android).
- Vercel site created for web PWA.

**Documentation**
- README with setup instructions (clone, `npm install`, `eas build`).
- `.env.example` file with required secrets.
- ONBOARDING.md for new developer setup.

### Dependencies

- GitHub repo access.
- Supabase project provisioned.
- Apple Developer Account + Testflight access (for EAS).
- Google Play Console access (for EAS).
- Vercel account for web deployment.

### Testing Strategy

**Unit Tests**
- Auth context: test session persistence, logout.
- Input validation: email domains, required fields.

**Integration Tests**
- Signup flow end-to-end: email → magic link → profile → home screen.
- OAuth flow: Google sign-in → chapter assignment.

**Manual Testing**
- Signup with `@harvard.edu` email → auto-assigned to Harvard chapter.
- Signup with non-whitelisted `@example.com` → rejected or manual override by Org Admin.
- Multiple chapters: signup with different emails, verify correct chapter assignment.

### Demo Checklist

1. [ ] Clone repo, run `npm install`.
2. [ ] Run `eas build --platform ios --local` → build succeeds.
3. [ ] Expo app starts in iOS simulator.
4. [ ] Tap "Sign Up", enter `test@harvard.edu`.
5. [ ] Check email inbox, click magic link.
6. [ ] Fill profile (name, avatar), tap "Continue".
7. [ ] App redirects to home screen, shows "Harvard Chapter" in profile.
8. [ ] Test Google OAuth: tap "Sign in with Google", select account, authenticate.
9. [ ] Logged-out user cannot access chat screen (redirected to auth).
10. [ ] Tap "Settings", tap "Logout", redirected to auth screen.

### Definition of Done

- [ ] No TypeScript errors on main branch.
- [ ] All tests passing (>80% coverage for auth module).
- [ ] iOS app submittable to Testflight (passes EAS validation).
- [ ] Android app builds successfully (passes Play Console validation).
- [ ] Web app loads at vercel domain.
- [ ] At least 3 test accounts created and verified (different chapters).
- [ ] Deployment documented in README.

**Timeline**: 2 weeks (1 week setup, 1 week hardening).

---

## Phase 1: Chat MVP

**Duration**: 2 weeks

**Goals**
- Real-time chat functional (Slack-style for chapters).
- Channels (public/private), messages, threads, reactions.
- Unread badges, typing indicators, presence.
- Search (Postgres full-text).

### Deliverables

**Code**
- Chat screens: Channel list, message list, thread view, message composer.
- Message components: rich text editor (Markdown MVP), attachments, reactions.
- Realtime subscriptions: messages, presence, typing.
- Search screen: full-text search UI + results.

**Database**
- `channels`, `users_in_channels`, `messages`, `threads`, `message_reactions`, `presence` tables.
- RLS policies: users can view channels they're in.
- Realtime publications for messages, reactions, presence.

**API**
- Edge Function stubs (no complex logic yet):
  - `POST /messages` → insert message.
  - `GET /messages/{channel_id}` → fetch history.
  - `POST /messages/{message_id}/reactions` → add reaction.

### Dependencies

- Phase 0 complete (auth working).
- Supabase Realtime enabled (default for new projects).

### Testing Strategy

**Unit Tests**
- Message validation: length, mentions parsing.
- Thread logic: reply count, nested depth.

**Integration Tests**
- Create channel → user joins → posts message → reaction added → realtime updates shown.
- Search: 100 messages indexed, search returns correct results in <2 sec.

**Manual Testing (2 Test Accounts)**
- Account A creates public channel "announcements" in Harvard chapter.
- Account B joins channel.
- Account A posts message → Account B sees in realtime (no refresh).
- Account B reacts with 👍 → Account A sees reaction immediately.
- Account A types → Account B sees "User is typing…" indicator.
- Open thread → post reply → counted in thread.

### Demo Checklist

1. [ ] Home screen shows chapter: "Harvard" with tabs (Chat, Proposals, Posts, Settings).
2. [ ] Chat tab shows channels: "announcements", "general", "random".
3. [ ] Tap "announcements" → message list loads.
4. [ ] Tap message input, type "Hello" → send.
5. [ ] Message appears in list in <1 sec.
6. [ ] Tap reaction button, select 👍 → emoji appears below message.
7. [ ] Tap message → thread view shows no replies (new message).
8. [ ] Tap "Reply" → type reply, send.
9. [ ] Thread counter on parent message updates to "1 reply".
10. [ ] Search "hello" → message found.
11. [ ] Open another test account → see same channel, see message from Account A, type indicator shows when Account A types.

### Definition of Done

- [ ] No TypeScript errors.
- [ ] All integration tests passing.
- [ ] Realtime latency <1 sec (message arrival, typing indicators).
- [ ] Search latency <2 sec.
- [ ] At least 2 test users in same chapter can chat without refresh.
- [ ] Unread badge works (message count persists after logout/login).

**Timeline**: 2 weeks (1 week frontend, 1 week realtime + testing).

---

## Phase 2: Pitches / Blog

**Duration**: 2 weeks

**Goals**
- Long-form posts (pitches) with rich-text editor (Markdown → Tiptap later).
- Posts can be authored, edited, deleted, reacted, commented.
- Public/chapter/followed feeds.
- One-click "Promote to Proposal" (links post to new proposal).

### Deliverables

**Code**
- Post screens: Feed (public, chapter, following), post detail, editor, comments.
- Rich-text editor: Markdown MVP (later: Tiptap WYSIWYG).
- Post reactions + comments.

**Database**
- `posts`, `comments`, `post_reactions` tables.
- RLS: users can view posts (public or in their chapter).

**API**
- Edge Function stubs:
  - `POST /posts` → create post.
  - `GET /posts` → list posts (with filters: public, chapter, following).
  - `PUT /posts/{post_id}` → edit post.
  - `DELETE /posts/{post_id}` → soft delete.
  - `POST /posts/{post_id}/promote-to-proposal` → create proposal from post.

### Dependencies

- Phase 0 complete (auth).
- Phase 1 optional (chat enhances cross-linking, but not strictly required).

### Testing Strategy

**Unit Tests**
- Post creation: title/body validation, asset array parsing.
- Markdown parsing: headers, bold, lists, code blocks.

**Integration Tests**
- Create post → edit → comment → react → promote to proposal.
- Feed filters: public posts visible to all, chapter posts to chapter members, followed feed works.

**Manual Testing (2 Accounts, Different Chapters)**
- Account A (Harvard) creates post: "Bitcoin thesis for 2025" with asset=['BTC'].
- Post appears in public feed (visible to Account B, MIT).
- Account B comments: "Interesting, but what about regulatory risk?"
- Account A replies to comment.
- Account A taps "Promote to Proposal" → new proposal created, status=VOTING.

### Demo Checklist

1. [ ] "Posts" tab shows public feed (all chapters).
2. [ ] Chapter feed shows only posts from that chapter.
3. [ ] "Following" feed shows posts from users you follow (if following implemented).
4. [ ] Tap "Compose Post" → editor opens.
5. [ ] Type title "Buy 0.5 BTC", description "**Bitcoin** is the most...".
6. [ ] Select conviction 8/10, asset BTC, horizon 1Y.
7. [ ] Tap "Publish" → post appears in feed with formatted markdown.
8. [ ] Tap post → detail view shows all fields.
9. [ ] Tap "Comment" → compose comment, send.
10. [ ] Tap "React" → add emoji reaction.
11. [ ] Tap "Promote to Proposal" → moved to Proposals tab, new proposal created.

### Definition of Done

- [ ] No TypeScript errors.
- [ ] Post CRUD works (create, read, update, delete).
- [ ] Comments + reactions functional.
- [ ] "Promote to Proposal" creates proposal + links correctly.
- [ ] Feed filters work (public, chapter, following).
- [ ] At least 5 sample posts created for demo.

**Timeline**: 2 weeks (1 week frontend, 1 week API + testing).

---

## Phase 3: DAO Voting (Off-Chain)

**Duration**: 2 weeks

**Goals**
- Proposals voteable with off-chain results + Merkle root posted to Base.
- Voting methods: simple majority, quorum + majority (token-weighted + conviction deferred to Phase 3.5).
- Vote delegations (max 2-hop), vote history.
- Proposal results + on-chain receipt.

### Deliverables

**Code**
- Proposal screens: list, detail, voting widget, results + Merkle receipt.
- Voting modal: choice (YES/NO/ABSTAIN), delegation picker.
- Merkle tree library (or use ethers.js `merkleTree` utility).

**Database**
- `proposals`, `votes` tables.
- RLS: users can vote if in chapter + role != OBSERVER.

**Smart Contracts**
- `VoteReceipt.sol`: simple contract that stores proposal → merkle root + signature.
  ```solidity
  mapping(uint256 proposalId => MerkleReceipt receipt) public receipts;
  
  function submitVoteRoot(uint256 proposalId, bytes32 root, bytes sig) external onlyOrg {
    require(verifySignature(root, sig, orgKey), "Invalid signature");
    receipts[proposalId] = MerkleReceipt({
      root: root,
      timestamp: block.timestamp,
      blockNumber: block.number
    });
  }
  
  function verifyVote(uint256 proposalId, address voter, uint8 choice, bytes32[] merkleProof) 
    external view returns (bool) {
    bytes32 leaf = keccak256(voter, choice);
    return MerkleProof.verify(merkleProof, receipts[proposalId].root, leaf);
  }
  ```

**API**
- Edge Function:
  - `POST /proposals/{id}/vote` → record vote in DB.
  - `POST /proposals/{id}/close-voting` → tally + post Merkle root to Base.
  - `GET /proposals/{id}/merkle-receipt` → return Merkle proof for a vote.

### Dependencies

- Phase 0 complete (auth).
- Phase 2 complete (posts → promote to proposal).

### Testing Strategy

**Unit Tests**
- Vote validation: choice enum, delegation cycles (prevent A→B→C→A).
- Merkle tree: construction, proof generation, verification.

**Integration Tests**
- Create proposal → 3 members vote → voting window closes → Merkle root posted to Base → vote verification works.

**Manual Testing (3 Accounts)**
- Account A (Harvard) creates proposal: "Buy 0.5 BTC" (from pitch).
- Voting window: 1 hour.
- Account B votes YES.
- Account C votes NO.
- Account A votes YES (delegated to Account B; should count as B voting for A).
- After 1 hour: voting closes, tally shows 2 YES, 1 NO.
- Merkle root posted to Base; app shows link to on-chain receipt.
- Click "Verify my vote" → Merkle proof checked on Base.

### Demo Checklist

1. [ ] Proposals tab shows open proposals + voting end times.
2. [ ] Tap proposal → voting widget shows "Vote: [YES] [NO] [ABSTAIN]".
3. [ ] Tap YES → ballot animation, vote recorded in <1 sec.
4. [ ] Proposal detail shows live tally: "2 YES, 1 NO, 3 ABSTAIN".
5. [ ] Scroll down → see members' votes (if public voting) or vote count only.
6. [ ] 1-hour timer expires → tally locks, shows "PASSED" or "FAILED".
7. [ ] "View on-chain receipt" link opens Base Etherscan with tx.
8. [ ] Tap "Verify my vote" → modal shows Merkle proof, calls `VoteReceipt.verifyVote(...)`.

### Definition of Done

- [ ] Voting works for simple majority + quorum majority voting methods.
- [ ] Merkle tree generated correctly; Merkle root matches on-chain.
- [ ] Voting window auto-closes at deadline (or manual close).
- [ ] Vote delegation works (no cycles, max 2-hop).
- [ ] Vote history shows all votes + timestamps.
- [ ] On-chain receipt contract deployed to Base testnet.

**Timeline**: 2 weeks (1 week voting logic, 1 week Merkle + on-chain).

---

## Phase 4: Custody Tier 1 & 2 (Turnkey MPC + Chapter Safes)

**Duration**: 3 weeks

**Goals**
- Member MPC wallets functional (Turnkey integration).
- Chapter Safes deployed + populated with signers.
- Proposal execution flow: PASSED → construct tx → notify signers → sign → broadcast.
- Policy engine (spend cap, asset allowlist, cooldown).

### Deliverables

**Code**
- Wallet screens: member wallet (balance, history), chapter wallet (balance, transaction history).
- Execution widget: "Execute Proposal" button, review tx details, estimate gas.
- Signing screen: chapter lead sees pending sigs, taps sign, enters PIN/biometric.

**Edge Functions**
- `on_auth_signup` expanded: create Turnkey wallet.
- `POST /wallets/construct-transaction` → Safe tx construction, policy validation.
- `POST /transactions/{id}/sign` → record signature.
- `POST /transactions/{id}/broadcast` → Safe execTransaction call.

**Database**
- `wallets`, `transactions`, `transaction_signatures`, `policies`, `audit_log` tables.
- RLS: users can view chapter wallet if in chapter, can sign if they're a signer.

**Turnkey Integration**
- Turnkey API client (wrapped Edge Function calls).
- Key shard management (Expo Secure Store, localStorage encryption).

**Safe Contracts**
- Deploy Safe v1.4.1 to Base testnet for each test chapter.
- Register signers (Chapter Leads).

### Dependencies

- Phase 0 complete (auth).
- Phase 3 complete (proposals voteable).
- Turnkey API account + credentials.

### Testing Strategy

**Unit Tests**
- Policy validation: spend cap, asset allowlist, cooldown.
- Safe tx encoding: verify Safe `execTransaction` payload.

**Integration Tests** (3 Test Accounts: Lead1, Lead2, Lead3)
- Create proposal, vote, pass.
- Tap "Execute" → tx constructed, status=UNSIGNED.
- Lead1 signs → signature recorded, status still UNSIGNED (need 2-of-3).
- Lead2 signs → threshold met, status=SIGNED.
- Auto-broadcast → tx confirmed on Base.
- Check wallet balance updated (off-chain, via RPC poll).

**Manual Testing (3 Accounts, 1 Chapter Lead)**
- Chapter Lead (Account A) views Chapter Wallet: "Harvard Safe (Base): 5 ETH".
- Proposal passes: "Buy 0.5 BTC on Uniswap".
- Account A taps "Execute" → sees tx details (Uniswap router, swap params, 150k gas est.).
- Account A taps "Sign" → biometric prompt, signature submitted.
- Pending sigs shows "1 of 2 signatures" + list of signers.
- Another Lead (Account B) gets push notification "Please sign: Buy 0.5 BTC".
- Account B opens app, taps notification, sees same tx, taps "Sign".
- Signatures collected = 2/2; tx broadcasts automatically.
- After 30 sec: wallet history shows "BTC received: 0.5" + tx hash.

### Demo Checklist

1. [ ] Chapter wallet shows balance (e.g., "5 ETH, 10 USDC").
2. [ ] Proposal in PASSED state shows "Execute" button.
3. [ ] Tap "Execute" → tx preview shows amount, recipient, gas estimate.
4. [ ] Policy validation: if over daily cap, shows "Exceeds daily limit" error.
5. [ ] Chapter Lead signs → signature appears in audit log.
6. [ ] Another Chapter Lead signs → auto-broadcast initiated.
7. [ ] Tx appears on Etherscan (Base testnet) with correct parameters.
8. [ ] App shows "✅ Proposal executed: BTC received".
9. [ ] Proposal status changes to EXECUTED.
10. [ ] Audit log shows all signatures + broadcast event.

### Definition of Done

- [ ] Member MPC wallets created on signup; key shard stored securely.
- [ ] Chapter Safes deployed + signers registered.
- [ ] Tx construction, signing, and broadcasting all work end-to-end.
- [ ] Policy engine enforces spend caps + asset allowlist.
- [ ] At least 3 test proposals executed successfully.
- [ ] Audit log complete + exported to S3.

**Timeline**: 3 weeks (1 week Turnkey integration, 1 week Safe tx construction, 1 week signing + hardening).

---

## Phase 5: Treasury Tier (Ledger + KYC + Compliance)

**Duration**: 2 weeks

**Goals**
- Treasury Signer role + KYC (Persona) integration.
- Ledger hardware wallet signing via WalletConnect v2.
- Treasury Safe deployed with 7 signers, 4-of-7 threshold.
- OFAC screening + transaction screening.
- Audit log immutable export (S3 Object Lock + Arweave).

### Deliverables

**Code**
- Treasury wallet screens (similar to chapter, but Ledger-specific signing flow).
- Ledger + WalletConnect integration (connect, sign, disconnect).
- KYC form → Persona webhook handler.
- Transaction screening modal (show risk level, require Org Admin override if high).

**Edge Functions**
- `POST /kyc/initiate-persona` → Persona workflow start.
- `POST /webhooks/persona` → KYC result handler.
- `POST /webhooks/chainalysis` → transaction screening result.
- `POST /batch/export-audit-log` → daily S3 export.

**Database**
- Extend `users`: `kyc_status`, `kyc_provider_id`, `is_restricted_jurisdiction`.
- Policies + audit log schema finalized.

**Smart Contracts**
- Treasury Safe deployed to Base; 7 signers registered.

### Dependencies

- Phase 4 complete (chapter custody working).
- Persona account + API key.
- Chainalysis account + API key.
- AWS S3 bucket with Object Lock enabled.
- WalletConnect v2 project ID.

### Testing Strategy

**Unit Tests**
- KYC webhook parsing + status updates.
- Chainalysis risk level logic.
- Merkle tree for audit log integrity.

**Integration Tests**
- User promoted to Treasury Signer → KYC flow initiated → Persona webhook returns APPROVED → user can sign.
- Treasury tx proposed → 4 signers sign (via Ledger) → broadcast → Chainalysis screens recipient → blocked (high risk) → Org Admin override → proceeds.

**Manual Testing (7 Test Accounts + Ledger Simulator)**
- Org Admin nominates Account A as Treasury Signer.
- KYC form sent to Account A; fills in identity + address.
- Persona webhook returns APPROVED (manual or auto in test env).
- Account A promoted to Treasury Signer; can now sign treasury txs.
- Treasury proposal created: "Move $50k from Harvard to Stanford chapter".
- Account A gets push notification.
- Account A opens app, taps signature, WalletConnect connects to Ledger simulator.
- Ledger simulator displays tx details; Account A confirms on simulator.
- Signature returned; repeat for 3 more signers.
- After 4th signer: tx broadcasts.
- Chainalysis screens recipient (Stanford Safe address); returns LOW risk.
- Tx confirmed on-chain.

### Demo Checklist

1. [ ] Treasury wallet shows balance ("$500k USDC").
2. [ ] Treasury Signer role in settings.
3. [ ] Tap "Connect Ledger" → WalletConnect modal opens → Ledger simulator pairs.
4. [ ] Treasury proposal signature request → Ledger displays amount/recipient/chain.
5. [ ] Confirm on Ledger → signature returned to app.
6. [ ] After 4 sigs, tx broadcasts.
7. [ ] Audit log exported to S3; file immutable (Object Lock).
8. [ ] Org Admin exports audit log → CSV downloads with all treasury actions.

### Definition of Done

- [ ] KYC flow works; users can only be Treasury Signers after APPROVED.
- [ ] Ledger signing integrated; at least 1 test signature on-chain.
- [ ] Transaction screening blocks high-risk addresses (or requires override).
- [ ] Audit log immutable; exported daily + quarterly to Arweave.
- [ ] At least 3 test treasury transactions executed.
- [ ] All 7 test Treasury Signers KYC'd + signed at least 1 tx.

**Timeline**: 2 weeks (1 week Ledger + KYC, 1 week compliance + hardening).

---

## Phase 6: Hardening, App Store, Web PWA, Observability

**Duration**: 2 weeks

**Goals**
- iOS app passes App Store review, deployed to production.
- Android app passes Play Store review, deployed to production.
- Web PWA fully functional (offline support, install prompt).
- Observability in place (Sentry, PostHog, logs).
- Security audit + penetration test (optional but recommended).
- Documentation complete.

### Deliverables

**Code**
- App Store metadata (description, screenshots, privacy policy).
- Play Store listing + screenshots.
- PWA manifest (`manifest.json`), service worker, offline fallback.
- Sentry integration for RN + web.
- PostHog integration for product analytics.
- Privacy policy + terms of service.

**Testing**
- E2E tests (Detox for RN, Cypress for web) covering critical flows.
- Performance profiling (check app startup time, memory usage).
- Accessibility audit (WCAG 2.1 AA).

**Documentation**
- User guide (how to vote, sign transactions, settings).
- Operator guide (Org Admin: manage chapters, KYC, emergency pause).
- Deployment runbook (how to deploy new code, handle incidents).

**Infrastructure**
- App Store submission (via TestFlight).
- Play Store submission (internal testing → open beta → production).
- Web domain + SSL certificate.
- Sentry project + alerting rules.
- PostHog instance + feature flags.

### Dependencies

- All prior phases complete.
- Apple Developer Program membership + Testflight access.
- Google Play Console account.
- Security audit provider (optional).

### Testing Strategy

**E2E Tests** (3–5 critical user journeys)
1. Signup → chat → post message → create proposal → vote → execute → view receipt.
2. Signup as Treasury Signer → sign transaction with Ledger → broadcast.
3. Offline mode: load cached chat, queue messages, resync when online.

**Performance**
- App startup: <3 sec (cold start), <1 sec (warm).
- Chat load: <1 sec for 100 messages.
- Navigation: <200 ms between screens.

**Accessibility**
- All buttons have labels (ARIA).
- Color contrast >4.5:1.
- Focus order logical (keyboard navigation works).

### Demo Checklist

1. [ ] Download DormDAO from App Store (if iOS) or Play Store (if Android).
2. [ ] Install app, launch, sign up.
3. [ ] Chat, post, create proposal, vote (same flows as Phases 1–3).
4. [ ] Open Settings → Notifications → configure preferences.
5. [ ] Receive push notification when @ mentioned.
6. [ ] Web: visit https://dormdao.app, sign in, use app in browser.
7. [ ] Web PWA: "Install App" prompt appears; tap, app installed to home screen.
8. [ ] Offline: close WiFi, try to load chat → cached messages appear.
9. [ ] Sentry: throw error in app → error appears in Sentry dashboard.
10. [ ] PostHog: tracked signup, vote events visible in funnel.

### Definition of Done

- [ ] iOS app on App Store, version 1.0.
- [ ] Android app on Play Store, version 1.0.
- [ ] Web PWA accessible at dormdao.app, PWA installable.
- [ ] Zero high-severity Sentry errors on main branch.
- [ ] PostHog tracking verified (startup, voting, signing events).
- [ ] User guide + operator guide published.
- [ ] Accessibility audit passed (WCAG 2.1 AA).
- [ ] Security audit completed (if required).

**Timeline**: 2 weeks (1 week app store prep + submission, 1 week observability + docs).

---

## Timeline & Staffing

**Total Duration**: ~12 weeks (Phases 0–6).

**Staffing Model** (recommended):
- **1 Full-Stack Engineer** (lead): oversees all phases, leads architecture decisions.
- **1 Frontend Engineer** (phases 0–6): React Native screens, web UI.
- **1 Backend Engineer** (phases 0–6): Edge Functions, database, custody integrations.
- **1 DevOps/QA** (phases 0–6): CI/CD, testing, deployment, observability.
- **1 Designer** (part-time, phases 0–3): UX/UI mockups, brand.

**Parallel Work**
- Phase 1 and 2 can overlap (chat UI while blog API built).
- Phase 2 and 3 can overlap (blog editor while voting logic tested).
- Phase 3 and 4 can overlap (Merkle tree while Safe integration started).

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Turnkey API delays** | Phase 4 blocked | Start integration early; have Privy fallback ready. |
| **Safe tx encoding bugs** | Funds at risk | Extensive testing on testnet; third-party code review. |
| **Ledger WalletConnect issues** | Treasury signing broken | Test with Ledger Nano X simulator early. |
| **App Store rejection** | Deployment blocked | Review privacy policy, data handling early; submit 2 weeks ahead. |
| **RLS policy gaps** | Unauthorized access | Security audit on all RLS policies; test with unprivileged user. |

---

## Success Criteria

**Phase 0**: Expo app boots, auth works, 3 test accounts created.
**Phase 1**: 2 test users chat in same channel, unread badges work, search functions.
**Phase 2**: Posts created, edited, promoted to proposals successfully.
**Phase 3**: Proposals voteable, results on-chain, Merkle proof verified.
**Phase 4**: Full end-to-end execution (proposal → Safe tx → broadcast) for 3 test txs.
**Phase 5**: Treasury Signer role, KYC, Ledger signing for 7 signers.
**Phase 6**: Apps on stores, PWA live, no high-severity errors, observability working.

