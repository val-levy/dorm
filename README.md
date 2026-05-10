# DormDAO

University crypto fund management platform. Cross-platform (iOS + Android + web) built on Expo + Supabase.

**Status**: Phase 0 complete — auth working. Phase 1 (chat) in progress.

---

## Local Dev Setup

### Prerequisites

- Node.js 20+ (use `nvm use 20`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) v2.22.12 (install globally — do not use `npx supabase`)
- Docker Desktop (running)
- Expo Go app on your phone, or an iOS Simulator / Android Emulator

### Steps

```bash
git clone https://github.com/<your-org>/dorm.git
cd dorm
npm install
cp .env.example .env.local   # fill in values from `supabase status`
supabase start               # starts local Postgres, Auth, Mailpit
npm run web                  # or: npm run ios / npm run android
```

Magic-link emails are captured locally at **http://127.0.0.1:54326** (Mailpit).

### Useful commands

| Command | What it does |
|---|---|
| `npm run type-check` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | Jest unit tests |
| `supabase start` | Start local Supabase stack |
| `supabase stop` | Stop local Supabase stack |
| `supabase db reset` | Re-run all migrations from scratch |
| `supabase migration list` | Show applied vs pending migrations |

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Where to get it |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `supabase status` → API URL (local) or Supabase dashboard (prod) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `supabase status` → anon key |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Google Cloud Console → OAuth 2.0 Client ID |

---

## CI / Deployment

- **CI** (lint + typecheck + tests): runs automatically on every push and PR to `main`.
- **EAS Build** (iOS/Android): triggered manually via GitHub Actions → `workflow_dispatch`.
- **Vercel** (web): requires `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` set as GitHub secrets.

---

## Project Structure

```
app/          Expo Router screens (auth, home, settings)
lib/          Supabase client, auth context, shared utilities
supabase/
  migrations/ Postgres schema (DDL + RLS)
docs/         PRD, architecture, data model, custody spec, build plan
.github/
  workflows/  CI, EAS Build, Vercel deploy
```

---

## Docs

| Doc | Purpose |
|---|---|
| [docs/00-prd.md](docs/00-prd.md) | Product requirements |
| [docs/01-architecture.md](docs/01-architecture.md) | System design |
| [docs/02-data-model.md](docs/02-data-model.md) | Postgres schema + RLS |
| [docs/04-custody-spec.md](docs/04-custody-spec.md) | Key management (read before touching custody code) |
| [docs/06-build-plan.md](docs/06-build-plan.md) | Phased build plan |
| [CHANGE_LOG.md](CHANGE_LOG.md) | Rolling session state — start here each session |
