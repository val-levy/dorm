# DormDAO Custody & Key Management Specification

## Executive Summary

DormDAO implements a **three-tier custody model** to ensure no single human ever holds a full signing key. Member wallets use Turnkey MPC (Multi-Party Computation); chapter and treasury wallets use Safe multisig with geographically distributed signers. All signing happens off-device (Turnkey) or on hardware (Ledger), never in the app's memory.

---

## Custody Tier 1: Member-Level Wallets (Turnkey MPC)

### Overview

Each member receives an embedded MPC wallet via Turnkey on signup. The wallet is non-custodial (member retains control) but the private key is sharded across three parties:
1. **Device Shard**: Stored in secure storage on member's device.
2. **Turnkey Shard**: Encrypted, held by Turnkey (never leaves servers).
3. **Backup Shard**: Generated and stored by member (optional, for recovery).

Member can transact (send funds from their personal wallet) but signing always requires Turnkey's participation.

### Technology Choice: Turnkey vs. Privy

| Factor | Turnkey | Privy |
|--------|---------|-------|
| **Policy Engine** | Per-tx rules (spend cap, asset allowlist, geo-fencing) | Limited |
| **MPC Strength** | 3-of-3 shards | 2-of-2 shards |
| **KYC Integration** | Native (Persona webhook) | Via third-party integration |
| **Audit Trail** | Comprehensive activity logs | Moderate |
| **SOC 2** | Type II certified | Type II certified |
| **Hardware Wallet Support** | Not applicable (MPC only) | Limited |
| **Cost** | ~$0.05–0.10 per tx | ~$0.02–0.05 per tx |
| **Governance Compatibility** | Safe integration proven | Possible but less common |

**Recommendation: Turnkey**
- Stronger policy engine (critical for compliance).
- Better audit trail (regulatory requirement).
- Proven with Safe multisig governance.
- Cost justified by risk reduction.

**Trade-off**: Slightly higher cost; requires Turnkey API integration (detailed below).

### Turnkey API Integration

**Onboarding Flow**

1. User signs up via email/OAuth.
2. Supabase Auth creates session.
3. Edge Function `on_auth_signup` calls Turnkey API:
   ```
   POST /v1/wallets
   {
     "username": "user_harvard_123",
     "domain": "dormdao.com",
     "rpc": "https://mainnet.base.org"
   }
   ```
4. Turnkey returns:
   ```json
   {
     "wallet_id": "...",
     "address": "0x...",
     "shard": {
       "key": "...",
       "encrypted_by_client_public_key": false
     }
   }
   ```
5. Edge Function stores `address` in `users.wallet_mpc_address`.
6. Client receives `shard` + encrypts with client's device key.
7. Client stores encrypted shard in `expo-secure-store` (mobile) or encrypted localStorage (web).
8. Member can now transact.

**Transaction Flow**

1. Member initiates transfer in app:
   ```
   amount: 0.5 ETH
   to: 0xRecipient
   data: "" (empty for transfer, has contract call data for swaps)
   ```

2. Client submits to Edge Function `/sign_user_transaction`:
   ```json
   {
     "wallet_id": "user_wallet_123",
     "amount": "500000000000000000",
     "to": "0xRecipient",
     "chain": "base"
   }
   ```

3. Edge Function:
   - Fetches user & policy.
   - Enforces policy (daily spend cap, asset allowlist, cooldown).
   - If policy violated: return 400 with reason.
   - Calls Turnkey API:
     ```
     POST /v1/transactions
     {
       "wallet_id": "user_wallet_123",
       "unsigned_transaction": {
         "chainId": 8453,
         "nonce": 5,
         "gasPrice": "...",
         "gasLimit": "21000",
         "to": "0xRecipient",
         "value": "500000000000000000",
         "data": "0x"
       }
     }
     ```

4. Turnkey API:
   - Combines device shard (sent by client in request header) + Turnkey shard.
   - Signs tx.
   - Returns signed tx.

5. Edge Function broadcasts signed tx to Base RPC.

6. Client polls RPC until tx confirmed.

7. Edge Function logs to audit_log.

**Acceptance**: Turnkey policy evaluation <100 ms; tx construction + signing <2 sec; broadcast <1 sec.

### Policy Engine (Turnkey)

**Configurable Rules**
- **Daily Spend Cap**: Max USD notional per 24 hours (rolling window). E.g., $5k/day for new member.
- **Asset Allowlist**: Only BTC, ETH, USDC, DAI (e.g.). Reject swaps to unknown tokens.
- **Min Balance**: Don't allow wallet to drop below X (prevents dust).
- **Rate Limit**: Max 10 txs per hour (prevents spam).
- **Geo-Fencing**: (Optional) Signing location must be within X km of registered address.

**Policy Violation Handling**
- Turnkey returns 400 with reason: `"POLICY_VIOLATION: daily_spend_cap_exceeded"`.
- Edge Function logs to audit_log with event `TX_POLICY_REJECTED`.
- Client shows toast: "Transaction rejected: Daily limit reached. Try again tomorrow."
- User can contact Chapter Lead to request higher limit (requires Chapter Lead approval + audit log entry).

**Policy Updates**
- Member can request policy change (through in-app form).
- Chapter Lead approves (within their authority).
- Org Admin always has override authority.
- Change logged in audit_log + Turnkey policy updated via API.
- **Acceptance**: Policy change takes effect in <5 min.

### Security: Device Shard Management

**Mobile (iOS/Android)**
- Shard encrypted at rest: `expo-secure-store` uses device keychain (iOS) / Keystore (Android).
- On app uninstall: shard deleted (standard behavior).
- On device theft: attacker gains encrypted shard only (Turnkey shard still required).
- On device loss: member initiates recovery (see Disaster Recovery section).

**Web (PWA)**
- Shard encrypted at rest: AES-256-GCM with master key derived from Supabase session + device ID.
- Master key never stored; derived on each app start.
- On logout: shard cleared from memory (no persistent storage on web).
- On browser cache clear: shard lost (recovery required).
- Recommendation: PWA shard signing is optional (members can choose to disable for security); if enabled, show warning: "Signing from web is less secure; use mobile for high-value txs."

---

## Custody Tier 2: Chapter-Level Wallets (Safe Multisig)

### Overview

Each chapter has a Safe multisig deployed on Base (primary) and Arbitrum (backup) with N Chapter Leads as signers. Safe is a battle-tested smart contract; no custom custody code.

**Typical Setup**: 3 Chapter Leads, 2-of-3 or 3-of-3 threshold (Chapter Lead decides at chapter creation).

### Safe Deployment

**On Chapter Creation**
1. Org Admin creates chapter via UI.
2. Edge Function `create_chapter` called:
   ```json
   {
     "chapter_name": "Harvard Crypto",
     "school": "Harvard University",
     "signer_addresses": [
       "0xChapterLead1",
       "0xChapterLead2",
       "0xChapterLead3"
     ],
     "threshold": 2,
     "chain": "base"
   }
   ```

3. Edge Function calls Safe factory on Base:
   ```
   SafeFactory.createProxyWithNonce({
     _singleton: Safe_v1.4.1,
     initializer: Safe.setup(
       owners: [0xLead1, 0xLead2, 0xLead3],
       _threshold: 2,
       to: 0x0,  // no module
       data: 0x,
       fallbackHandler: CompatibilityFallbackHandler,
       ...
     ),
     saltNonce
   })
   ```

4. Safe contract deployed; address returned.

5. Edge Function stores Safe address in `chapters.safe_address_base`.

6. Optional: Deploy identical Safe to Arbitrum for disaster recovery.

**Cost**: ~$300–500 per Safe deployment (one-time, at chapter creation).

### Transaction Flow (Chapter Wallet)

1. **Proposal Passes**
   - Voting concludes with PASS result.
   - Proposal status → APPROVED.

2. **Execute Button Tapped**
   - User (Analyst or Chapter Lead) taps "Execute" on proposal.
   - Edge Function `/execute_proposal` called:
     ```json
     {
       "proposal_id": 123,
       "wallet_tier": "CHAPTER"
     }
     ```

3. **Construct Transaction**
   - Edge Function loads proposal (action, amount, recipient, asset).
   - Determines Safe wallet (chapter's Safe on Base).
   - Enforces policy (daily spend cap, asset allowlist, cooldown).
   - Constructs Safe transaction data (not a raw transfer, but Safe-encoded tx).

   Example: BUY 1 BTC via Uniswap swap on Base
   ```json
   {
     "to": "0xSwapRouter",
     "value": "0",
     "data": "0x...",  // Uniswap V3 SwapRouter.exactOutputSingle(...) call data
     "operation": 0   // CALL (not DELEGATECALL)
   }
   ```

   - Stores in `transactions` table with status `UNSIGNED`, field `required_signers = [Lead1_id, Lead2_id]` (threshold = 2).

4. **Notify Signers**
   - Sends push notifications + emails to all 3 Chapter Leads.
   - Email includes deep link to "Pending Signatures" in app.
   - Notification shows: "Chapter wallet: Sign BUY 1 BTC → Recipient".

5. **First Signer Opens App**
   - Taps notification or navigates to "Pending Signatures".
   - Views tx details:
     ```
     Action: BUY
     Asset: BTC
     Amount: 1
     From: Harvard Chapter Safe
     To: [recipient address]
     Est. Gas: 150,000 units @ 5 gwei
     ```
   - Taps "Sign" button.
   - Prompted for biometric auth (Face ID, fingerprint) or PIN.
   - Client generates signature using Chapter Lead's private key (stored in secure storage on their device).
   - Signature submitted to Edge Function `/sign_transaction`:
     ```json
     {
       "tx_id": 456,
       "signer_id": 789,
       "signature": "0x..."  // Ethereum signature (v, r, s)
     }
     ```

6. **Edge Function Records Signature**
   - Stores in `transaction_signatures` table.
   - Increments `transactions.signatures_collected`.
   - If count < threshold (2): return success, await more signers.
   - If count == threshold: proceed to broadcast.

7. **Broadcast to Safe**
   - Edge Function calls Safe contract:
     ```
     safe.execTransaction({
       to: 0xSwapRouter,
       value: 0,
       data: 0x...,
       operation: 0,
       safeTxGas: 150000,
       baseGas: 21000,
       gasPrice: 5e9,
       gasToken: 0x0,
       refundReceiver: 0x0,
       signatures: [sig1, sig2]  // Packed together
     })
     ```
   - Safe contract verifies each signature (ECDSA) and checks threshold.
   - If valid: executes the internal tx (0xSwapRouter.exactOutputSingle(...)).
   - Tx broadcast to mempool.

8. **Monitor Confirmation**
   - Edge Function polls RPC until tx confirmed (1 block).
   - Updates `transactions.status → CONFIRMED`, stores `tx_hash` + `block_number`.
   - Sends push notification to all chapter members: "✅ BUY executed: 1 BTC received".

**Acceptance**: Construct to first signer notification <1 min; first sig <2 min (signer response time varies); threshold met to broadcast <1 min; broadcast to confirmation <30 sec.

### Chapter Lead Private Key Management

**Critical**: Chapter Leads' private keys are NOT stored in Supabase, app backend, or localStorage.

**Storage**:
- **Mobile (iOS)**: Private key stored in iOS Keychain (encrypted, OS-managed).
- **Mobile (Android)**: Private key stored in Android Keystore (encrypted, OS-managed).
- **Web**: Private key stored in encrypted localStorage (AES-256-GCM); encryption key derived from Supabase session + device fingerprint. **Not recommended for large signers; use mobile or hardware wallet.**

**Recovery**:
- If Chapter Lead loses device: run recovery flow (see Disaster Recovery section).
- Key regeneration is NOT supported (for security); replacement signer must be added.

**Cost**: Free (uses Safe, no Turnkey).

---

## Custody Tier 3: Treasury-Level Wallet (Safe + Ledger Hardware)

### Overview

The treasury Safe is a 4-of-7 multisig with 7 Treasury Signers, each controlling a Ledger Nano X hardware wallet. Hardware wallets guarantee private keys never leave the physical device.

**Setup**:
- 7 Treasury Signers across geographically distributed locations (target: US East, US West, EU, APAC representatives + 3 additional distributed).
- Each signer must pass KYC (Persona).
- 4-of-7 threshold: quorum is 4 signatures; single region cannot block.

### Ledger Hardware Wallet Integration

**Prerequisites**
- Each Treasury Signer has a Ledger Nano X (not Nano S; requires BLE for mobile).
- Ledger firmware up-to-date (latest as of deployment).
- Ledger Ethereum app installed.

**Setup (One-Time per Signer)**

1. Treasury Signer receives Ledger Nano X via mail (pre-generated, factory reset).
2. Signer boots Ledger, creates PIN (6–8 digits).
3. Signer generates recovery seed (writes on Ledger backup sheet, stored safely).
4. Signer derives Ethereum address (Ledger app: Ethereum → derive path `m/44'/60'/0'/0/0`).
5. Signer provides address to Org Admin (via secure form).
6. Org Admin adds address to Treasury Safe (via 4-of-7 governance vote).

### Transaction Signing with Ledger (Via WalletConnect v2)

**Flow**

1. **Edge Function Constructs Treasury Tx**
   - Proposal (e.g., "Move $100k from chapter funds to treasury") passes voting.
   - Edge Function constructs Safe tx data.
   - Creates `transactions` entry with status `UNSIGNED`, `required_signers = [Signer1_id, Signer2_id, ..., Signer7_id]`, `threshold_signatures = 4`.

2. **Notifications Sent**
   - Push + email to all 7 signers.
   - Email includes: tx summary, deep link to app.

3. **Signer Opens App + Initiates WalletConnect**
   - Taps notification.
   - Navigates to "Pending Signatures" → views treasury tx.
   - Reviews amount, recipient, action (MOVE, ALLOCATE, etc.).
   - Taps "Sign with Ledger" button.

4. **WalletConnect Modal Opens**
   - Desktop/web: shows QR code.
   - Mobile: opens Ledger Live app (via deep link) or WalletConnect modal.
   - Ledger Live connects to user's Ledger Nano X via Bluetooth.

5. **Ledger Displays Transaction**
   - Signer plugs Ledger USB (mobile) or connects BLE.
   - Ledger screen shows:
     ```
     Confirm Transaction
     From:      0x[TreasurySafe]
     To:        0x[ChapterWallet] or protocol
     Amount:    100000 USDC
     Network:   Base
     ```
   - Signer reviews (address, amount, network).
   - Signer presses both buttons on Ledger to confirm.

6. **Ledger Signs Tx**
   - Ledger signs the tx hash with signer's private key (never leaves Ledger).
   - Signature returned to WalletConnect.

7. **App Submits Signature**
   - App receives signature from WalletConnect (via callback).
   - Submits to Edge Function `/sign_transaction`:
     ```json
     {
       "tx_id": 999,
       "signer_id": 555,
       "signature": "0x..."
     }
     ```

8. **Edge Function Records**
   - Stores signature in `transaction_signatures`.
   - Checks if threshold (4) met.
   - If threshold reached: proceeds to broadcast (same as chapter tier).

9. **Broadcast**
   - Safe `execTransaction` with 4+ signatures.
   - Tx confirmed on-chain.
   - Notifications sent to all members.

**Acceptance**: WalletConnect connection <10 sec (over BLE); Ledger display + manual review <60 sec; signature return <30 sec; total per signer ~2 min.

### Treasury Signer KYC (Persona)

**Flow**

1. Org Admin nominates candidate as Treasury Signer (via UI form).
2. System triggers KYC flow: Edge Function calls Persona API:
   ```json
   {
     "email": "signer@example.com",
     "workflow_id": "dormdao_treasury_kyc"
   }
   ```

3. Persona sends link to candidate.
4. Candidate completes:
   - Identity verification (photo ID + selfie).
   - Address verification (document upload).
   - Sanctions check (OFAC, PEP list).

5. Persona webhook returns result (APPROVED / DECLINED / MANUAL_REVIEW).
6. If APPROVED: user promoted to Treasury Signer; Ledger address added to Safe.
7. If DECLINED: notification sent; promotion blocked; user can reapply after 30 days.
8. If MANUAL_REVIEW: Org Admin notified; review completed within 2 business days.

**Cost**: ~$10–15 per KYC check (Persona pricing).
**Timeline**: KYC result typically 2–10 minutes (automated); manual review 2 business days.

---

## Wallet Policies (All Tiers)

### Configurable Rules

Stored in `policies` table:

```json
{
  "wallet_id": 123,
  "daily_spend_cap_usd": 50000,
  "asset_allowlist": ["BTC", "ETH", "USDC", "DAI"],
  "execution_cooldown_hours": 24,
  "min_time_between_txs_minutes": 60,
  "allowed_signer_countries": ["US", "CA", "GB", "DE"],
  "max_signers_per_region": 2
}
```

### Policy Enforcement

Checked in Edge Function before tx construction:

```pseudocode
def construct_transaction(proposal, wallet):
  policy = get_policy(wallet.id)
  
  # Check daily spend cap
  today_spending = sum(txs for tx in wallet.confirmed_txs if tx.created_today)
  if today_spending + proposal.amount_usd > policy.daily_spend_cap_usd:
    return 400 "DAILY_SPEND_CAP_EXCEEDED"
  
  # Check asset allowlist
  if proposal.asset not in policy.asset_allowlist:
    return 400 "ASSET_NOT_ALLOWED"
  
  # Check cooldown
  last_tx = wallet.latest_confirmed_tx
  if now() - last_tx.created_at < policy.execution_cooldown_hours:
    return 400 "COOLDOWN_ACTIVE"
  
  # Check geo-fence (if signer in different region)
  signer_ip_location = geoip_lookup(signer_ip)
  if signer_ip_location not in policy.allowed_signer_countries:
    return 400 "SIGNER_GEO_VIOLATION"
  
  # All checks pass; construct tx
  return construct_safe_tx(...)
```

### Policy Update Flow

1. Chapter Lead (for chapter wallet) or Org Admin (for treasury) submits policy change.
2. Change applied immediately at Edge Function level.
3. Logged in audit_log with `event=POLICY_CHANGED`, details={old, new}.
4. Notification sent to all members: "Chapter policy updated: daily cap now $X."

---

## Audit Log & Compliance

### Audit Log Entries

Every custody action logged:

```sql
INSERT INTO audit_log (
  event_type, actor_user_id, subject_wallet_id, 
  action, details, timestamp, signature
) VALUES (
  'TX_SIGNED', 
  signer_id,
  wallet_id,
  'TX_SIGNED',
  '{
    "tx_id": 456,
    "tx_hash": "0x...",
    "proposal_id": 123,
    "amount": "1000000000000000000",
    "asset": "ETH",
    "recipient": "0x...",
    "signer_ip": "203.0.113.1",
    "signer_country": "US"
  }',
  now(),
  HMAC-SHA256(...)
);
```

### Immutable Storage

**Daily Batch Export (S3 Object Lock)**
- Nightly job exports audit_log entries from past 24 hours.
- File: `audit_logs/2025-02-20.jsonl` (JSON Lines format).
- Uploaded to S3 bucket with Object Lock enabled (immutable for 7 years).
- Hash of file stored in audit_log table for integrity verification.

**Quarterly Archive (Arweave)**
- Every 3 months, export quarterly audit logs to Arweave (permanent, decentralized storage).
- Transaction ID stored in Postgres for reference.

### Compliance Integrations

**OFAC / Transaction Screening (Chainalysis or TRM Labs)**

Before broadcasting any tx, Edge Function calls screening API:

```pseudocode
def before_broadcast(tx):
  # Fetch recipient address
  recipient = tx.to_address
  
  # Call Chainalysis API
  risk_report = chainalysis_api.screen_address(
    address=recipient,
    chain="base"
  )
  
  if risk_report.risk_level == "HIGH":
    # High-risk address (sanctions, known criminal wallet)
    log_event("TX_BLOCKED_OFAC", tx.id)
    alert_org_admin("High-risk recipient for tx {tx.id}")
    
    # Option 1: Block outright
    return 400 "RECIPIENT_BLOCKED_OFAC"
    
    # Option 2: Require Org Admin override (logged)
    # if not request.override_approved_by_org_admin:
    #   return 400 "MANUAL_APPROVAL_REQUIRED"
  
  elif risk_report.risk_level == "MEDIUM":
    # Medium-risk (centralized exchange, mixer, etc.)
    alert_org_admin("Medium-risk recipient; requires review")
    if not request.override_approved_by_org_admin:
      return 400 "REQUIRES_ORG_ADMIN_REVIEW"
  
  # Risk level LOW; proceed
  return broadcast(tx)
```

**Cost**: ~$500/month for 500 screenings @ $1/screen (Chainalysis pricing).

**Jurisdiction Flags**

- On user signup: infer jurisdiction from IP + email domain.
- Flag members in restricted jurisdictions (Iran, North Korea, Crimea, Cuba, Syria).
- Flagged members cannot vote, cannot be added to wallets.
- Org Admin notified; can manually override (logged as exception).

---

## Disaster Recovery Procedures

### Lost Member Device (MPC Wallet)

**Scenario**: Member lost phone; Turnkey shard inaccessible.

**Recovery Steps**

1. Member logs in via email/OAuth on new device.
2. Member navigates to "Recovery" settings.
3. System prompts: "Recover your wallet?" and "Do you have backup phrase?" (from original setup).
4. If yes: member enters backup phrase; system validates with Turnkey API; shard regenerated for new device.
5. If no: member must complete KYC re-verification (Persona) + Chapter Lead must approve recovery.
6. Once approved: Turnkey issues new shard to member's new device.

**Timeline**: With backup phrase ~5 min; without KYC+approval 24 hours.

**RTO (Recovery Time Objective)**: Member cannot transact for up to 24 hours.

### Lost Chapter Lead Signer

**Scenario**: Chapter Lead lost private key, device stolen, or left organization.

**Recovery Steps**

1. Remaining Chapter Leads notice signer missing (or Chapter Lead initiates removal).
2. Chapter Leads construct a Safe tx to remove lost signer + add replacement:
   ```
   safe.removeOwner(address prev, address lost_signer, uint256 _threshold)
   safe.addOwnerWithThreshold(address new_signer, uint256 _threshold)
   ```
3. This tx requires M-1 signatures (if 3-of-3 Safe, requires 2 signatures).
4. Once threshold met: tx broadcast; lost signer removed from Safe.
5. New signer (another Chapter Lead or promoted member) added; must have key ready (in secure storage).

**Timeline**: Signer removal to replacement ~1 hour (wait for confirmations) + time to coordinate replacement.

**RTO**: Chapter cannot execute txs until replacement signer ready; max 24 hours.

### Lost Treasury Signer (Ledger Hardware Wallet)

**Scenario**: Treasury Signer lost Ledger device or unable to participate.

**Recovery Steps**

1. Org Admin initiates signer removal via Governance vote (or Emergency Admin Override if urgent).
2. Construct Safe tx to remove lost signer:
   ```
   safe.removeOwner(prev, lost_signer, 3)  // threshold drops from 4-of-7 to 3-of-6
   ```
3. Tx requires 4 signatures (current threshold).
4. Once removed: new signer (must pass KYC) added:
   ```
   safe.addOwnerWithThreshold(new_signer, 4)
   ```
5. New signer connects Ledger + is ready to sign.

**Timeline**: KYC 2–10 min; removal vote + tx confirmation ~1 hour; replacement ready ~1 day (KYC + onboarding).

**RTO**: Treasury can still execute with remaining signers (3 of 6 threshold); no execution pause.

### Emergency Pause (Org Admin)

**Scenario**: Suspected breach, policy violation, or incident requires immediate halt.

**Action**

1. Org Admin taps "Emergency Pause" button in dashboard.
2. All wallets (chapter + treasury) transitioned to `status = EMERGENCY_PAUSE`.
3. No new txs can be constructed (Edge Function returns 400: "WALLET_PAUSED").
4. Existing unsigned txs cancelled + signers notified.
5. Pause duration: 24 hours (auto-lifts) or manual lift by Org Admin.
6. Logged in audit_log: `event=EMERGENCY_PAUSE_ACTIVATED`, `actor=Org_Admin_ID`, `reason=...`.

**Acceptance**: Pause active within <10 sec.

### Safe Contract Compromised (Unlikely but Documented)

**Scenario**: Critical vulnerability in Safe contract, or exploit discovered post-deployment.

**Mitigation**

1. Emergency pause all safes (Org Admin).
2. Deploy new Safe instance (via Safe factory, using same signers + threshold).
3. Governance vote to migrate remaining funds to new Safe (off-chain vote, then execute tx).
4. Disable old Safe (via governance) to prevent accidental usage.
5. Security audit on new Safe (third-party audit).
6. Resume operations.

**Timeline**: Pause → audit ~1 week; funds locked during migration.

**Residual Risk**: Unlikely (Safe has been audited thousands of times, battles-tested with $billions locked); however, if exploit occurs, funds vulnerable until migration.

---

## Threat Model (STRIDE)

### Threats & Mitigations

| Threat | Category | Risk | Mitigation |
|--------|----------|------|-----------|
| **Member private key leaked** | Spoofing | High | Turnkey MPC (shard split); member can't export full key. Recovery via device loss procedure. |
| **Chapter Lead private key compromised** | Spoofing | High | Hardware wallet for large txs (Ledger); secure storage for chapter wallet; multisig requires 2+ signers; audit log. |
| **Turnkey API breached** | Tampering | Critical | Turnkey is third-party (assumes SOC 2 audit); multi-shard design; if breached, attacker gains only 1 of 3 shards. |
| **Safe contract exploited** | Tampering | Critical | Safe is battle-tested; unlikely. If occurs: emergency pause, audit, migrate to new Safe. |
| **Signer collusion (2+ members sign malicious tx)** | Spoofing | High | Quorum-based safety; for 2-of-3 chapter, 2 signers can act (social consensus enforces accountability); audit log + community review. |
| **Compliance failure (OFAC-blocked tx approved)** | Non-repudiation | High | Chainalysis screening on every tx; Org Admin review for medium-risk; audit log. |
| **Phishing member into signing** | Social Engineering | High | Security training during onboarding; tx details always shown on Ledger (hardware reality); clear confirmation required. |
| **RLS policy bypass** | Elevation of Privilege | Critical | RLS enforced at Postgres level (not app code); every INSERT/UPDATE/DELETE checked. Tested in PR reviews. |
| **Loss of audit trail** | Non-repudiation | Medium | Audit log immutable (no update/delete); daily export to S3 Object Lock + Arweave. Integrity verified via HMAC. |
| **Member in restricted jurisdiction votes** | Non-repudiation | Medium | Jurisdiction flag on user profile; RLS prevents vote insertion. Manual override requires audit log entry. |

### Residual Risks

1. **Signer Device Theft**: Private key on device is encrypted, but sophisticated attacker + device may bypass encryption. Mitigation: hardware wallets for treasury (Ledger is tamper-evident + physically secure).

2. **Social Engineering**: Signer tricked into approving malicious tx. Mitigation: tx details shown on hardware (Ledger), clear confirmation, security training.

3. **Governance Failure**: Community fails to detect malicious proposal + approves it. Mitigation: discussion channels, 3-day voting window (time for debate), quorum requirement, treasury signer final review.

---

## Cost Analysis

| Component | Cost (Monthly @ 25 Chapters × 50 Members) | Notes |
|-----------|-------------------------------------------|-------|
| Turnkey MPC (member txs) | $250 | ~2 txs/member/month @ $0.05/tx |
| Persona KYC (treasury signers) | $500 | 175 signers × $10/KYC initial + re-verifications |
| Chainalysis Screening | $500 | ~500 screenings @ $1/screen |
| Ledger Hardware Wallets | $0 (one-time: $2,100) | 7 signers × $300 initial cost; amortized |
| Safe Deployments | $0 (one-time: $15k) | 25 chapters × 2 safes × $300; amortized |
| Supabase Storage (audit exports) | $50 | S3 storage for daily exports, Arweave quarterly |
| **Total Recurring** | ~$1,300/month | Scales with tx volume |

---

## Testing & Validation

### Pre-Launch Security Checklist

- [ ] Turnkey API integration tested with test wallets (devnet).
- [ ] Safe tx construction verified against live Base testnet.
- [ ] WalletConnect v2 flow tested with Ledger simulator (Speculos).
- [ ] RLS policies tested: verify non-members cannot access wallets.
- [ ] Audit log immutability verified: no deletes allowed.
- [ ] KYC webhook tested: Persona results correctly processed.
- [ ] Policy engine tested: spend caps enforced, violations logged.
- [ ] Emergency pause tested: wallets lock, txs rejected.
- [ ] Recovery procedures tested with test accounts.

### Ongoing Monitoring

- Sentry: alerts on Edge Function errors (custody operations).
- PostHog: track # of txs, success rate, signer response time.
- Custom: audit log integrity check daily (verify HMAC signatures).

