# DormDAO Open Questions

These questions require input from Val or other stakeholders before implementation can proceed. They are organized by category.

---

## Regulatory & Legal

### Q1: Regulatory Status

**Question**: Is DormDAO operating as a registered investment company, DAO, fund, or LLC? What is the legal entity structure?
**Answer**: Unofficial DAO for educational purposes, however real investments and money

**Why it matters**: Affects KYC/AML requirements, custody model (whether self-custody is allowed), jurisdiction restrictions, and compliance integrations.

**Examples**:
- If registered as fund: must follow SEC/FINRA rules; KYC mandatory for all; some jurisdictions restricted.
- If unregistered club: more relaxed, but still liable for fraud/money laundering if negligent.
- If DAO: uncertain legal status; recommend Delaware DAO LLC as wrapper.

**Action Required**: Confirm legal entity structure + jurisdiction of incorporation.

---

### Q2: Jurisdictional Restrictions

**Question**: Which countries/states are restricted from participation?
**Answer**: All 50 States are allowed however continue to implement this feature for future use

**Why it matters**: Affects RLS policy (`is_restricted_jurisdiction` flag) and compliance screening.

**Current Assumption**: Iran, North Korea, Crimea, Cuba, Syria (US OFAC list). Clarify if additional or fewer.

**Action Required**: Provide whitelist or blacklist of jurisdictions.

---

### Q3: Fund Size & Capital Thresholds

**Question**: What is the estimated fund size per chapter and across DormDAO? Are there transaction limits?
**Answer**:  50-150 thousand USD, usually one investment per week per chapter (~25 chapters)

**Why it matters**: Affects policy engine defaults (daily spend cap, emergency thresholds) and compliance screening levels.

**Examples**:
- If <$1M per chapter: smaller daily caps ($10k/day), simpler policies.
- If >$10M per chapter: larger caps, more sophisticated risk controls, possible SEC reporting.

**Action Required**: Provide rough fund size estimates.

---

## Governance & Operations

### Q4: Voting Method & Quorum

**Question**: What is the default voting method + quorum for each chapter?
**Answer**: Custom DAO called DormDAO sent through email or telegram (website)

**Why it matters**: Affects proposal DAO contract and voting logic.

**Current Assumption**: Simple majority + 50% quorum. Options:
- Token-weighted: members vote by contribution tokens (requires token tracking).
- Conviction: longer lock = more voting power (requires lock-in period tracking).
- Multisig: chapter lead vote only (centralized).

**Action Required**: Specify default per chapter + governance path to change.

---

### Q5: Signing Thresholds

**Question**: For chapter and treasury safes, what should the default N-of-M thresholds be?
**Answer**: over 50% yes

**Why it matters**: Affects Safe contract parameters + policy engine.

**Current Assumptions**:
- Chapter: 2-of-3 (faster execution, lower security).
- Treasury: 4-of-7 (quorum-based, high security).

**Trade-off**: Higher threshold = safer but slower. Lower threshold = faster but riskier if signers colluded.

**Action Required**: Confirm thresholds per chapter type (seed chapters vs. new chapters).

---

### Q6: Proposal Execution Authority

**Question**: Who can initiate execution of a passed proposal? Analyst, Chapter Lead, Org Admin only?
**Answer**: Admin Only

**Why it matters**: Affects proposal status flow + UI permissions.

**Current Assumption**: Analyst or Chapter Lead can initiate execution (for chapter wallet). Treasury Signer or Org Admin for treasury wallet.

**Alternative**: Org Admin only (more centralized, easier to audit).

**Action Required**: Confirm execution authority per proposal type.

---

## Capital & Crypto

### Q7: Target Chains

**Question**: Which blockchain(s) should treasury capital be deployed to?
**Answer**: Ethereum

**Why it matters**: Affects Safe deployment + RPC selection + gas optimization.

**Current Assumption**: Base (primary) + Arbitrum (backup).

**Alternatives**: Ethereum mainnet (highest security, highest gas), Optimism (similar to Arbitrum), Polygon (lower fees, less secure).

**Action Required**: Confirm primary and backup chains.

---

### Q8: Supported Assets

**Question**: Which tokens should be in the asset allowlist for each chapter/treasury?
**Answer**: Any/All

**Why it matters**: Affects policy engine asset validation.

**Current Assumption**: ["BTC", "ETH", "USDC", "DAI", "USDT"] as MVP. Can be configured per chapter.

**Action Required**: Provide asset list per chapter (or confirm flexible per-chapter config).

---

### Q9: Liquidity Pairs & DEX

**Question**: For BUY/SELL proposals, which DEX should DormDAO use? Uniswap, 1inch, Curve?
**Answer**: Uniswap

**Why it matters**: Affects tx construction logic + slippage tolerance.

**Current Assumption**: Uniswap V3 on Base (most liquid).

**Trade-off**: Higher slippage tolerance = safer (less revert), lower tolerance = better prices (more reverts).

**Action Required**: Confirm DEX + default slippage tolerance (e.g., 0.5%).

---

## Membership & Chapters

### Q10: Chapter List

**Question**: What is the complete list of 20–25 chapters and their email domain(s)?
**Answer**: Oregon, Cornell, Michigan, UT Austin, Illini, FranklinDAO, NYU, Dartmouth, Boiler Blockchain, Vanderbilt, Columbia, UBC, Waterloo, cambridge, berkeley, imperialDAO

**Why it matters**: Affects `chapter_domains` table initialization + auto-assignment logic.

**Example Format**:
```
Harvard: harvard.edu
Stanford: stanford.edu
MIT: mit.edu, media.mit.edu
...
```

**Action Required**: Provide chapter + domain mappings.

---

### Q11: Chapter Lead Assignment

**Question**: Who are the initial Chapter Leads for each chapter?
**Answer**: TBA

**Why it matters**: Required to register signers on chapter Safes.

**Example Format**:
```
Harvard: alice@harvard.edu, bob@harvard.edu, charlie@harvard.edu
Stanford: dave@stanford.edu, eve@stanford.edu, frank@stanford.edu
...
```

**Action Required**: Provide initial Chapter Leads per chapter (at least 3 per chapter).

---

### Q12: Treasury Signers

**Question**: Who are the 7 Treasury Signers (cross-chapter, geographically distributed)?
**Answer**: TBA

**Why it matters**: Required to initialize Treasury Safe on deployment.

**Requirements**:
- At least 2 different chapters.
- Geographic distribution (not all from same region).
- Available to sign txs within 24 hours (response time SLO).

**Example**:
```
Signer 1: Harvard, US East
Signer 2: MIT, US East
Signer 3: Stanford, US West
Signer 4: Berkeley, US West
Signer 5: Oxford, UK
Signer 6: NUS, Singapore
Signer 7: DormDAO HQ lead
```

**Action Required**: Provide 7 Treasury Signer names + emails + chapters.

---

## Compliance & Risk

### Q13: KYC Provider

**Question**: Should KYC be Persona, Sumsub, Onfido, or another provider?
**Answer**: Persona

**Why it matters**: Affects KYC webhook handler + compliance workflow.

**Current Recommendation**: Persona (easy API, good UX, trusted by crypto projects).

**Alternatives**:
- Sumsub: more comprehensive (includes sanctions, PEP check), higher cost.
- Onfido: strong on identity, lighter on sanctions.

**Action Required**: Confirm KYC provider + workflow (identity + address + sanctions minimum).

---

### Q14: Transaction Screening

**Question**: Should transaction screening (OFAC/sanctions) be Chainalysis, TRM Labs, or both?
**Answer**: Chainalysis

**Why it matters**: Affects webhook handler + tx broadcast logic.

**Current Recommendation**: Chainalysis (industry standard, good Base support).

**Alternative**: TRM Labs (real-time risk scoring, sometimes better for defi).

**Action Required**: Confirm screening provider + risk level thresholds (when to block vs. require override).

---

### Q15: Disaster Recovery SLA

**Question**: What is the acceptable RTO (recovery time objective) if a chapter signer is lost?
**Answer**: 24 hours

**Why it matters**: Affects backup procedures + signer redundancy planning.

**Current Assumption**: 24 hours (signer removed, replacement added, chapter operational).

**Alternative**: 1 hour (requires pre-authorized backup signers).

**Action Required**: Confirm acceptable RTO per wallet tier (chapter vs. treasury).

---

## Operations & Support

### Q16: Support Model

**Question**: Who handles user support (signup issues, signing failures, etc.)?
**Answer**: Zack Rosenblatt, Jack Schlosser

**Why it matters**: Affects documentation + internal runbook.

**Examples**:
- Org Admin team only (members reach out to Chapter Lead first).
- Dedicated support team (email + Slack).
- Self-service help docs + Discord.

**Action Required**: Confirm support contact + escalation path.

---

### Q17: Incident Response

**Question**: Who is on-call for incidents (e.g., transaction stuck, Org Admin signs without authorization)?
**Answer**: Jack Schlosser

**Why it matters**: Affects emergency pause authority + incident communication.

**Example Scenario**: Treasury tx broadcast fails; who decides whether to retry, cancel, or escalate?

**Action Required**: Provide on-call escalation + decision authority (Org Admin, Chapter Lead, community vote).

---

## Rollout & Launch

### Q18: Soft Launch Plan

**Question**: How many chapters should participate in soft launch? Who are the early adopters?
**Answer**: Oregon Blockchain

**Why it matters**: Affects testing scope + early feedback loop.

**Current Assumption**: 5 seed chapters (Harvard, Stanford, MIT, Berkeley, UT Austin).

**Action Required**: Confirm seed chapters + soft launch duration (2–4 weeks).

---

### Q19: Onboarding Timeline

**Question**: When should each chapter's members be onboarded? Staggered or all at once?
**Answer**: Oregon First, then the rest at once

**Why it matters**: Affects customer success load + support readiness.

**Example**:
- Week 1: 5 seed chapters live (10 people per chapter for testing).
- Week 3: 10 chapters live (public beta).
- Week 5: All 25 chapters live (GA).

**Action Required**: Provide rollout timeline + per-chapter launch date.

---

## Additional Notes

- **Compliance Cadence**: Recommend weekly reviews of audit logs (first 8 weeks), then monthly.
- **Metrics Dashboard**: Set up PostHog funnel tracking (signup → first vote → first execution) early.
- **Community Governance**: Consider Discord community + governance forum for proposal discussion (out of app scope for Phase 1).
- **Future Roadmap**: Advanced features deferred (conviction voting, on-chain governance, cross-chain bridges, DAO treasury in DeFi protocols) until Phase 7+.

