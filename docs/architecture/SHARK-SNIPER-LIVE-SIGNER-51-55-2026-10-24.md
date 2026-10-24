# SHARK-SNIPER.LIVE-SIGNER.51–.55 — source-only pre-sign safety handoff

Date: 2026-10-24 (America/Los_Angeles)
Parent: #1513; stacked on #1509 → #1508 → #1506 → #1505 and earlier parents.
NO production migration, key installation, signer call, funding, broadcast,
Telegram listener, autonomous trade, or deployment. New code is draft only.

## .51 — pre-sign persistence before any wallet signer call
Migration `033_sniper_signer_presign_hold.sql` introduces a private
`money_sniper_signer_presign_intents` table. The stage function locks the
wallet-wide .46 research policy row before inspecting the original research
hold, original Money permit, active signer lease, fresh Money risk state,
and unresolved attempts. It records the exact unsigned transaction SHA-256
and initial `PRESIGN_HELD` state under unique execution, idempotency,
research-hold, and permit keys.

`PostgresSniperPreSignGate` requires the independently reviewed signer
simulation, exact original Jupiter transaction hash, original Action Core
permit fingerprint, wallet, lease and Money intent. The operator's result
is evidence of persistent **unsigned** intent only: canSign:false,
canBroadcast:false, canTrade:false, canRetry:false.

## .52 — atomic Money budget+nonce design (default unreachable)
A staged `money_sniper_signer_atomic_begin` SQL function models the
future single PostgreSQL transaction that consumes the original Money
permit nonce, reserves canonical Money risk budget, marks the execution
unresolved and changes the durable presign row to `SIGNING_UNKNOWN`
**before** any external signing action.

This function has no EXECUTE grants to PUBLIC/anon/authenticated/
service_role. More importantly, the .46 DB CHECK guarantees
`live_signing_enabled=false`, and policy defaults permanently halted.
The function always denies under this migration. No TS caller uses it for
real signing; the key service has no new signing API.

**Not commissioned:** the successful atomic branch has not been proven
on a real isolated signer/key host, and the runtime has not been
rewritten to bind cryptographically the exact PG reservation to the
signer-owned key lease and signed bytes. Do not relax the DB CHECK
or grant execute without a fresh owner-reviewed deployment.

## .53 — revocation
The unsigned stage requires an ACTIVE, nonexpired signer lease attached
to the same wallet and with sufficient per-transaction capacity. The
protected policy's permanent halt blocks all new stages.
The disposable PostgreSQL test revokes the lease before staging and
verifies rejection, then restores the lease *only within the disposable
test database*. It also confirms anon/authenticated/service_role lack
table and function privileges.

**Not commissioned:** actual remote signer key/token invalidation,
cross-host key withdrawal, and instant revocation propagation.
Do not infer those from a PostgreSQL metadata lease.

## .54 — crash/unknown recovery
The `PostgresSniperPreSignGate.inspect` operation is read-only and
returns:
- Missing record: `NO_RECORD_MANUAL_CHECK`.
- `PRESIGN_HELD`: `UNSIGNED_HOLD` (not approval to sign again).
- `SIGNING_UNKNOWN` or `SETTLEMENT_UNKNOWN`:
  `UNKNOWN_FREEZE_AND_RECONCILE`.
- Reconciled or revoked: observation only, no retry.

Every state returns canRetry:false, canSign:false, canBroadcast:false.
Recovery of an actual lost signed signature requires the existing
Money execution-attempt store, independently trusted chain receipts and
operator decision; it cannot be inferred from an unsigned hash.

## .55 — failure injection / disposable database acceptance
Adversarial TypeScript tests cover canonical Action Core permit binding,
false signer review, hash substitution, database outage, forged database
success, duplicate denial and every crash/recovery state.
The portable PostgreSQL workflow tests schema replay and (in
`scripts/shark-sniper-signer-presign-smoke.sh`) revoked lease, positive
unsigned record, replay rejection, no Money permit consumption, permanent
halt and function/table ACL denials. It also verifies that the staged
atomic signer operation **cannot** acquire a live reservation.

Run SHARK CI, Money R13B, Portable PostgreSQL, Spatial and Jhadina Launch
Gate on the exact PR head. Do not claim tests running/passing until
GitHub returns final results.

## Critical original runtime remains blocked
Existing `submitControlledDexCanaryLeg` calls
`signer.signVersionedTransaction` BEFORE
`attemptStore.put` and can release a canary reservation after signing
on later failures. This new separate guarded design does NOT modify or
commission that unsafe live call path. Before any real funds:
1. Atomically persist an attempt and unresolved budget/nonce under a
   signer-owned durable authority **prior** to key use.
2. Bind signer hardware/service to a one-use cryptographic permit and
   exact transaction bytes; deny signing unless reservation is durably
   COMMITTED and currently nonrevoked.
3. On any ambiguous response, NEVER release reserved risk, clear the
   unknown marker, grant fresh nonce, or retry the same economic action.
4. Persist exact signed signature before broadcast and reconcile
   independently confirmed/finalized chain token and SOL deltas.
5. Prove kill -9/network timeout/DB loss/signature disagreement with
   a real persistent host, separate worker, and true signer sandbox.
6. Commission missing Shadow tables and sniper archive and prospective
   event/quote/exit denominator, then protected iPhone QA.
7. Obtain separate owner approval for isolated wallet/caps, first tiny
   BUY, and after reconciliation a first tiny SELL.

`README` style docs and unit fixtures are not proof of production
custody, wallet connectivity, real fill, 0.6s execution, profitable
trading or autonomous operating authority.
