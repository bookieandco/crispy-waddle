# SHARK Sniper — first mainnet canary owner approval packet
Status: **BLOCKED / NOT SUBMITTED FOR FINANCIAL AUTHORIZATION**
Date: 2026-10-23.
Delivery: separate from code PR #1513. No permission to sign, fund, broadcast or trade.

## Operator identity and custody
- Owner observation wallet: current Phantom wallet **observation-only**;
  do not use it as the bot signer, transfer source or fee payer.
- Dedicated Coffer wallet address: **NOT VERIFIED OR SET UP**.
- Custody method, immutable signer key reference and approved network:
  **NOT CERTIFIED**.
- Owner-private iPhone sign-in/unauthorized-user denial: **NOT CERTIFIED**.
- Manual emergency revocation and independent withdrawal controls:
  **NOT CERTIFIED**.

## Governance and financial exposure — approval required
- Maximum test Coffer funding (SOL): **OWNER TO APPROVE**.
- Maximum single trade, maximum daily loss and gross exposure:
  **OWNER TO APPROVE**.
- Maximum base/priority/Jito fees, slippage and price-impact:
  **OWNER TO APPROVE AFTER ACTUAL ROUTE QUOTES**.
- Token/program/recipient allowlist and freeze/honeypot/Token-2022 veto:
  **SIGNER-SIDE ATTESTATION REQUIRED**.
- Owner must authorize funding, first BUY and then first SELL as
  **separate actions**. Historical example budgets are not consent.
- Live signing, live trading, autonomous retry, profit sweep: **DISABLED**.

## Real-world performance prerequisites
- Current canonical Shadow/sniper archive includes six absent tables:
  money_shark_shadow_decisions, money_shark_shadow_executions,
  money_shark_shadow_observations, money_shark_shadow_lessons,
  money_shark_shadow_memory, money_shark_sniper_intel_archive.
  A research-only source audit does not replace those migrations.
- At least 100 prospective independently evidenced Helius launch events,
  including missed/blocked/expired coins and execution-unavailable cases.
  **NOT CERTIFIED**.
- Original launch identity, fresh two-sided sellable route, real cost
  and liquidity analysis: **NOT CERTIFIED**.
- Confirmed entry→exit measurements, p50/p95/p99, independent
  onchain finality and real loss statistics: **NOT CERTIFIED**.

## Infrastructure and engineering blockers
- Atomic signer-owned durable permit/nonce/budget reservation:
  **NOT COMMISSIONED**. SQL added by PR #1513 is RESEARCH ONLY.
- Existing Money controlled-canary runtime signs before attempt store
  persistence. Its crash window must be eliminated before any funds.
- Distinct signer key storage, V0 ALT owner/state and CPI verification,
  mainnet transaction byte validation and key revocation drills:
  **NOT COMMISSIONED**.
- Private persistent host, multi-host failure testing, double-sign race
  test and operator kill/restart: **NOT CERTIFIED**.
- Production schema migration: **NOT AUTHORIZED OR APPLIED**.

## First real transaction acceptance: sequence after all gates pass
1. Display the approved exact wallet addresses and risk caps to owner.
2. Receive separate explicit **funding authorization**, provision only
   the approved amount and verify by owner-wallet balance evidence.
3. Generate a provider quote, independently validate signer-held bytes,
   program/account/destination instructions, simulation and fees.
4. Receive separate explicit **one BUY approval**, consume one original
   Money permit/budget/nonce atomically, submit once, reconcile immutable
   signature and final wallet balances. A timeout is UNKNOWN, never
   automatic retry.
5. After settled BUY, receive separate explicit **one SELL approval**,
   verify genuine reverse-route liquidity, submit once under remaining
   budget, reconcile final balances and all fees/position inventory.
6. Test emergency stop/rollback and human review of observed losses
   before ever authorizing unattended trading.

No PR merge, production configuration, database migration, wallet
funding, credential installation or transaction authorization implied.
