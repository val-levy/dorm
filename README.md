# DormDAO

DormDAO is a production-grade crypto fund management platform for university chapters. It enables real-time collaboration, auditable voting, and institutional-grade custody infrastructure.

**Status**: Pre-launch. Phase 0 (repo + auth) begins after PRD approval.

---

## Quick Links

- **Product Requirements**: [docs/00-prd.md](docs/00-prd.md) — Vision, users, features, acceptance criteria, success metrics.
- **Technical Architecture**: [docs/01-architecture.md](docs/01-architecture.md) — System design, Mermaid diagrams, tech justifications.
- **Data Model**: [docs/02-data-model.md](docs/02-data-model.md) — Full Postgres DDL + RLS policies.
- **Permissions Matrix**: [docs/03-permissions-matrix.md](docs/03-permissions-matrix.md) — Role × feature access control.
- **Custody Specification**: [docs/04-custody-spec.md](docs/04-custody-spec.md) — Key management, wallet tiers, signing flows, threat model.
- **API Contracts**: [docs/05-api-contracts.md](docs/05-api-contracts.md) — Edge Function endpoints, request/response schemas.
- **Build Plan**: [docs/06-build-plan.md](docs/06-build-plan.md) — 6 phases, 12 weeks, deliverables + success criteria per phase.
- **Open Questions**: [docs/07-open-questions.md](docs/07-open-questions.md) — Regulatory, governance, capital, and ops decisions needed from stakeholders.

---

## Architecture Highlights

### Three-Tier Custody Model

| Tier | Holder | Tech | Signing | Use Case |
|------|--------|------|---------|----------|
| **Member** | Individual | Turnkey MPC | Device (Expo Secure Store) | Personal contributions |
| **Chapter** | School chapter | Safe multisig (Base) | Chapter Leads (2-of-3) | Chapter capital deployment |
| **Treasury** | Cross-school | Safe multisig (Base) | Ledger Nano X (4-of-7) | Inter-chapter allocation |

### Key Technologies

**Client**: React Native + Expo (iOS, Android, web PWA). Expo Router, NativeWind, TanStack Query, Zustand.

**Backend**: Supabase (Postgres + Auth + Realtime + Storage + Edge Functions). All data access mediated by RLS.

**Custody**: Turnkey (member MPC), Safe (chapter & treasury multisig), Ledger (hardware signing).

**Blockchain**: Base (primary), Arbitrum (backup). Vote receipts posted on-chain via Merkle root.

**Compliance**: Persona (KYC), Chainalysis (transaction screening), S3 Object Lock + Arweave (immutable audit).

---

## Phased Rollout

| Phase | Duration | Goals |
|-------|----------|-------|
| **0** | 2 weeks | Repo, CI, Expo skeleton, auth, profiles |
| **1** | 2 weeks | Chat MVP (channels, messages, threads, reactions) |
| **2** | 2 weeks | Pitches/blog (posts, comments, reactions, promote to proposal) |
| **3** | 2 weeks | DAO voting (off-chain + Merkle root on-chain) |
| **4** | 3 weeks | Custody Tiers 1–2 (Turnkey MPC, chapter Safes, execution) |
| **5** | 2 weeks | Treasury tier (Ledger, KYC, compliance, immutable audit) |
| **6** | 2 weeks | App Store submission, web PWA, observability, hardening |

**Total**: ~12 weeks. Each phase is independently shippable and deployable.

---

## Key Features

### 1. Unified Collaboration Surface

- **Chat**: Slack-style channels per chapter, DMs, threads, reactions, file attachments.
- **Blog**: Long-form pitches with rich text, reactions, comments. One-click "Promote to Proposal".
- **Realtime**: Supabase Realtime subscriptions for instant message delivery, vote tallies, typing indicators.
- **Search**: Postgres full-text search across messages + posts.

### 2. Fast, Auditable Voting

- **Voting Methods**: Simple majority, quorum + majority, token-weighted (Phase 3.5), conviction voting (Phase 3.5).
- **Off-Chain Speed**: Results recorded in Postgres immediately; no gas cost.
- **On-Chain Audit**: Merkle root of votes posted to Base contract on close. Members can verify votes via Merkle proof.
- **Discussion**: Per-proposal chat channels for async deliberation during voting window.

### 3. Production-Grade Custody

- **Member Wallets**: Embedded MPC (Turnkey). No seed phrase ever shown. Device + Turnkey + backup shard = 3-of-3 key parts.
- **Chapter Wallets**: Safe multisig on Base. 2-of-3 (or 3-of-5) Chapter Lead signers. Execution triggered from passed proposals.
- **Treasury Wallet**: Safe multisig on Base. 4-of-7 Treasury Signers, each with Ledger Nano X. Geographically distributed.
- **Policy Engine**: Per-wallet rules (daily spend cap, asset allowlist, cooldown, geo-fencing).
- **Immutable Audit**: Every action (signer added, vote cast, tx signed, tx broadcast) logged append-only. Daily export to S3 Object Lock, quarterly to Arweave.

### 4. Compliance-First

- **KYC**: Treasury Signers pass Persona verification before promotion.
- **OFAC Screening**: Chainalysis screens transaction recipients; blocks sanctioned addresses.
- **Jurisdiction Flags**: Members in restricted countries cannot vote or sign.
- **Audit Trail**: Tamper-proof log with HMAC signatures; recoverable for 2+ years.

---

## Core Principles

1. **No single human ever holds a full signing key** — All custody is sharded (MPC) or multisig.
2. **Fail-safe over fail-secure** — If signing fails, capital is locked (safe); if policy fails, manual override available.
3. **Transparency + Auditability** — All votes + approvals on-chain or in immutable log.
4. **Speed** — Proposal to execution in <1 day (vs. 6 months manual today).
5. **Decentralization** — Governance is on-chain (Merkle roots); capital custody is multi-signer.

---

## Development Quickstart

### Prerequisites

- Node.js 20+
- Git
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- iOS Simulator (macOS) or Android Emulator
- Supabase CLI: `npm install -g supabase`

### Local Setup (Phase 0 Complete)

```bash
# Clone the repo
git clone https://github.com/dormdao/dorm.git
cd dorm

# Install dependencies
npm install

# Set up Supabase (local)
supabase init
supabase start

# Copy .env
cp .env.example .env.local
# Edit .env.local with Supabase keys from `supabase status`

# Start dev server
npm run dev
# or iOS: npm run ios
# or Android: npm run android
# or web: npm run web
```

### Running Tests

```bash
npm run test          # Jest unit + integration tests
npm run test:e2e      # Detox (RN) + Cypress (web) end-to-end
npm run lint          # TypeScript + ESLint
```

### Building for App Stores (Phase 6+)

```bash
# EAS Build (managed)
eas build --platform ios --auto-submit
eas build --platform android --auto-submit

# Web (Vercel)
npm run export
vercel deploy
```

---

## Project Structure

```
dorm/
├── app/                  # Expo Router screens (auth, chat, proposals, posts, settings)
├── components/           # Reusable React Native components
├── lib/                  # Utilities (API client, hooks, stores, types)
├── supabase/
│   ├── migrations/       # Database schema (DDL)
│   └── functions/        # Edge Functions (custody, webhooks, batch jobs)
├── docs/                 # PRD, architecture, data model, custody spec, API, build plan, questions
├── .github/workflows/    # GitHub Actions (CI, EAS Build, Vercel deploy)
├── .env.example          # Environment variables template
├── package.json          # Dependencies
└── README.md             # This file
```

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Client** | React Native + Expo | Single codebase → iOS + Android + web; managed build service (EAS) |
| **Backend** | Supabase | Postgres + Auth + Realtime + Edge Functions; RLS for security |
| **State** | TanStack Query + Zustand | Server state (Query) + UI state (Zustand); reduces boilerplate |
| **Styling** | NativeWind (Tailwind) | DRY utilities; easy theming; dark mode support |
| **Editor** | Markdown (MVP) / Tiptap (later) | Markdown is RN-friendly; Tiptap for advanced editing |
| **Crypto** | Turnkey, Safe, Ledger | Non-custodial, audited, battle-tested |
| **Blockchain** | Base + Arbitrum | Low fees, fast, EVM-compatible, good tooling |
| **Observability** | Sentry + PostHog | Error tracking + product analytics |

---

## Key Decisions & Trade-offs

### Why Turnkey over Privy?

**Turnkey**: Stronger policy engine (per-tx rules, geo-fencing), better KYC integration, SOC 2 Type II certified.
**Privy**: Lighter weight, lower cost (~2x cheaper).
**Trade-off**: Turned towards security (this is custody); cost justified.

### Why Base over Ethereum?

**Base**: 100x cheaper gas, same security, Coinbase credibility.
**Ethereum**: Highest liquidity, most liquid trading pairs, slower, expensive.
**Trade-off**: Base sufficient for DAO operations; bridge to Ethereum later if needed.

### Why Off-Chain Voting with On-Chain Receipts?

**Off-chain speed**: Votes recorded in Postgres in milliseconds; no gas cost.
**On-chain audit**: Merkle root + signature posted to Base; anyone can verify.
**Trade-off**: Slightly more complex verification; simple to understand and audit.

---

## Security & Compliance

### Private Key Security

✅ **Member keys**: Never in app memory or backend. Sharded via Turnkey. Encrypted in secure storage.
✅ **Chapter keys**: Hardware storage (Ledger optional for leading chapters) or encrypted local storage.
✅ **Treasury keys**: Ledger Nano X hardware only. Private keys never leave device.
✅ **Org admin keys**: Stored in Supabase Secrets (encrypted at rest, audit-logged on access).

### Database Security

✅ **RLS**: Enforce deny-by-default on all tables. Every query filtered by role + chapter.
✅ **Soft deletes**: No hard deletes for audit trail preservation.
✅ **Audit log**: Immutable, signed with HMAC, exported daily to S3 Object Lock.

### Compliance

✅ **KYC**: Persona integration for Treasury Signers.
✅ **OFAC/Sanctions**: Chainalysis screening before tx broadcast.
✅ **Jurisdiction flags**: Members in restricted countries auto-blocked from voting.
✅ **Disaster recovery**: Documented procedures for lost signers, emergency pause, Safe migration.

---

## Open Questions

Before Phase 0 implementation, confirm:

1. **Regulatory**: Legal entity structure, jurisdictional restrictions.
2. **Governance**: Voting methods, signing thresholds, execution authority.
3. **Capital**: Target chains (Base/Arbitrum?), supported assets, fund size per chapter.
4. **Chapters**: List of 20–25 chapters + email domains, Chapter Leads, Treasury Signers.
5. **Compliance**: KYC provider, transaction screening provider.

See [docs/07-open-questions.md](docs/07-open-questions.md) for full details.

---

## Roadmap (Post-Phase 6)

- **Phase 7**: Conviction voting, token-weighted voting (requires contribution token).
- **Phase 8**: On-chain governance (vote on policy changes, signer rotations).
- **Phase 9**: Cross-chain bridges (allocate capital across Ethereum, Optimism, Polygon).
- **Phase 10**: Yield farming integration (deposit idle capital into Aave, Curve).

---

## Support & Contact

- **GitHub Issues**: Report bugs or request features.
- **Discord**: Community discussion (link TBD).
- **Email**: operations@dormdao.org (Org Admin contact).

---

## License

Proprietary. Copyright DormDAO 2025.

---

## Acknowledgments

Built with Expo, Supabase, Safe, Turnkey, and Ledger. Inspired by Snapshot, Gnosis Safe UI, and Slack.

---

**Next Step**: Val reviews PRD + architecture + build plan. Confirms open questions (07-open-questions.md). Then: `git init` + Phase 0 begins.

