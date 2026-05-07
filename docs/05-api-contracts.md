# DormDAO API Contracts

## Overview

Edge Functions provide the API layer for custody operations, auth lifecycle, webhooks, and batch jobs. All endpoints are authenticated (Supabase session token required) and enforce RLS at database level.

---

## Endpoint Structure

**Base URL**: `https://<supabase-project>.supabase.co/functions/v1/`

**Authentication**: Supabase Bearer token in `Authorization: Bearer <session_token>` header.

**Response Format**: JSON.

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

---

## Auth & User Lifecycle

### POST /auth/signup-webhook (Internal: Triggered by Supabase)

Called automatically when new user signs up.

**Trigger**: Supabase Auth insert → function invoked via trigger.

**Request** (auto-populated by Supabase):
```json
{
  "event": {
    "user": {
      "id": "uuid",
      "email": "student@harvard.edu",
      "email_confirmed_at": "2025-02-20T10:00:00Z",
      "user_metadata": {}
    }
  }
}
```

**Function Logic**:
1. Extract email domain (`harvard.edu`).
2. Query `chapter_domains` table; find matching chapter.
3. Call Turnkey API to create wallet.
4. Insert into `users` table:
   ```
   email, chapter_id, wallet_mpc_address, role='MEMBER'
   ```
5. Insert into `audit_log`:
   ```
   event='USER_CREATED', actor_user_id=null, subject_user_id=<new_user_id>, ...
   ```

**Response**:
```json
{
  "success": true,
  "user_id": 123,
  "chapter_id": 1,
  "wallet_address": "0x..."
}
```

**Errors**:
- `400 DOMAIN_NOT_WHITELISTED`: Email domain not in whitelist; user created but no chapter assigned.
- `500 TURNKEY_API_ERROR`: Turnkey wallet creation failed; user created but no wallet.

---

## Proposals & Voting

### POST /proposals/create

Creates a new proposal.

**Request**:
```json
{
  "chapter_id": 1,
  "title": "Buy 0.5 BTC",
  "body": "<p>Rich text body...</p>",
  "action": "BUY",
  "target_asset": "BTC",
  "target_amount": "0.5",
  "target_usd_equivalent": 21000,
  "recipient_address": "0x... or exchange deposit address",
  "linked_post_id": 42,
  "voting_method": "QUORUM_MAJORITY",
  "quorum_percentage": 50,
  "voting_duration_hours": 168
}
```

**Function Logic**:
1. Verify user is Analyst or Chapter Lead in chapter (RLS handles).
2. Validate input (title length, amount > 0, valid Ethereum address if recipient).
3. If linked_post_id: fetch post, verify ownership/chapter.
4. Insert into `proposals` table with status='VOTING' (skip DRAFT for simplicity).
5. Create discussion channel for proposal (optional; can reuse chapter general channel).
6. Notify all chapter members: "New proposal: [title]" (via realtime).

**Response**:
```json
{
  "success": true,
  "proposal_id": 123,
  "status": "VOTING",
  "voting_end_at": "2025-02-27T10:00:00Z"
}
```

**Errors**:
- `403 FORBIDDEN`: User not Analyst/Chapter Lead.
- `400 INVALID_ADDRESS`: Recipient address not valid Ethereum.

---

### POST /proposals/{proposal_id}/vote

Cast a vote on a proposal.

**Request**:
```json
{
  "choice": "YES",
  "lock_in_days": 0,
  "delegated_to": null
}
```

**Function Logic**:
1. Fetch proposal; verify status='VOTING' and not expired.
2. Fetch user; verify in chapter and role != OBSERVER.
3. Verify not in restricted jurisdiction.
4. Verify no existing vote (unique constraint).
5. Calculate voting power:
   - Simple: 1.0
   - Token-weighted: user's token balance (from DB).
   - Conviction: 1.0 * (lock_in_days / 365).0 (capped at 10x for 3+ years).
6. Insert into `votes` table with vote_hash (keccak256 of proposalId||voterAddress||choice).
7. Update `proposals.yes_votes` (or no/abstain).
8. Update `proposals` field via real-time trigger; subscribers see live tally.

**Response**:
```json
{
  "success": true,
  "vote_id": 456,
  "choice": "YES",
  "voting_power": 1.5,
  "updated_tally": {
    "yes": 12,
    "no": 3,
    "abstain": 2
  }
}
```

**Errors**:
- `400 VOTING_CLOSED`: Proposal voting window expired.
- `400 ALREADY_VOTED`: User has voted; call PUT to change.
- `403 RESTRICTED_JURISDICTION`: User cannot vote from restricted location.

---

### POST /proposals/{proposal_id}/close-voting

Closes voting window, calculates results, posts Merkle root on-chain.

**Caller**: Org Admin or system cron job (runs daily at midnight UTC).

**Function Logic**:
1. Verify proposal status='VOTING' and voting_end_at <= now().
2. Fetch all votes for proposal.
3. Calculate tally:
   - Sum voting power by choice (YES, NO, ABSTAIN).
   - Check quorum: total votes / total eligible voters >= quorum %.
   - Check majority: (YES votes / (YES + NO)) > 50%.
   - Result: PASSED (quorum + majority) or FAILED.
4. If PASSED:
   - Generate Merkle tree of all votes.
   - Root hash = merkle_root.
   - Sign root with org key: signature = HMAC-SHA256(root || timestamp, org_secret_key).
   - Call Safe vote receipt contract on Base:
     ```
     vote_receipt_contract.submitVoteRoot({
       proposalId: 123,
       merkleRoot: "0x...",
       signature: "0x...",
       timestamp: now()
     })
     ```
   - Store tx_hash, receipt contract address in proposals table.
5. Update `proposals.status = PASSED or FAILED`.
6. Notify all members: "Proposal [title] [PASSED/FAILED]".
7. If PASSED: proposal eligible for execution; members can trigger `execute_proposal`.

**Response**:
```json
{
  "success": true,
  "proposal_id": 123,
  "status": "PASSED",
  "tally": {
    "yes": 18,
    "no": 4,
    "abstain": 3,
    "total_voters": 25,
    "yes_percentage": 81.82
  },
  "merkle_root": "0x...",
  "on_chain_receipt_tx_hash": "0x..."
}
```

**Errors**:
- `400 VOTING_NOT_CLOSED`: Voting window not ended.
- `500 ON_CHAIN_SUBMISSION_FAILED`: Failed to post Merkle root to Base.

---

## Custody & Transactions

### POST /wallets/{wallet_id}/construct-transaction

Constructs an unsigned transaction from an approved proposal.

**Request**:
```json
{
  "proposal_id": 123,
  "signer_addresses": ["0xChapterLead1", "0xChapterLead2"]
}
```

**Function Logic**:
1. Fetch proposal; verify status='APPROVED' (or PASSED, depends on flow).
2. Fetch wallet; verify signer_addresses are valid signers for this wallet.
3. Enforce wallet policies (see 04-custody-spec.md):
   - Daily spend cap.
   - Asset allowlist.
   - Cooldown.
   - Geo-fence (optional, at signer IP level).
4. Construct Safe transaction:
   - For BUY: encode DEX swap (e.g., Uniswap V3).
   - For SELL: encode DEX swap or market order.
   - For REBALANCE: encode internal swap.
   - For GOVERNANCE: custom encoded call.
5. Insert into `transactions` table:
   ```
   proposal_id, wallet_id, status='UNSIGNED',
   required_signers=[user_id1, user_id2],
   threshold_signatures=2,
   to_address, amount, data, chain, estimated_gas
   ```
6. Notify required signers (push + email + in-app badge).

**Response**:
```json
{
  "success": true,
  "tx_id": 456,
  "status": "UNSIGNED",
  "required_signers": 2,
  "signatures_needed": 2,
  "transaction_data": {
    "to": "0x...",
    "value": "0",
    "data": "0x...",
    "operation": 0,
    "safeTxGas": 150000,
    "baseGas": 21000,
    "gasPrice": "5000000000",
    "chainId": 8453
  },
  "estimated_cost": {
    "gas_units": 171000,
    "price_per_unit": "5000000000",
    "total_wei": "855000000000000"
  }
}
```

**Errors**:
- `400 POLICY_VIOLATION`: Violates spend cap, asset allowlist, or cooldown.
- `400 GEO_VIOLATION`: Signer IP in restricted region.
- `400 INSUFFICIENT_BALANCE`: Wallet doesn't have enough funds.

---

### POST /transactions/{tx_id}/sign

Signs a transaction with user's private key (chapter) or Ledger (treasury).

**Request (Chapter)**:
```json
{
  "signer_id": 789,
  "signature": "0x..."  // Signature from local key
}
```

**Request (Treasury)**:
```json
{
  "signer_id": 789,
  "signature": "0x..."  // Signature from Ledger (via WalletConnect)
}
```

**Function Logic**:
1. Fetch transaction; verify status='UNSIGNED'.
2. Verify signer_id is in required_signers list.
3. Verify signature is valid ECDSA signature (recover signer address, check against expected signer).
4. Insert into `transaction_signatures` table.
5. Increment `transactions.signatures_collected`.
6. Check if threshold met:
   - If threshold NOT met: return success, await more signers.
   - If threshold met: broadcast (see below).
7. Log to audit_log: `event=TX_SIGNED`.

**Response**:
```json
{
  "success": true,
  "signature_id": 999,
  "tx_id": 456,
  "signatures_collected": 2,
  "threshold": 2,
  "broadcast_initiated": true
}
```

**Errors**:
- `400 INVALID_SIGNATURE`: Signature doesn't match signer.
- `400 ALREADY_SIGNED`: Signer has already signed this tx.

---

### POST /transactions/{tx_id}/broadcast (Auto-Triggered on Threshold)

Broadcasts a signed transaction to the blockchain.

**Caller**: Automatically triggered when threshold reached; can also be called manually.

**Function Logic**:
1. Fetch transaction; verify status='SIGNED' (or 'UNSIGNED' if manual retry).
2. Fetch all signatures from `transaction_signatures`.
3. Pack signatures in Safe format (v, r, s concatenated).
4. Call Safe `execTransaction`:
   ```
   const tx = await safe.execTransaction({
     to: transaction.to_address,
     value: transaction.amount,
     data: transaction.data,
     operation: 0,
     safeTxGas: transaction.safeTxGas,
     baseGas: transaction.baseGas,
     gasPrice: transaction.gasPrice,
     gasToken: 0x0,
     refundReceiver: 0x0,
     signatures: packedSignatures
   });
   ```
5. Update `transactions.status = BROADCASTING`.
6. Start polling loop: check if tx confirmed on Base.
7. Once confirmed (1 block): update `transactions.status = CONFIRMED`, store tx_hash + block_number.
8. Notify all chapter members: "✅ Proposal [name] executed".
9. Log to audit_log: `event=TX_BROADCAST` and `event=TX_CONFIRMED`.

**Response**:
```json
{
  "success": true,
  "tx_id": 456,
  "status": "BROADCASTING",
  "tx_hash": "0x...",
  "estimated_confirmation_time": "30 seconds"
}
```

**Polling Response** (after confirmation):
```json
{
  "success": true,
  "tx_id": 456,
  "status": "CONFIRMED",
  "tx_hash": "0x...",
  "block_number": 12345678,
  "block_hash": "0x...",
  "confirmed_at": "2025-02-20T10:05:30Z"
}
```

**Errors**:
- `400 NOT_READY_TO_BROADCAST`: Not enough signatures.
- `500 RPC_ERROR`: Failed to broadcast (RPC outage).
- `400 TX_REVERTED`: Transaction reverted on-chain (e.g., slippage, insufficient liquidity).

---

## Webhooks (Inbound)

### POST /webhooks/turnkey (From Turnkey)

Turnkey notifies DormDAO when an MPC wallet transaction completes.

**Request**:
```json
{
  "event": "transaction_completed",
  "wallet_id": "user_wallet_123",
  "tx_hash": "0x...",
  "status": "SUCCESS",
  "timestamp": "2025-02-20T10:00:00Z"
}
```

**Function Logic**:
1. Verify Turnkey API signature (using Turnkey webhook secret).
2. Update member wallet balance cache (optional; can also poll periodically).
3. Log to audit_log if notable (e.g., large transaction).

**Response**:
```json
{ "success": true }
```

---

### POST /webhooks/persona (From Persona)

Persona notifies DormDAO of KYC completion.

**Request**:
```json
{
  "inquiry_id": "...",
  "status": "APPROVED",
  "user_email": "signer@example.com"
}
```

**Function Logic**:
1. Verify Persona webhook signature.
2. Find user by email.
3. Update `users.kyc_status` = APPROVED.
4. Promote user to Treasury Signer role (if not already).
5. Notify Org Admin: "Treasury Signer KYC approved: [name]".
6. Log to audit_log: `event=KYC_APPROVED`.

**Response**:
```json
{ "success": true }
```

---

### POST /webhooks/chainalysis (From Chainalysis)

Chainalysis notifies DormDAO of transaction screening results.

**Request**:
```json
{
  "address": "0x...",
  "risk_level": "HIGH",
  "reason": "Known sanctions address",
  "timestamp": "2025-02-20T10:00:00Z"
}
```

**Function Logic**:
1. Verify Chainalysis signature.
2. Store in cache: address → risk_level.
3. If HIGH risk and tx pending broadcast: block broadcast, notify Org Admin.
4. Log to audit_log.

**Response**:
```json
{ "success": true }
```

---

## Batch Jobs (Cron)

### Nightly: POST /batch/close-expired-proposals

Closes all proposals with expired voting windows.

**Trigger**: Cron job, daily at 00:00 UTC.

**Logic**: 
- Query `proposals` WHERE status='VOTING' AND voting_end_at <= now().
- For each: call `/proposals/{id}/close-voting` (logic above).

**Response**:
```json
{
  "success": true,
  "proposals_closed": 5,
  "passed": 3,
  "failed": 2
}
```

---

### Daily: POST /batch/export-audit-log

Exports audit log entries from past 24 hours to S3.

**Trigger**: Cron job, daily at 01:00 UTC.

**Logic**:
- Query `audit_log` WHERE created_at >= now() - 24 hours.
- Serialize to JSONL format.
- Upload to S3 bucket: `s3://dormdao-audit-logs/logs/2025-02-20.jsonl`.
- Enable Object Lock (immutable for 7 years).
- Store S3 ETag hash in DB for integrity verification.

**Response**:
```json
{
  "success": true,
  "entries_exported": 1245,
  "s3_location": "s3://dormdao-audit-logs/logs/2025-02-20.jsonl",
  "file_hash": "sha256:..."
}
```

---

### Weekly: POST /batch/update-wallet-balances

Polls blockchain RPC for wallet balances (cache refresh).

**Trigger**: Cron job, daily at 06:00 UTC.

**Logic**:
- Query all wallets (chapter + treasury).
- For each: call RPC `eth_getBalance` + `eth_call` to fetch token balances.
- Update `wallets.balance_native` + custom token balances (stored in audit_log or separate table).
- Cache in Redis (optional).

**Response**:
```json
{
  "success": true,
  "wallets_updated": 25,
  "timestamp": "2025-02-20T06:00:00Z"
}
```

---

### Quarterly: POST /batch/archive-audit-log-to-arweave

Archives quarterly audit logs to Arweave for permanent storage.

**Trigger**: Cron job, 1st day of quarter at 02:00 UTC.

**Logic**:
- Query `audit_log` WHERE created_at BETWEEN (last quarter start) AND (last quarter end).
- Serialize to JSONL + gzip.
- Upload to Arweave using Irys SDK.
- Store Arweave TX ID in DB.

**Response**:
```json
{
  "success": true,
  "entries_archived": 15000,
  "arweave_tx_id": "...",
  "file_size_bytes": 5242880
}
```

---

## Error Handling

**All Endpoints** return error in consistent format:

```json
{
  "success": false,
  "error": {
    "code": "POLICY_VIOLATION",
    "message": "Daily spend cap exceeded",
    "details": {
      "daily_cap_usd": 50000,
      "spent_today_usd": 42000,
      "requested_amount_usd": 15000,
      "available_usd": 8000
    }
  }
}
```

**HTTP Status Codes**:
- `200 OK`: Success.
- `400 Bad Request`: Validation error (invalid input, policy violation).
- `403 Forbidden`: Permission denied (RLS violated).
- `404 Not Found`: Resource not found.
- `500 Internal Server Error`: Server/external service failure.

**Retry Logic**:
- `5xx` errors are retryable; client should retry with exponential backoff.
- `4xx` errors are not retryable (user must fix input or request permission).

