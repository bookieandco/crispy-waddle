# SHARK-SNIPER.SIGNER-CERTIFY.36–.40
2026-10-23 (America/Los_Angeles)
Stack: #1506 → #1505 → #1504 → #1503 → #1501 → #1499 → #1497 → #1457.
**Source-only, protected, read-only certification; no live authorization.**

## .36 — independent signer-host message verification
`sniper-signer-message.ts` implements a second bounded legacy/v0 message
decoder independent of the earlier public research byte auditor. It parses
the exact 1,232-byte-max unsigned message, one required Coffer signer,
fee payer, blockhash, static signer/writable account classification,
compiled instructions and program IDs, then computes SHA-256 of original
wire bytes. It rejects pre-signed transactions, malformed/noncanonical
shortvec, unexpected signer, unrecognized version (including v1), excess
accounts/instructions and opaque trailing data.

Reference: https://solana.com/docs/core/transactions/versioned-transactions

## .37 — trusted v0 address lookup resolution
Resolve each referenced address lookup table through a host-owned, read-only
Solana RPC interface. Verify table address/owner program, source slot,
activation relative to last extension, no deactivation, index bounds, no
duplicate address/index/table, total account bound and writable-before-readonly
resolution ordering. Host must separately guarantee genuine RPC transport,
context/finality, account-owner/state authenticity and consistent slot. A
caller-supplied lookup table or string cannot establish that proof.

v1 transactions have a different wire layout and remain unsupported here.
Nothing silently downcasts v1 to v0. ALT support in this module does NOT
silently enable ALTs in the earlier SHARK research byte audit.

## .38 — signer-host simulation and token-effect research
`sniper-signer-certification.ts` separately calls a trusted unsigned
simulation adapter with the *exact* original transaction/hash. Match
observed slot, blockhash, all reported outer + inner/CPI program IDs against
a strict allowlist, exact coffer-owned input and output token accounts,
input debit in native atomics, sufficient output credit, and base/priority/
Jito fees plus no unexpected SOL debit. Any mismatched mint, owner, amount,
program, error or unidentified CPI blocks the review.

This is a deliberately narrow model. It does NOT inspect arbitrary router
instruction ABI, Token-2022 extensions, ATA initialization, wrapped SOL,
native SOL swap balances, rent exemptions, account creation, liquidity
changes, malicious/hidden stateful program effects, or actual future market
fills. For those cases the trusted simulation adapter must refuse to
declare `allInnerInstructionsObserved` and block certification.
No assertion of a safe actual Jupiter trade follows from this source alone.

## .39 — immediate Coffer/kill/replay checks
Read the isolated host's canonical canary risk snapshot, active signer
lease observation, fee reserve, unresolved entry/exit IDs and previously
used idempotency key. Check active lease, owner token allowlist, transaction
and daily exposure/loss caps, freshness and kill switch. Then independently
re-read the durable state after the asynchronous network simulation. If
state version changes, any unknown sell appears, halt toggles or the snapshot
becomes stale, refuse with `GUARD_CHANGED_OR_UNVERIFIED_AFTER_SIMULATION`.

**Race limitation:** two read-only state reads do not constitute an atomic
reservation or prove crash/nonce safety. The existing
`submitControlledDexCanaryLeg`, Money permit store, canary reservation,
signer implementation and `reconcileDexCanaryLeg` MUST remain the
exclusive source of any future owner-approved execution. This new module
cannot call them.

## .40 — certification and handoff
Adversarial tests exercise wire formats, ALT slot/owner/index, original
hash, exact account effects, fee/cost limits, inner-program mismatch,
kill-switch transition, unknown settlement, duplicate idempotency, stale
or revoked signer, and denial when risk guard fails. SHARK CI adds
these tests; full Money R13B + Jhadina Launch Gate must pass on exact head.

Every result, including `RESEARCH_OBSERVATION_MATCHED`, unconditionally
sets `canSign:false`, `canSubmit:false`, `canRetry:false`,
`canCreditPurse:false`. This is NOT a production signer or a profitable
sniper. Passing unit tests cannot certify actual Solana mainnet, RPC
credibility, private key custody, 0.6-second latency or real profit.

## Still required for real capital
1. Review stacked PR dependencies and reconcile source-only changes into
   a separately approved protected staging gateway.
2. Independent Solana library/cross-implementation verification; genuinely
   fetch and parse finalized ALT owner/data and consistent-slot state,
   validate all CPI and token-program instructions and address privileges,
   plus robust Token-2022 and wrapped-SOL flows.
3. Add a trustworthy signer-owned atomic Coffer permit/nonce/lease/budget
   reservation immediately before signing, transaction-message hash
   revalidation under the lease, credential isolation and kill/revocation.
4. Independently reconcile unknown signatures after a simulated provider
   timeout or host restart before allowing any replacement.
5. Restore canonical sniper/Shadow tables with RLS after isolated schema
   verification, then commission genuine read-only Helius streaming, private
   iPhone QA and measured entry-to-exit risk/latency.
6. Owner separately authorizes and funds a tiny isolated Coffer canary
   BUY, then (after confirmation) separately approves SELL, with full
   onchain fee/proceeds evidence. No unattended autonomous trading yet.

No wallet, Phantom connection, signer, trading flag, provider subscription,
Telegram login/listening, database schema, deployment or capital changed.
