# CLAUDE.md — DormDAO build repo

> This file is loaded automatically at the start of every Claude Code / Cursor session. It is the source of truth for how to operate in this repo. Read it fully before doing anything else.

## Project

DormDAO is a multi-university (20–25 schools) crypto fund management platform. The codebase ships to iOS App Store, Android Play Store, and web (PWA) from a single Expo + `react-native-web` codebase, backed by Supabase, with three-tier crypto custody (Turnkey/Privy MPC for members, Safe multisig for chapters, Safe + Ledger hardware wallets for the treasury).

**The product solves three problems:** 3-week investment turnaround → hours; private keys in plaintext docs → production-grade custody with no single-key holders; 6-month buy/sell execution → minutes-to-hours from approval to on-chain.

## Authoritative documents

Read these in this order at the start of every session. **Do not start work until you have read all four.**

1. `CHANGE_LOG.md` — rolling log of what's done, what's pending, the literal next concrete action. **This is your starting point.**
2. `docs/00-prd.md` — product requirements.
3. `docs/06-build-plan.md` — phased build plan. You only ever work on the current phase unless told otherwise.
4. The doc(s) relevant to the current phase:
   - Phase 0–2 work → also read `docs/02-data-model.md`, `docs/05-api-contracts.md`.
   - Phase 3 (DAO voting) → also `docs/03-permissions-matrix.md`.
   - Phase 4–5 (custody, execution, treasury) → also `docs/04-custody-spec.md`. **Do not write or modify any custody code without re-reading this file in the same session.**

If `docs/` does not exist yet, the first task is to generate it by following `dormdao_build_prompt.md` (in repo root). Do that, then stop and wait for human review of `docs/07-open-questions.md` before any code is written.

## Operating rules

### Architecture

- **Stack is locked.** Expo (managed, EAS Build) + Expo Router + `react-native-web`. Supabase (Postgres + Auth + Realtime + Storage + Edge Functions). NativeWind. TanStack Query + Zustand. Sentry + PostHog. Do not introduce alternatives without a written `STACK ALTERNATIVE` note in the relevant `docs/` file and explicit human approval.
- **Schema changes go through `docs/02-data-model.md` first.** Update the doc, then write the migration. Never the other way around.
- **All Supabase tables must have RLS policies.** No exceptions. If you cannot model the access rule in RLS, raise it as an open question rather than skipping RLS.
- **Edge Functions are the only place server-side secrets live.** Never embed service-role keys in the client.

### Custody — non-negotiable

- **Never** generate, store, log, or transmit a private key from any tier. Not in env vars, not in Supabase, not in `expo-secure-store`, not in localStorage, not in test fixtures, not in commit history.
- **Member tier:** all signing goes through the chosen MPC provider (Turnkey or Privy — check `docs/04-custody-spec.md` for the locked choice).
- **Chapter tier:** all transactions are Safe multisig transactions; the app constructs unsigned tx payloads only.
- **Treasury tier:** signing only via WalletConnect v2 to a hardware wallet. Software-only signing paths are forbidden at this tier and must not exist as a fallback.
- **Audit log is append-only.** Never write code that deletes or updates rows in `audit_log`. If you need to correct a record, append a compensating entry.
- **Pre-broadcast screening is mandatory.** Any code path that broadcasts a tx must call the Chainalysis/TRM screening hook first.

### Phase discipline

- You only work on the current phase as marked in `CHANGE_LOG.md`. Do not "while I'm here" your way into the next phase.
- A phase isn't done until its "definition of done" in `docs/06-build-plan.md` is met. If you can't meet it, mark the gap explicitly in `CHANGE_LOG.md` rather than silently moving on.

### Code style

- TypeScript strict mode everywhere. No `any` without an inline justification comment.
- Tests for every Edge Function and every RLS policy. RLS tests use a separate Supabase test project, not mocks.
- Conventional commits. One concern per commit.

### What to ask the human about (don't decide alone)

- Anything in `docs/07-open-questions.md` that's still unanswered.
- New third-party services with cost > $50/mo.
- Anything that touches custody policy thresholds, signer rotation, or the audit log schema.
- Schema changes that aren't backwards-compatible.

## Session protocol

### At the start of every session

1. Read `CHANGE_LOG.md` end-to-end.
2. Read `docs/06-build-plan.md` and identify the current phase.
3. Read the phase-relevant docs listed above.
4. State back to the human, in 3–5 bullets: where we are, what's next, any blockers from `docs/07-open-questions.md`.
5. Wait for confirmation before writing code.

### During work

- Update the in-progress task list as you go.
- If you hit a decision the human should make, stop and ask. Do not guess on architecture, custody, or compliance.

### At the end of every session — REQUIRED

Before the session ends, you **must** update `CHANGE_LOG.md`:

1. Move completed items to `[x]` in the Status checklist.
2. Add new items to the checklist if scope expanded.
3. Update the **Next concrete action** section with the literal next thing the next session should do (specific file paths, specific commands).
4. Append a Change log entry with date, summary of work, files touched, and any decisions made.
5. If new open questions surfaced, add them to `docs/07-open-questions.md`.
6. Show the human the diff of `CHANGE_LOG.md` and confirm it's accurate before ending.

If a session ends without this update, the next session starts blind. **This step is more important than finishing the last 5% of the code task.** If you're running out of time or context, stop coding earlier and update the state file.

### Resume command (for the human)

The human can drop you into the right context with:

> "Read `CLAUDE.md` and follow the session protocol."

That is sufficient. Don't require more.

## Repo layout (target)

```
/
├── CLAUDE.md                  # this file
├── AGENTS.md                  # one-liner pointing here, for cross-tool compatibility
├── CHANGE_LOG.md           # rolling state — read first, update last
├── dormdao_build_prompt.md    # the original build prompt, kept for reference
├── docs/
│   ├── 00-prd.md
│   ├── 01-architecture.md
│   ├── 02-data-model.md
│   ├── 03-permissions-matrix.md
│   ├── 04-custody-spec.md
│   ├── 05-api-contracts.md
│   ├── 06-build-plan.md
│   └── 07-open-questions.md
├── apps/
│   ├── mobile/                # Expo app (iOS + Android + web via react-native-web)
│   └── edge/                  # Supabase Edge Functions
├── packages/
│   ├── ui/                    # shared NativeWind components
│   ├── db/                    # Supabase types, migrations, RLS policy tests
│   └── custody/               # MPC + Safe + WalletConnect adapters
└── .github/workflows/         # CI: lint, typecheck, test, EAS Build, Vercel deploy
```

Don't deviate from this structure without updating this file in the same PR.

## Session summaries

Phase and session summaries live in `docs/phases/` and follow the template at `docs/phases/_template.md`.

- Filename format: `YYYY-MM-DD_<short-kebab-slug>.md`
- Use the `/summarize` slash command to generate one at the end of a substantive task.
- Do not write summaries for trivial sessions (single-question lookups, syntax checks, etc.).
- Never fabricate ticket IDs, PRs, or outcomes. If a section has nothing real to say, write `_None._`.

## Failure modes to avoid

- Writing app code before `docs/` exists. (Generate docs first.)
- Skipping RLS because "it's a prototype." (RLS is the prototype.)
- Storing a key "just for testing." (No. Never. Use the MPC sandbox.)
- Marking a phase done without meeting its DoD.
- Ending a session without updating `CHANGE_LOG.md`.
- Silently swapping libraries or providers.
- Inventing schema in code without updating `docs/02-data-model.md` first.

---

*This file is the contract. If you're about to break a rule here, stop and ask the human.*
