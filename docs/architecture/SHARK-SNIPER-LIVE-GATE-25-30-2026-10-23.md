# SHARK-SNIPER.LIVE-GATE.25–.30 — isolated real-money acceptance design
Date: 2026-10-23, America/Los_Angeles
Base: #1504 → #1503 → #1501 → #1499 → #1497 → #1457.
Branch: `build/shark-sniper-live-gate-25-30-20261023`

## Commissioning truth: source-only, no live-money authority
The repo already contains Jupiter Swap V2 /order and /execute adapters, an existing
`submitControlledDexCanaryLeg` runtime with Money execution permits,
controlled canary reservations, signer leases, unsigned and signed simulation,
attempt persistence, ambiguous-result protection and onchain reconciliation.
**This PR does not call the submitter or construct a new broadcaster.**
It adds an explicit source-only sniper eligibility review in
`packages/money-core/src/sniper-live-canary-gate.ts`, with all outputs
`canSign:false`, `canSubmit:false`, `canTrade:false`,
`canCreditPurse:false`.

Do not mistake `REVIEW_READY` for owner approval or enabled signing. It
means *only* that the supplied evidence object passes this review. Any
attestation flags passed by callers must still be independently checked by a
privileged commissioned service against chain, quote, wallet and transaction
program instructions. They are not established merely by a TypeScript type
or green unit tests.

## .25 — governed router review
- Reuse `JupiterUltraDexAdapter`'s `/swap/v2/order` research quote and
  its existing managed `/execute` infrastructure, but never call /execute
  here. Do not add a competing router or unsupported fast-lane broadcast.
- Bind input/output mint, exact input atomic amount, minimum output, Jupiter
  request ID, isolated Coffer taker, risk lineage, selected fastlane quote,
  original launch age, expiry and separate chain mint identity proof.
- Treat an unverified transaction instruction list as **BLOCKED**. In
  particular check signer / fee payer / allowed programs / rent / transfer
  authorities with a proper decoder on a trusted isolated host before live
  signing. This PR adds an *attestation evidence requirement*, not that
  decoder. Never trust a browser boolean as proof of a safe transaction.
- `/order` and `/execute` are a managed route; `/build` is a separately
  reviewed lower-level path and cannot be silently swapped into the same
  contract. As of October 2026 Jupiter docs recommend Swap API V2:
  https://developers.jup.ag/docs/swap/index

## .26 — Sniper Coffer limited risk policy
- Keep owner's existing Phantom wallet distinct from
  `COFFER_EXECUTION_WALLET` (not simply another saved address).
- Reuse canonical `LiveCanaryPolicy` / `LiveCanaryStateStore`, signer
  lease policy and owner-approved exposure budgets.
- Refuse absent/mismatched wallet, expired signer lease, halted account,
  unknown unsettled attempts, gross/daily/order cap, daily realized loss
  stop, zero or insufficient fee-reserve, oversize slippage or price impact,
  excessive base/priority/Jito tips. No automated raising of owner caps.
- The test fixtures are **not** recommended real-money limits. Fees can make
  very small swaps uneconomical.

## .27 — simulation-to-signing boundary
- Actual signing is already handled by a distinct privileged Coffer signer
  in `dex-controlled-canary-runtime.ts`, after authenticated Money permit,
  independently validated transaction, lease, reservation and simulations.
- No new signer, secret, JWT, wallet address, API key, or execution endpoint
  has been created by this PR. Owners must separately authorize an isolated
  funded signer/custody setup and initial transaction limits.
- No default trade flag has been changed. The review is always unable to
  sign or submit, even when its status says `REVIEW_READY`.

## .28 — settled versus ambiguous result
- `reviewSniperOnchainSettlement` takes the existing canonical
  `DexExecutionAttempt`, original approved intent and onchain observation.
  It matches wallet, signer lineage, idempotency, mints, debit, minimum
  output, fee and exact transaction signature. Failed, missing, unknown or
  unmatched attempts are not accepted as confirmed proceeds.
- This review never updates the canonical attempt store, releases a permit,
  retries a possibly landed order, or credits Jhadina's Purse.
- Canonical `reconcileDexCanaryLeg` remains the sole settlement authority.
  No position should be considered flat simply because RPC returns zero
  inventory; reconcile unknown SELL submissions first.

## .29 — automatic-exit research proposal
- `reviewSniperCofferExit` delegates to the existing
  `evaluateSniperExit` sentinel (max hold, profit, trailing, drawdown,
  rug warning, full reverse sell quote and expiry). Prior UNKNOWN sell or
  unreconciled entry becomes `RECONCILE_FIRST`.
- `EXIT_REVIEW_CANDIDATE` is a proposal, not autonomous trading authority.
  Real automatic exits require reviewed independent quotes, same-token
  amount matching, fee/policy revalidation, actual signer lease, submitted
  signature, confirmed final state and override-safe kill switch semantics.

## .30 — test and authorization gates
- Added unit tests for Coffer/Phantom isolation, canonical Money approval
  hash, exact Jupiter order bindings, age, slippage/impact/fee/tip budgets,
  fee reserve, prior unknown, revoked lease, emergency halt, settlement
  signature mismatch, failed/unknown, and pending sell before reuse.
- Exports source-only review through `@jhadina/money-core`; SHARK CI now
  runs these tests. Money R13B and Jhadina Launch Gate must be checked on
  exact PR head. Passing fixtures DO NOT confirm runtime sign/submit.
- Remain draft until parents and cross-branch conflicts reviewed, no
  staging changes silently merged into main.

## Real canary prerequisites — *separate approval*
1. Complete original phone owner authentication and protected preview QA.
2. Restore canonical Shadow/sniper archive in isolated migration dry run;
   verify production RLS and least-privilege before any application.
3. Obtain actual Helius source and independent Solana chain + two-sided
   quote samples; measure p50/p95/p99 from chain event through exit settlement.
4. Commission an owner-approved isolated Coffer with a funded SOL reserve
   and carefully limited test assets. Never expose signer secrets on iPhone.
5. Implement and test transaction byte/program/account decoder and exact
   blockhash/fee/compute/prioritization limits; independently verify actual
   quote + route identity and simulation. No trusting intent strings alone.
6. A designated human approves a single minuscule mainnet BUY, waits for
   independently reconciled settlement, then separately authorizes a
   SELL and confirms final position/proceeds before any autonomous policy.
7. Prove loss kill switch, stale provider, crash/restart, nonce races,
   duplicate-sign blocking, unknown settlements, balance conservation
   and owner revocation; preserve audit receipts without secrets.
8. Only then separately review gradual limited automatic operation; do not
   imply a 600ms SLA or profitable edge from synthetic timing fixtures.

**No production deployments, migrations, wallet signing, deposits, trades,
live subscriptions, Telegram activation, or autonomous funding.**
