# SESSION_STATE.md — DormDAO

> Rolling state file. The agent reads this **first** at the start of every session and updates it **last** before ending. Keep it accurate. If this file lies, every future session starts in the wrong place.

## Project one-liner

DormDAO: multi-university (20–25 schools) crypto fund management platform. Cross-platform (iOS + Android + web PWA) on Expo + Supabase. Three-tier custody (Turnkey/Privy MPC for members, Safe multisig for chapters, Safe + Ledger for treasury). Features: Slack-style chat, LinkedIn-style pitch posts, on-platform DAO voting, role-based accounts.

## Current phase

**Phase 0 — Foundation** — Repo scaffolded, local Supabase running, auth flow working. `npm run type-check` passes. `/docs` tree not yet generated (deferred; app code exists; reconcile schema with docs before Phase 1).

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

Most questions answered in `docs/07-open-questions.md`. Remaining blockers:

- [ ] **(blocks Phase 4)** Turnkey vs. Privy for member MPC — pick once, costly to migrate.
- [ ] **(blocks Phase 0)** Chapter domain mappings not finalized — chapter list known, `.edu` domains not mapped yet.
- [ ] **(blocks Phase 5)** Chapter Lead assignments (needed to register Safe signers).
- [ ] **(blocks Phase 5)** Treasury Signer list (7 names + emails + chapters).

**Resolved** (see `docs/07-open-questions.md`): legal entity, jurisdictions, fund size (~$50–150k/chapter), target chain (Ethereum), assets (any/all), DEX (Uniswap), voting (>50% majority), execution authority (Admin only), KYC (Persona), screening (Chainalysis), RTO (24h), support (Zack/Jack), on-call (Jack), soft launch (Oregon Blockchain first).

## Status checklist

### Pre-Phase 0 — Setup
- [x] Build prompt drafted (`dormdao_build_prompt.md`)
- [x] Repo constitution written (`CLAUDE.md`, `AGENTS.md`)
- [x] Session state initialized (`SESSION_STATE.md`)
- [x] Repo created and pushed to GitHub
- [x] Open questions reviewed and answered by Val (see `docs/07-open-questions.md`)
- [ ] `/docs` tree generated (deferred; app code exists; reconcile before Phase 1)

### Phase 0 — Foundation
- [x] Expo app scaffolded + Expo Router file-based routing
- [x] Local Supabase provisioned, env wired (`.env.local` → `http://127.0.0.1:54321`)
- [x] Auth: magic-link working (local Mailpit), `.edu` allowlist in progress
- [x] User profiles + chapter assignment (via email domain, RLS policies)
- [x] `npm run type-check` passing (Deno Edge Functions removed; SQL trigger replaces them)
- [x] Expired magic-link recovery screen implemented
- [x] Google OAuth wired
- [ ] `.edu` allowlist enforced at signup (deferred — single chapter only; `uoregon.edu` hardcoded for now)
- [ ] Role schema (`user_roles` table) + RLS policies for roles
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

**Local dev environment:**
- Expo web: `npm run web -- --port 19006 --localhost` (Node 20 via nvm)
- Local Supabase: `supabase start` using global CLI `2.22.12` (NOT `npx supabase start` — newer npx tried to upgrade Postgres 15 → 17 and failed)
- Magic-link emails: Mailpit at `http://127.0.0.1:54326/`

**Next tasks (Phase 0 remaining):**
1. Seed `chapter_domains` table with the 16 chapter + `.edu` domain mappings from `docs/07-open-questions.md` Q10 (e.g., `uoregon.edu`, `cornell.edu`, etc.) in a new migration.
2. Wire Google OAuth (add provider in Supabase local config + Auth context).
3. Create a `user_roles` table migration with RLS policies; update `on_auth_signup` Edge Function to assign default `MEMBER` role via role table (currently inserts into `user_roles` but table may not exist).
4. Set up CI: GitHub Actions workflow for lint + typecheck + test.
5. Decide whether to generate `/docs` tree from `dormdao_build_prompt.md` before Phase 1, or reconcile existing code against the planned schema.

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

### 2026-05-09 — Google OAuth done; chapter domain scope narrowed
**Worked on:** State update only.
**Files touched:** `SESSION_STATE.md`.
**Decisions made:** Google OAuth is live. Multi-chapter domain seeding deferred indefinitely — single-chapter launch with `uoregon.edu` only; no migration needed for now.
**Open questions surfaced:** None.
**Phase status delta:** Google OAuth checked off. `.edu` allowlist item re-scoped to deferred.

---

### 2026-05-09 — Remove Deno Edge Functions
**Worked on:** Deleted `supabase/functions/on_auth_signup/` (Deno Edge Function) in favour of the pure-SQL trigger already written in `supabase/migrations/0005_auth_signup_trigger.sql`. Removed the `supabase/functions` exclusion from `tsconfig.json` (no Deno files remain).
**Files touched:** `supabase/functions/on_auth_signup/index.ts` (deleted), `tsconfig.json`, `SESSION_STATE.md`.
**Decisions made:** Auth-signup provisioning (user row + MEMBER role) runs entirely in the database via a `SECURITY DEFINER` trigger on `auth.users`. No Deno runtime dependency anywhere in the project.
**Open questions surfaced:** None.
**Phase status delta:** `supabase/functions/` directory removed. `tsconfig.json` exclusion cleaned up.

---

### 2026-05-08 — Type-check fix + state reconciliation
**Worked on:** Fixed `npm run type-check` failures caused by root tsconfig picking up Deno Edge Function files; reconciled SESSION_STATE.md to accurately reflect Phase 0 progress (not Pre-Phase 0).
**Files touched:** `tsconfig.json`, `SESSION_STATE.md`.
**Decisions made:** Excluded `supabase/functions` from root tsconfig — Edge Functions are Deno code and should not be checked by the Node/Expo TypeScript compiler. `npm run type-check` now passes cleanly.
**Open questions surfaced:** None.
**Phase status delta:** `npm run type-check` green. Phase 0 status updated; checklist shows 6 done, 6 remaining.

---

### 2026-05-07 — Expired magic-link recovery
**Worked on:** Made the Complete Profile screen handle Supabase magic-link redirect errors, including `otp_expired`, instead of showing the normal profile form without a session.
**Files touched:** `app/(auth)/complete-profile.tsx`, `SESSION_STATE.md`.
**Decisions made:** Parse auth error details from the web URL hash/query on the profile screen and provide an inline resend-magic-link flow using the existing `signUp` helper.
**Open questions surfaced:** None.
**Phase status delta:** `npm run type-check` still fails only on the existing Deno Edge Function import/global type errors in `supabase/functions/on_auth_signup/index.ts`.

### 2026-05-07 — Complete profile save fix
**Worked on:** Fixed the Complete Profile button failing to save/navigate after magic-link login.
**Files touched:** `app/(auth)/complete-profile.tsx`, `supabase/migrations/0003_profile_completion_rls.sql`, `SESSION_STATE.md`.
**Decisions made:** Saved profile rows by authenticated email instead of Auth UUID because the current `public.users.id` schema is bigint; added RLS policies allowing authenticated users to insert/update their own profile row by verified email; applied the migration to the running local DB with `docker exec`.
**Open questions surfaced:** The public users table still does not model Supabase Auth UUIDs cleanly; this should be reconciled during Phase 0 schema alignment.
**Phase status delta:** Expo web rebuilds cleanly. `npm run type-check` no longer reports the profile query error; remaining failures are only Deno Edge Function type declarations/imports.

### 2026-05-07 — Local magic-link delivery fix
**Worked on:** Fixed local magic-link delivery confusion after the app sent auth email to hosted Supabase instead of local Supabase/Mailpit.
**Files touched:** `.env.local`, `lib/auth-context.tsx`, `supabase/config.toml`, `SESSION_STATE.md`.
**Decisions made:** Pointed Expo at local Supabase (`http://127.0.0.1:54321`) with the local anon key; set local Auth site URL to `http://localhost:19006`; added a web redirect to `http://localhost:19006/complete-profile`; disabled local Storage because the linked project's storage image tag/migration (`optimize-existing-functions-again`) prevents local startup; restarted Expo and Supabase with the expected global Supabase CLI `2.22.12`.
**Open questions surfaced:** None.
**Phase status delta:** Local Supabase Auth and Mailpit are running. A magic-link email for `vallevy@uoregon.edu` was confirmed in Mailpit at `http://127.0.0.1:54326/`; a direct test OTP request also delivered to `test@berkeley.edu`. `npm run type-check` still fails on the existing profile query and Deno Edge Function typing gaps.

### 2026-05-07 — Expo Router tab layout fix
**Worked on:** Fixed the browser error `Couldn't find a 'component', 'getComponent' or 'children' prop for the screen '(home)'`.
**Files touched:** `app/(app)/_layout.tsx`, `SESSION_STATE.md`.
**Decisions made:** Replaced direct `createBottomTabNavigator()` usage with Expo Router's `Tabs` component so file-based routes supply the screen components.
**Open questions surfaced:** None.
**Phase status delta:** Expo web rebuilds cleanly after the change. `npm run type-check` no longer reports tab layout errors; remaining failures are the profile query shape and Deno Edge Function types.

### 2026-05-07 — Expo web localhost fix
**Worked on:** Diagnosed Chrome `ERR_CONNECTION_REFUSED` for the local Expo web app and got Expo web serving on `http://localhost:19006/`.
**Files touched:** `app.json`, `lib/supabase.ts`, `package.json`, `package-lock.json`, `SESSION_STATE.md`.
**Decisions made:** Pinned Expo SDK 50 dependencies to versions accepted by `npx expo install --check`; removed missing `assets/*` references from `app.json`; made the Supabase storage adapter safe during Expo Router web server rendering where `window` is unavailable.
**Open questions surfaced:** None.
**Phase status delta:** Expo web dev server now starts and returns `HTTP/1.1 200 OK` at `http://localhost:19006/`. `npm run type-check` still fails on unrelated Phase 0 type gaps listed in Next concrete action.

### 2026-05-07 — Supabase migration startup fix
**Worked on:** Fixed local Supabase startup failure caused by `0001_initial_schema.sql` referencing ID sequences before creating them.
**Files touched:** `supabase/migrations/0001_initial_schema.sql`, `SESSION_STATE.md`.
**Decisions made:** Created the bigint ID sequences before table creation and bound them to their table columns with `ALTER SEQUENCE ... OWNED BY`.
**Open questions surfaced:** Repo state appears ahead of `SESSION_STATE.md` because Supabase migrations exist while the state file still says `/docs` has not been generated; next session should reconcile that.
**Phase status delta:** `supabase start` now succeeds. `supabase status` reports the local development setup running; `supabase_imgproxy_dorm` and `supabase_pooler_dorm` are stopped.

### 2026-05-07 — Docker Desktop snapshot corruption diagnosis
**Worked on:** Diagnosed `supabase start` failure during local Postgres image extraction.
**Files touched:** `SESSION_STATE.md`.
**Decisions made:** Treated the failure as Docker Desktop/containerd local store corruption, not a Supabase project config issue. `docker buildx prune -f` reclaimed 12.7 GB but did not fix the missing overlay snapshot.
**Open questions surfaced:** None.
**Phase status delta:** Local Supabase remains blocked until Docker Desktop storage is repaired or reset.

### 2026-05-06 — Supabase local config compatibility
**Worked on:** Fixed local Supabase CLI config keys that prevented `supabase start` from parsing `supabase/config.toml`.
**Files touched:** `supabase/config.toml`, `SESSION_STATE.md`.
**Decisions made:** Kept the existing local port assignments; changed only schema-incompatible key names for Supabase CLI `2.22.12`.
**Open questions surfaced:** None.
**Phase status delta:** Local Supabase startup now proceeds past config parsing; Docker Desktop/daemon availability is the next blocker.

### 2026-05-06 — Project scaffolding (this session)
**Worked on:** Drafted build prompt, repo constitution, and session-state protocol.
**Files touched:** `dormdao_build_prompt.md`, `CLAUDE.md`, `AGENTS.md`, `SESSION_STATE.md`.
**Decisions made:** Stack locked (Expo + Supabase + NativeWind + TanStack Query); custody model locked (3-tier MPC/Safe/Ledger); first deliverable is `/docs` tree, not code.
**Open questions surfaced:** Chapter list, legal entity, target chains, fund size, jurisdictional posture, MPC vendor, KYC vendor, tx-screening vendor.
**Phase status delta:** Pre-Phase 0 setup ~50% done. Next is repo creation and feeding the build prompt to Claude Code.
