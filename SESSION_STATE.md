# SESSION_STATE.md — DormDAO

> Rolling state file. The agent reads this **first** at the start of every session and updates it **last** before ending. Keep it accurate. If this file lies, every future session starts in the wrong place.

## Project one-liner

DormDAO: multi-university (20–25 schools) crypto fund management platform. Cross-platform (iOS + Android + web PWA) on Expo + Supabase. Three-tier custody (Turnkey/Privy MPC for members, Safe multisig for chapters, Safe + Ledger for treasury). Features: Slack-style chat, LinkedIn-style pitch posts, on-platform DAO voting, role-based accounts.

## Current phase

**Pre-Phase 0** — `/docs` tree not yet generated. Build prompt drafted but not run.

## Decisions locked in

| Area | Choice | Notes |
|---|---|---|
| Target build tool | Claude Code / Cursor (agentic) | |
| First deliverable | `/docs` tree (PRD, architecture, schema, custody spec, build plan) | No app code until docs exist and open questions are answered |
| Mobile/web client | Expo (managed, EAS Build) + Expo Router + `react-native-web` | Single codebase → iOS, Android, web PWA |
| Backend | Supabase (Postgres + Auth + Realtime + Storage + Edge Functions) | RLS mandatory on every table |
| Styling | NativeWind | |
| State | TanStack Query (server) + Zustand (UI) | |
| Notifications | Expo Push + Resend (email fallback) | |
| Observability | Sentry + PostHog | |
| Member custody | Turnkey *or* Privy (MPC) | Final pick deferred to `docs/04-custody-spec.md` |
| Chapter custody | Safe multisig on Base | N-of-M threshold per chapter |
| Treasury custody | Safe multisig + Ledger Nano X via WalletConnect v2 | Recommend 4-of-7, geographically distributed |
| KYC | Persona or Sumsub | Treasury Signers only at minimum |
| Tx screening | Chainalysis or TRM Labs | Pre-broadcast, mandatory |
| Audit log | Append-only Postgres table mirrored to immutable storage | |
| Auth | Supabase Auth — magic-link + Google OAuth, gated by `.edu` allowlist | |
| CI/CD | GitHub Actions → EAS Build (mobile) + Vercel (web) | |

## Open questions blocking progress

These must be answered before Phase 4 (custody) at the latest. Some block earlier work — flagged.

- [ ] **(blocks Phase 0)** Confirmed list of chapter schools + their `.edu` domains (needed for auth allowlist).
- [ ] **(blocks Phase 4)** Existing legal entity / fund structure, or TBD?
- [ ] **(blocks Phase 4)** Target chains beyond Base — Arbitrum? Solana? Other?
- [ ] **(blocks Phase 4)** Approximate fund size per chapter (drives custody-tier thresholds and signer count).
- [ ] **(blocks Phase 0)** Jurisdictional posture — which states/countries are blocked from membership?
- [ ] **(blocks Phase 4)** Turnkey vs. Privy for member MPC — pick once, costly to migrate.
- [ ] **(blocks Phase 5)** KYC vendor — Persona vs. Sumsub.
- [ ] **(blocks Phase 4)** Tx screening vendor — Chainalysis vs. TRM.

Once answered, move them into `docs/07-open-questions.md` as resolved with the answer recorded.

## Status checklist

### Pre-Phase 0 — Setup
- [x] Build prompt drafted (`dormdao_build_prompt.md`)
- [x] Repo constitution written (`CLAUDE.md`, `AGENTS.md`)
- [x] Session state initialized (`SESSION_STATE.md`)
- [ ] Empty repo created and these four files committed
- [ ] Build prompt fed to Claude Code → `/docs` tree generated
- [ ] Open questions in `docs/07-open-questions.md` reviewed by Val
- [ ] Blocking open questions answered (see list above)

### Phase 0 — Foundation
- [ ] Expo monorepo scaffolded (`apps/mobile`, `apps/edge`, `packages/{ui,db,custody}`)
- [ ] Supabase project provisioned, env wired
- [ ] Auth: magic-link + Google OAuth, `.edu` allowlist enforced
- [ ] User profiles + chapter assignment
- [ ] Role schema + RLS baseline
- [ ] CI: lint, typecheck, test, EAS Build dry-run, Vercel preview
- [ ] Sentry + PostHog wired on mobile and web
- [ ] Phase 0 demo checklist met

### Phase 1 — Chat MVP
- [ ] Workspaces (chapter + org-wide), channels (public/private), DMs, group DMs
- [ ] Threads, reactions, @mentions, file attachments, presence, typing
- [ ] Postgres FTS message search
- [ ] Realtime subscriptions tested under load

### Phase 2 — Pitches / Blog
- [ ] Rich-text editor integrated (RN-compatible — pick in `docs/01-architecture.md`)
- [ ] Post schema with asset/thesis/horizon/conviction
- [ ] Public, chapter, and following feeds
- [ ] Comments, reactions, shares
- [ ] "Promote pitch → DAO proposal" one-click flow stubbed

### Phase 3 — DAO Voting (off-chain)
- [ ] Proposal schema + lifecycle (draft → open → closed → executed/rejected)
- [ ] Voting methods: simple majority, quorum+majority, token-weighted, conviction
- [ ] Per-proposal discussion thread (reuses chat)
- [ ] Delegation
- [ ] Vote receipts: Merkle root + signed result posted on-chain at close

### Phase 4 — Custody: Chapter Tier + Member MPC
- [ ] Member MPC wallets via chosen provider
- [ ] Chapter Safe deployment automation
- [ ] Unsigned Safe-tx construction service (Edge Function)
- [ ] In-app signer review + sign UI
- [ ] Tx screening hook (Chainalysis/TRM) wired pre-broadcast
- [ ] End-to-end: passed proposal → Safe tx → broadcast → confirmation → receipts

### Phase 5 — Treasury Tier + Compliance
- [ ] Treasury Safe with WalletConnect v2 + Ledger flow
- [ ] Policy engine (caps, allowlists, cooldowns, geo-fencing, emergency pause)
- [ ] Audit log + immutable mirror
- [ ] KYC integration for Treasury Signers
- [ ] Disaster recovery procedures documented and tabletop-tested

### Phase 6 — Hardening + Launch
- [ ] App Store + Play Store listings prepared
- [ ] PWA polish (offline shell, install prompts, push)
- [ ] Load + chaos testing
- [ ] Security review / external pentest
- [ ] Soft launch with 1 pilot chapter

## Next concrete action

1. Create an empty git repo on GitHub.
2. Copy `CLAUDE.md`, `AGENTS.md`, `SESSION_STATE.md`, and `dormdao_build_prompt.md` into the repo root and commit.
3. Open the repo in Claude Code. Send: *"Read `CLAUDE.md` and follow the session protocol."*
4. The agent will detect that `/docs` doesn't exist and run the build prompt to generate it.
5. Review `docs/07-open-questions.md` before any code work begins.

## Change log

Append a new entry at the top of this list every session. Format:

```
## YYYY-MM-DD — short title
**Worked on:** ...
**Files touched:** ...
**Decisions made:** ...
**Open questions surfaced:** ...
**Phase status delta:** ...
```

---

### 2026-05-06 — Project scaffolding (this session)
**Worked on:** Drafted build prompt, repo constitution, and session-state protocol.
**Files touched:** `dormdao_build_prompt.md`, `CLAUDE.md`, `AGENTS.md`, `SESSION_STATE.md`.
**Decisions made:** Stack locked (Expo + Supabase + NativeWind + TanStack Query); custody model locked (3-tier MPC/Safe/Ledger); first deliverable is `/docs` tree, not code.
**Open questions surfaced:** Chapter list, legal entity, target chains, fund size, jurisdictional posture, MPC vendor, KYC vendor, tx-screening vendor.
**Phase status delta:** Pre-Phase 0 setup ~50% done. Next is repo creation and feeding the build prompt to Claude Code.
