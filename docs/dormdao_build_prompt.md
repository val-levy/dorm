# DormDAO Platform — Build Prompt for Claude Code / Cursor

> Paste everything below the divider into a fresh Claude Code or Cursor session. Run from an empty repo.

---

## Role

You are a senior full-stack engineer and product architect with deep experience in (a) cross-platform mobile apps (React Native + Expo, deployed to the iOS App Store and as a PWA), (b) Supabase-backed real-time systems, and (c) crypto custody infrastructure for investment funds (MPC, multisig, hardware-wallet integration).

Your job on this first pass is **NOT to write application code**. It is to produce a complete, decision-ready **Product Requirements Document + Technical Architecture + Phased Build Plan** for the project described below. Treat this like the foundational document the rest of the build will reference. Subsequent prompts in this repo will ask you to implement specific phases from your plan.

## Project: DormDAO

DormDAO is a multi-university crypto fund management organization spanning 20–25 schools. Each school chapter manages capital and makes investment decisions. Today the org is bottlenecked by manual coordination and unsafe key handling.

### Problems to solve

1. **Slow investment decisions.** Current turnaround is ~3 weeks per decision. Target: hours-to-days, with auditable approval flow.
2. **Unsafe key management.** Private keys are currently stored in plaintext documents. Target: production-grade custody with no single human ever holding a full key.
3. **Buy/sell execution lag.** End-to-end execution currently takes ~6 months due to infrastructure friction. Target: minutes-to-hours from approval to on-chain execution.
4. **No unified collaboration surface.** Schools need real-time discussion, public-facing pitch posts, and structured voting in one place — today these are scattered across Discord, Notion, and Google Docs.

### Users

- **Members** (rank-and-file students at a school chapter)
- **Analysts** (research / pitch authors)
- **Chapter Leads** (per-school admins, can co-sign transactions)
- **Treasury Signers** (cross-school multisig signers, elevated permissions)
- **Org Admins** (DormDAO HQ, can manage chapters, audit logs)
- **Read-only Observers** (alumni, advisors, LPs)

Account-type permissions must be enforced both at the UI level and at the database level (Supabase Row-Level Security).

## Tech stack — non-negotiable

- **Client:** React Native via **Expo (managed workflow, EAS Build)** with **Expo Router**. The same codebase must ship to (a) iOS App Store, (b) Android Play Store, and (c) the web as a PWA. Use `react-native-web` through Expo. NativeWind for styling.
- **Backend / DB:** **Supabase** (Postgres + Auth + Realtime + Storage + Edge Functions). All access mediated by Row-Level Security. Use the official `@supabase/supabase-js` client.
- **State / data:** TanStack Query for server state, Zustand for ephemeral UI state. Supabase Realtime for chat + vote subscriptions.
- **Auth:** Supabase Auth with magic-link email + Google OAuth. School affiliation verified via `.edu` email match against a whitelist of chapter domains.
- **Notifications:** Expo Push Notifications + email fallback via Resend.
- **Crypto / custody (see dedicated section):** Privy or Turnkey for embedded MPC wallets at the user level; **Safe (Gnosis Safe) multisig** for chapter and treasury wallets; Ledger hardware-wallet support for Treasury Signers via WalletConnect v2.
- **CI/CD:** GitHub Actions → EAS Build for mobile, Vercel for the web build of the Expo app.
- **Observability:** Sentry, PostHog, Supabase logs.

If you believe a different choice is materially better for one of these slots, flag it as a "STACK ALTERNATIVE" callout in your PRD with the trade-off — but default to the above.

## Feature requirements

### 1. Account system

- Email/OAuth signup gated by chapter-domain allowlist.
- Profile: name, school chapter, role(s), wallet addresses (custodial + linked external), bio, avatar.
- Role assignment workflow (Chapter Lead promotes Members → Analysts; Org Admin promotes → Chapter Lead / Treasury Signer).
- Per-role feature gating spec (matrix in PRD: rows = features, columns = roles, cells = read/write/admin/none).

### 2. Chat — Slack-style

- Workspaces = chapters; cross-chapter "org-wide" workspace also exists.
- Channels (public + private), DMs, group DMs.
- Threads, reactions, @mentions, file attachments (Supabase Storage), unread badges, presence, typing indicators.
- Search across messages with Postgres full-text search; later upgrade path to a vector search for semantic queries.
- Message retention + audit log for compliance.

### 3. Blog / pitches — LinkedIn-style

- Long-form posts (rich-text editor; specify which one, e.g. `@10play/tentap-editor` for RN compatibility).
- Posts have: author, chapter, target asset(s), thesis, time-horizon, conviction score, attachments.
- Public feed, chapter feed, "following" feed.
- Reactions, comments, shares.
- Posts can be **promoted to a DAO proposal** in one click — this links the pitch to a vote and pre-populates context.

### 4. DAO voting

- Proposals have: title, body, linked pitch (optional), proposed action (BUY/SELL/REBALANCE/GOVERNANCE), target wallet, amount, asset, quorum, voting window, voting method.
- Voting methods to support: simple majority, quorum + majority, token-weighted (using the chapter's internal contribution token), and conviction voting.
- Off-chain voting with on-chain receipt: store votes in Postgres for speed, then post a Merkle root + signed result to a public chain (e.g., Base) on close, so results are auditable.
- Auto-execution path: when a BUY/SELL proposal passes, it transitions into the **Execution Workflow** (next section) rather than executing blindly.
- Vote history, delegation, and per-proposal discussion thread (reuses the Chat module).

### 5. Investment execution & key management — production-grade

This is the highest-risk subsystem. Spec it carefully.

- **Custody model:**
  - **Member-level wallets:** embedded MPC wallets via **Privy** or **Turnkey** (PRD must pick one and justify; recommend Turnkey for stronger policy engine and SOC 2). No member ever sees a raw seed phrase.
  - **Chapter wallets:** **Safe multisig** on Base (and/or Arbitrum) with N-of-M Chapter Lead signers. Threshold and signer rotation policy defined per chapter.
  - **Treasury wallet:** **Safe multisig** with Treasury Signers using **Ledger Nano X** hardware wallets connected over **WalletConnect v2**. Recommend a 4-of-7 threshold across geographically distributed signers. No software-only keys at this tier.
- **Approval flow for an execution:**
  1. Proposal passes vote.
  2. System constructs the unsigned transaction (Safe transaction) for the appropriate wallet tier.
  3. Required signers are notified (push + email) with a deep link.
  4. Each signer reviews tx details in-app, then signs from their device (MPC for chapter, hardware wallet for treasury).
  5. When threshold is met, tx broadcasts.
  6. On-chain confirmation triggers status update + receipts to all members.
- **Policy engine:** per-wallet rules — daily spend caps, asset allowlists, cooldowns, geo-fencing on signer location, emergency-pause role.
- **Audit log:** append-only Postgres table mirrored to immutable storage (e.g., S3 Object Lock or Arweave) for every key action: signer added/removed, proposal created, vote cast, tx signed, tx broadcast, policy changed.
- **Compliance hooks:** KYC (Persona or Sumsub) for Treasury Signers; jurisdictional flags on members (some states/countries restrict participation in token-related activities); transaction screening via Chainalysis or TRM Labs API for OFAC/sanctioned addresses before broadcast.
- **Disaster recovery:** documented procedure for lost-device recovery (MPC tier) and signer-quorum recovery (Safe tier). No single point of failure — explicitly identify and mitigate each.
- **What you must NOT do:** generate or store any private key on Supabase, in environment variables, in localStorage, in `expo-secure-store` for Treasury wallets, or anywhere a single compromise yields signing power.

### 6. Notifications, search, settings

Standard. Spec briefly. Per-user notification preferences per channel/proposal/post type.

## Deliverables — exactly what to produce on this first pass

Produce these as separate Markdown files in `/docs`:

1. `docs/00-prd.md` — **Product Requirements Document.** Vision, user personas, jobs-to-be-done, feature list with acceptance criteria, out-of-scope items, success metrics (e.g., median proposal-to-execution time, % of votes meeting quorum, signer response time SLO).
2. `docs/01-architecture.md` — **Technical architecture.** System diagram in Mermaid (client → Supabase → Edge Functions → custody providers → chains). Sequence diagrams (Mermaid) for: (a) member signup + chapter assignment, (b) pitch → proposal → vote → execution end-to-end, (c) treasury multisig signing flow with Ledger. Justify each major tech choice in 2–3 sentences.
3. `docs/02-data-model.md` — **Postgres schema.** Full DDL with comments. Tables for users, chapters, roles, channels, messages, threads, reactions, posts, comments, proposals, votes, wallets, transactions, policies, audit_log. RLS policies for every table. Indexes. Realtime publication settings.
4. `docs/03-permissions-matrix.md` — Role × feature matrix.
5. `docs/04-custody-spec.md` — **Key management & execution spec.** Wallet tiers, signer policies, signing flow walkthroughs with screenshots-as-ASCII or wireframe descriptions, recovery procedures, threat model (STRIDE), residual risks. Pick custody vendor and justify.
6. `docs/05-api-contracts.md` — Edge Function endpoints (auth, proposal lifecycle, transaction construction, webhook handlers from custody providers and chain RPCs). Request/response shapes in TypeScript.
7. `docs/06-build-plan.md` — **Phased build plan.** 6 phases, each ~1–3 weeks, each shippable on its own:
   - Phase 0: Repo, CI, Expo skeleton, Supabase project, auth, profiles.
   - Phase 1: Chat MVP.
   - Phase 2: Pitches/blog.
   - Phase 3: DAO voting (off-chain only).
   - Phase 4: Custody — chapter Safes + member MPC wallets + execution flow.
   - Phase 5: Treasury tier (Ledger + hardware multisig), policy engine, audit log, compliance integrations.
   - Phase 6: Hardening, App Store submission, web PWA polish, observability.
   For each phase: goals, deliverables, dependencies, testing strategy, demo checklist, "definition of done".
8. `docs/07-open-questions.md` — Things you cannot answer without input from Val: regulatory posture, chapter list, fund size per chapter, jurisdiction, existing legal entity, target chains, etc. Phrase each as a discrete question.
9. `README.md` — Top-level summary linking the above, with quickstart for the eventual repo.

## Style & rigor

- Be specific. "Use a chat library" is useless; "Use `stream-chat-react-native` because it has SDK-level support for threads, reactions, and presence and ships RN-native components" is useful. If you recommend a library, name it and link the docs.
- Surface trade-offs. Anywhere you make a non-obvious choice, write a short "Trade-off:" line.
- Flag risks. Custody and compliance failure modes are existential for this product — over-index on identifying them.
- Cite cost. Where a choice has a meaningful $ cost (Turnkey, Persona, Sentry, EAS, App Store fee), note rough monthly cost at 25 chapters × 50 members.
- Don't write app code yet. The deliverable is documentation. Code generation will be triggered by follow-up prompts that reference specific phases of `06-build-plan.md`.

## When you're done

End your output with: (a) a 10-line executive summary, (b) the list of files you produced with one-line descriptions, and (c) the recommended next prompt Val should send you to begin Phase 0 implementation.

---

## How to use this prompt

1. Open Claude Code or Cursor in an empty directory.
2. Paste the section above the second divider as your first message.
3. Let it produce the `/docs` tree.
4. Review `docs/07-open-questions.md` first and answer those before kicking off Phase 0.
5. For each subsequent phase, prompt: *"Implement Phase N from `docs/06-build-plan.md`. Follow the schema in `docs/02-data-model.md` and the API contracts in `docs/05-api-contracts.md`. Stop after Phase N's 'definition of done' is met."*
