# SHARK-SNIPER.COFFER-ACCEPT.41–.45
2026-10-23 (America/Los_Angeles)
Branch: `build/shark-sniper-coffer-accept-41-45-20261023`
Stack: #1508 → #1506 → #1505 → #1504 → #1503 → #1501 → #1499 → #1497 → #1457

## Scope and actual authorization
**Source-only certification**. The code added here cannot sign, submit,
retry, move money, fund a wallet or credit Purse. No paid RPC was provisioned,
Telegram listener started, production database migrated, production deployed,
secrets changed, or Solana mainnet buy/sell sent. User requested completion
of a coding sequence, not funding or signing specific transactions.

### .41 — Dual RPC read-only account-state evidence
`sniper-coffer-rpc-evidence.ts` queries two fixed HTTPS RPC endpoints
using finalized `getAccountInfo`, `minContextSlot`, canonical base64
account bytes and no redirects. It independently parses the Solana ALT
56-byte metadata layout: 4-byte state discriminator, deactivation slot,
last-extended slot, metadata, and 32-byte indexed addresses.
The two responses must agree on raw SHA-256, context slot, metadata and
address order; missing RPC, wrong owner, warm-up, deactivation, oversized
body or inconsistent observations fail closed.

**Important:** Agreement between public RPC nodes is NOT cryptographic
finality attestation or proof of trusted origin. Its authority is
`INDEPENDENT_RPC_OBSERVATION_ONLY` and
`canUseAsSignerAttestation:false`. It is NOT automatically wired as the
`SniperSignerRpcLookup` trusted adapter required by #1508.
Solana public endpoints are shared/rate-limited and unsuitable as a
certified production signer data source. Official reference:
https://solana.com/docs/rpc/http/getaccountinfo
https://solana.com/docs/rpc

### .42 — Durable atomic research reservation (single host)
`sniper-coffer-research-ledger.ts` uses a pre-created absolute
owner-private 0700 directory and O_EXCL 0600 single-writer lock.
Under that exclusive lease, it reads and validates checksummed receipts,
prohibits duplicate idempotency or execution IDs, conservatively
blocks any outstanding reserved/unknown entry, checks daily/order
spend and daily loss limits, and writes a fsynced receipt through an
atomic rename with directory fsync. Canonical Money approval intent is
validated; no actual Coffer sign, permit consumption or budget mutation.

This is **single POSIX-filesystem-host research journaling**. It is
not a cross-host distributed CAS, a signed signer permit, a fungible
`LiveCanaryStateStore` reservation, or shared Railway/Supabase
transaction accounting. A crashed lock, incomplete temp file or corrupt
record refuses auto-restart. No silent stale-lease takeover.

### .43 — Owner halt and revocation research guard
A permanent owner halt marker is persisted on local fsynced storage;
new research reservations refuse while halted. The interface has no
automatic reset and deliberately cannot issue an actual wallet revocation.
The real credential service, Money `activateLiveKillSwitch` and
`PermitStore.haltAll()` require separate operator commissioning.
Unit tests cover stale observation, unknown previous exits, owner halt,
crash locks, concurrent attempts and no unaudited restart.

### .44 — Independent settlement and crash recovery review
`sniper-coffer-recovery-review.ts` looks up the canonical execution
attempt by idempotency key and observes its actual recorded signature
through the existing `SolanaChainObserver`. Unknown/timeout/missing
attempts, mismatched mint/signature, failed onchain transactions or
minimum-output discrepancies return status for manual reconciliation,
**always with canRetry:false**. Only an attempt already reconciled by
canonical Money runtime can return `OBSERVED_RECONCILED`.
The research journal can record that observation only when the original
intent, attempt and onchain debit/credit/fee fully match; this does not
release permits, sign, update the actual financial ledger or credit Purse.

A `confirmed` network response is not the same as truly finalized
settlement. A real value-moving signer must independently use appropriate
finality and account reconciliation before releasing custody exposure.
The dedicated read-only recovery API cannot turn RPC belief into profit.

### .45 — Certification, staged acceptance and tiny-mainnet gate
Hermetic tests cover independent RPC disagreement/owner/finality/context,
shared-directory concurrency, idempotency, durable restart,
unknown-order halt, budget caps, permanent revocation flag,
matched settlement observation, chain outages and no-retry controls.
The SHARK workflow now includes those suites in its Money sniper step.
Check exact-head Money R13B, SHARK CI, Spatial and Jhadina Launch Gate.
No paper fixture is represented as a real onchain fill.

For an actual funded canary, after a **new and separate explicit owner
approval**, all items must be independently verified:

1. Review and selectively merge the stacked PRs against main. Address
   conflicts and re-run tests; do not activate while source remains draft.
2. Commission a trusted independent signer-side RPC/ALT parser with
   cryptographically or operationally attested source and cross-slot
   verification, simulated CPI/token effects, Token-2022/ATA/wSOL coverage
   and exact signed message-hash comparison. This source module alone
   does not fulfill signer certification.
3. Commission the canonical Money signer/permit flow and a real
   **distributed atomic** idempotency and budget reservation shared by
   all hosts, including an immutable unknown-execution journal. The local
   research lease is not that distributed ledger.
4. Validate emergency signer revocation and permit-store halt with
   token/key invalidation, off-host recovery and no privilege escalation.
5. Finish the missing canonical SHARK / Shadow archive schema with isolated
   migration dry runs, RLS, replay/backfill tests and explicit approval.
6. Independently confirm Helius source events, live quotes, sellability,
   slippage/priority/Jito tip estimates and measured landed entry→exit.
7. Confirm a protected owner iPhone login and exact deployed commit plus
   disabled default execution controls. Validate an unauthorized-user denial.
8. Agree on a small total funding cap, single-trade cap, daily loss stop,
   fee/slippage thresholds, key-custody plan and a separate Coffer wallet
   (Phantom remains owner wallet). Funding itself needs explicit approval.
9. Separately approve and execute **one tiny BUY** through the permitted
   runtime. Reconcile onchain wallet token/SOL changes, all fees and
   signature/finality. Do not auto-retry on timeout.
10. After that independent confirmation, separately approve **one tiny
    SELL**, and reconcile final proceeds/position; test kill/restart/
    unknown-settlement and user revocation drills before considering
    bounded autonomous trading.

No 0.6-second discovery-to-land claim, no profit expectation and no
real-money readiness claim is justified by these source-only changes.
