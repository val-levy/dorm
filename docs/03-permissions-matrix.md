# DormDAO Permissions Matrix

## Role Definitions

| Role | Scope | Typical User | Key Responsibility |
|------|-------|--------------|-------------------|
| **Member** | Chapter | Student at school | Vote on proposals, participate in chat |
| **Analyst** | Chapter | Student researcher | Author pitches/posts, promote proposals |
| **Chapter Lead** | Chapter | Elected chapter admin | Manage members, co-sign chapter wallet transactions, enforce policies |
| **Treasury Signer** | Organization-wide | Trusted senior member | Co-sign large treasury transactions with hardware wallet, approve inter-chapter moves |
| **Org Admin** | Organization-wide | DormDAO HQ staff | Manage chapters, audit logs, compliance, emergency controls |
| **Observer** | Organization-wide | Alumni, advisors, LPs | Read-only access to public posts and proposals |

---

## Permissions Matrix

### Legend
- **R** = Read (view, no modification)
- **W** = Write (create, edit, delete own content)
- **A** = Admin (edit/delete others' content, manage access)
- **—** = No access
- **Spec** = Detailed specification in notes column

| Feature | Member | Analyst | Chapter Lead | Treasury Signer | Org Admin | Observer |
|---------|--------|---------|--------------|-----------------|-----------|----------|
| **ACCOUNT & PROFILE** |
| View own profile | R/W | R/W | R/W | R/W | R/W | — |
| View chapter members | R | R | R/A | R | R/A | — |
| View all users | — | — | — | — | R/A | — |
| Edit own profile | W | W | W | W | W | — |
| Promote member → analyst | — | — | W | — | W | — |
| Promote to chapter lead | — | — | — | — | W | — |
| Promote to treasury signer | — | — | — | — | W | — |
| Suspend/remove member | — | — | W | — | W | — |
| **CHAT** |
| View public channels | R | R | R | R | R | — |
| Join public channel | W | W | W | W | W | — |
| Create channel | W | W | W | W | W | — |
| Post message | W | W | W | W | W | — |
| Edit own message | W | W | W | W | W | — |
| Delete own message | W | W | W | W | W | — |
| Pin message (own channel) | — | — | W | — | — | — |
| Delete others' message | — | — | W | — | W | — |
| Mute channel | W | W | W | W | W | — |
| **POSTS (BLOG)** |
| View public posts | R | R | R | R | R | R |
| View chapter posts | R | R | R | R | R | — |
| Create post | W | W | W | W | W | — |
| Edit own post | W | W | W | W | W | — |
| Delete own post | W | W | W | W | W | — |
| Pin post (in channel) | — | — | W | — | — | — |
| React to post | W | W | W | W | W | — |
| Comment on post | W | W | W | W | W | — |
| Edit own comment | W | W | W | W | W | — |
| **PROPOSALS (VOTING)** |
| View proposals | R | R | R | R | R | R |
| Create proposal (from post) | — | W | W | — | W | — |
| Create proposal (standalone) | — | W | W | — | W | — |
| Edit own proposal (DRAFT) | — | W | W | — | W | — |
| Edit own proposal (VOTING) | — | — | — | — | — | — |
| Vote on proposal | Spec | Spec | Spec | Spec | — | — |
| Delegate vote | W | W | W | W | — | — |
| View vote history | R | R | R | R | R | — |
| View vote results (live) | R | R | R | R | R | R |
| View Merkle receipt | R | R | R | R | R | R |
| Cancel proposal (proposer) | — | W | W | — | W | — |
| Cancel proposal (admin) | — | — | — | — | W | — |
| **WALLETS & CUSTODY** |
| View member wallet (own) | R | R | R | R | R | — |
| View chapter wallet | R | R | R | R | R | — |
| View treasury wallet | — | — | — | R | R | — |
| Initiate execution (from proposal) | — | — | W | W | W | — |
| Sign chapter tx (as Chapter Lead) | Spec | Spec | W | — | — | — |
| Sign treasury tx (as Treasury Signer) | — | — | — | W | — | — |
| View pending signatures | Spec | Spec | Spec | Spec | R | — |
| View tx history | R | R | R | R | R | — |
| Add signer to chapter wallet | — | — | W | — | W | — |
| Remove signer from chapter wallet | — | — | W | — | W | — |
| Update spending policy | — | — | W | — | W | — |
| Emergency pause wallet | — | — | — | — | W | — |
| **AUDIT & COMPLIANCE** |
| View audit log (own actions) | — | — | — | — | R | — |
| View audit log (chapter) | — | — | R | — | R | — |
| View audit log (all) | — | — | — | — | R | — |
| View compliance flags | — | — | — | — | R | — |
| Initiate KYC flow | — | — | — | — | W | — |
| Update compliance status | — | — | — | — | W | — |
| **SETTINGS & ADMIN** |
| View chapter settings | R | R | R/A | — | A | — |
| Update chapter settings | — | — | W | — | W | — |
| Create chapter | — | — | — | — | W | — |
| Archive chapter | — | — | — | — | W | — |
| View organization settings | — | — | — | — | R/A | — |
| Update organization settings | — | — | — | — | W | — |
| Manage notification preferences | W | W | W | W | W | — |

---

## Feature Gates — Detailed Specs

### Voting (Vote on Proposal)

**Requirements to vote**:
- Have role in chapter (Member, Analyst, Chapter Lead, Treasury Signer, or Org Admin).
- NOT in restricted jurisdiction (`is_restricted_jurisdiction = false`).
- Proposal is in VOTING state.
- Proposal voting window has not ended.
- Have not already voted on this proposal (check `votes` table for existing row).

**Acceptance**: Vote recorded in <500 ms; vote count updates in real-time; UI shows "Vote recorded" confirmation.

---

### Sign Transaction

**Chapter Lead signing**:
- Must be assigned to chapter wallet as a signer (in `wallets.signer_addresses`).
- Transaction must be in UNSIGNED status.
- Transaction has not timed out (48 hours from creation).
- User opens app, navigates to pending signatures, reviews tx details, signs with biometric/PIN.

**Treasury Signer signing**:
- Must be assigned Treasury Signer role (and passed KYC).
- Transaction must be in UNSIGNED status.
- User opens app, taps "Sign with Ledger", confirms on hardware wallet.

**Acceptance**: Signature submitted in <30 sec (chapter) or <2 min (treasury); signature count incremented; if threshold met, broadcast initiated.

---

### View Pending Signatures

**Eligibility**:
- Chapter Lead: can view pending sigs for chapter wallet txs where they are a required signer.
- Treasury Signer: can view pending sigs for treasury wallet txs where they are a required signer.
- Org Admin: can view all pending sigs.

**Acceptance**: Pending sigs list loaded in <1 sec; shows tx details (amount, recipient, gas estimate); notifications sent to each required signer within 1 min of tx construction.

---

### Initiate Execution

**Eligibility**:
- Analyst or Chapter Lead in the chapter: can initiate execution for chapter-wallet proposals.
- Treasury Signer or Org Admin: can initiate execution for treasury-wallet proposals.
- Proposal must be in PASSED status.

**Flow**:
1. User taps "Execute" on proposal detail.
2. Edge Function `construct_transaction` called.
3. Policy engine checks (spend cap, asset allowlist, cooldown, geo-fence).
4. If policy violation: return 400 with reason; show error modal; user can adjust or contact Chapter Lead.
5. If pass: tx constructed, stored in `transactions` table with status UNSIGNED.
6. Required signers notified (push + email).
7. UI shows "Execution initiated" + notifications sent.

**Acceptance**: Tx constructed in <2 sec; signers notified in <1 min.

---

### View Vote History

**Members of chapter**: can view all votes for proposals in their chapter (if not private voting). Shows vote counts and Merkle receipt if available.

**Privacy note**: During voting window, vote results are hidden; revealed after close. Vote author anonymity is optional per proposal (proposal creator decides).

---

### Download / Export Audit Log

**Org Admin only**: can export audit log as CSV for period (e.g., last 30 days). Export includes all fields except org signing key.

**Acceptance**: Export generated in <10 sec; downloaded to device; file encrypted in transit (HTTPS).

---

## Role Hierarchy & Promotion Flow

```
Member (default)
  ↓ (Chapter Lead promotes)
Analyst (can author pitches, co-author proposals)
  ↓ (Org Admin promotes)
Chapter Lead (can co-sign chapter transactions, manage members)
  ↓ (Org Admin promotes)
Treasury Signer (can co-sign treasury transactions; requires KYC)
  ↓ (Org Admin promotion; typically not reversed)
Org Admin (global admin)

Observer (read-only, separate track)
```

**Constraints**:
- Can hold multiple roles (e.g., Analyst in Harvard, Chapter Lead in Stanford).
- Promotion tracked in audit_log with timestamp + promoter ID.
- Demotion requires Org Admin approval; logged.

---

## Database-Level Enforcement

Every permission in the matrix above is enforced at RLS policy level. Examples:

**Example 1: Only Chapter Leads can update chapter wallets**
```sql
CREATE POLICY "Chapter Lead can update chapter wallet policies" ON wallets
  FOR UPDATE
  USING (
    type = 'CHAPTER_SAFE'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()::bigint
      AND chapter_id = wallets.chapter_id
      AND role = 'CHAPTER_LEAD'
    )
  );
```

**Example 2: Only members in a chapter can vote on chapter proposals**
```sql
CREATE POLICY "Users can vote in their chapter" ON votes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proposals p, users u, user_roles ur
      WHERE p.id = votes.proposal_id
      AND u.id = auth.uid()::bigint
      AND u.chapter_id = p.chapter_id
      AND ur.user_id = u.id
      AND ur.chapter_id = p.chapter_id
      AND ur.role != 'OBSERVER'
      AND u.is_restricted_jurisdiction = false
    )
    AND voter_id = auth.uid()::bigint
  );
```

---

## UI-Level Enforcement

All permissions are ALSO enforced at UI level (for UX):
- Buttons hidden if user lacks permission (e.g., "Promote to Lead" hidden for non-Chapter-Leads).
- Forms pre-validated before submission.
- Toast notifications explain why actions are unavailable.

**Reason**: Better UX; security relies on RLS at API level (defense in depth).

