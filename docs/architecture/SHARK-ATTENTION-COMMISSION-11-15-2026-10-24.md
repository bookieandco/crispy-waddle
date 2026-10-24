# SHARK-ATTENTION.COMMISSION.11–.15 — research-only commissioning

Date: 2026-10-24 (America/Los_Angeles)

**Status: source-only draft, stacked on #1512 then #1511. Production uncommissioned.**
No main merge, Vercel/Railway/Supabase mutation, cron activation, real phone notification,
Telegram chat collection, AI/ML use of Telegram API data, trading, signing,
funding, provider subscription, or wallet custody.

## Reconciliation / inherited acceptance

- #1511 (head `dbddb71a`, draft/unmerged) exact-head SHARK, Spatial and Launch Gate green.
- #1512 (head `eda0d4da`, draft/unmerged, based on #1511) exact-head
  SHARK, Spatial, Launch Gate, filtered web, mobile and other reported checks green.
- These passes are *ancestral source checks*, not the exact head of the current PR
  and not proof of deployed code.
- Existing `ops/meme/shark_live_intelligence.py` remains the canonical public
  discovery/paper SQLite worker. No competing scanner, learning model, trade
  event stream, or budget ledger has been created.

## .11 — provider and byte-budget gate

- Fixes the .07 DexScreener adapter's previous post-buffer length check:
  `attention-public-dex.ts` now consumes a streamed response with a 256 KiB
  **byte ceiling during reception**, rejects invalid content type, and retains
  a 5-second abort. No redirect, custom host or credential is permitted.
- Price, liquidity and time are included in the descriptive public receipt ID
  so distinct observations at the same clock tick are not conflated.
- New `reviewAttentionPublicReadBudget` returns a caller-controlled,
  one-request advisory admission. It caps per-minute configured usage to 60,
  two-or-more checks require an external host-atomic limiter, and no worker
  starts. The official DexScreener token-pairs endpoint advertises 300/min;
  this smaller ceiling is a project safety cap, **not** proof of rate limiter
  coordination across distributed instances.
- Still uncommissioned: actual transport/source authenticity, provider service
  conditions, HTTP byte-rate tests on a real host, permissions and operator budget.

## .12 — canonical prospective ledger continuity/recovery

- `reviewAttentionContinuity` tests sequential same-mint, same-pool,
  receipt IDs and a <=15-minute elapsed window. Stale/reversed clocks or
  pool changes receive distinct quarantine status.
- `ops/meme/shark_attention_operator_audit.py` opens only an **existing**
  private owner file (never creates a DB) in SQLite read-only mode, checks
  the canonical `shark_live_commission.audit_db` fingerprint/integrity,
  recent cycle timestamps and uncertain alert attempts. Returns explicitly
  false for host commissioning, provider attestation, encrypted off-host
  recovery, delivery and trading. No assumed 24–30h measurement is fabricated.
- Offline unit tests exercise missing files, symlinks, no file timestamp/size
  mutation and future-cycle rejection. CI uses existing
  `shark-live-intelligence-ci.yml`, with no network.

## .13 — owner-only alert projection review

- `stageOwnerResearchAlerts` validates all research-only cycle/alert fields,
  one exact authenticated-owner UUID input, event references, timestamps,
  size and HTTPS source links. Emits sorted rows matching the staged
  `shark_attention_owner_alerts` RLS projection from #1512.
- It does not authenticate the supplied owner UUID **itself**. The future
  server caller must derive it from a verified personal-owner Supabase
  session, never from client input; it also needs an independently protected
  service-role projector.
- `canPersist=false`, `canNotify=false`, `canTrade=false`. Existing GET
  route and phone page remain read-only; no migration is applied and no
  iPhone push/readback has occurred.

## .14 — prospective comparison guard

- Fixes lookahead: a supposed 24–30h price mark arriving **after** the
  30h deadline is now censored even if its reported eventAt is inside
  the interval.
- `auditProspectiveCoverage` reconciles considered/marked/censored counts
  and requires >=30 matched paper observations at >=80% coverage only to
  become **reviewable descriptive paper**, never independently validated alpha
  or executable P&L. Missing cases cannot disappear from denominators.
- All profits/costs remain price-only, hypothetical and uncommissioned.

## .15 — release gate and exact-head handoff

Eight required evidence gates:
`PARENT_PR_RECONCILED`, `EXACT_HEAD_CI`,
`PUBLIC_ADAPTER_PROVENANCE`, `BOUNDED_WORKER_RECOVERY`,
`PROSPECTIVE_CASES`, `OWNER_RLS_STAGING`,
`OWNER_DEVICE_READBACK`, `EXTERNAL_COST_APPROVAL`.
Missing, duplicate or unevidenced gates block staging.
Even eight documented successes result in
`READY_FOR_SEPARATE_OWNER_STAGING_REVIEW` with
`productionCommissioned=false`, `canStartWorker=false`,
`canNotify=false`, `signerAuthorized=false` and `canTrade=false`.
A string evidence URL in code is not independent verification.

## Tests and commands

```sh
pnpm --filter @jhadina/shark-intelligence-core type-check
pnpm --filter @jhadina/shark-intelligence-core test
pnpm --filter @jhadina/jhadina-web type-check
python -m unittest discover -s ops/meme -p 'test_shark_attention_operator_audit.py' -v
```

No local or repo API call should be reported as a real deployed service.
Inspect exact head's SHARK Intelligence, SHARK Live offline source, Spatial,
Jhadina Launch Gate and web-build checks; do not reuse earlier passing SHAs.

## External work still blocked

1. Parent review: #1511 -> #1512 -> this draft in order; reconcile main
   drift and independent wallet/Telegram/Supabase stacks before landing.
2. Host acceptance: a genuinely authorized fixed-origin public feed,
   centrally budgeted polling, retained independent receipts, restart,
   24–30h prospective outcomes and encrypted off-host restore tests.
3. Owner acceptance: separately approved staged migration + service-owned
   projector + authenticated private iPhone readback; no route opening,
   client bypass or unauthorized database writes.
4. Any future notifications: owner authorization, recipient controls,
   delivery idempotency, retention and fail-closed recovery evidence.
5. Any later live trading: separate Money/Coffer funded and witnessed
   signer/DEX canary, terminal kill-switch and budget approvals. This
   source does not enable that path.

References:
- Official DexScreener API: https://docs.dexscreener.com/api/reference
- Telegram API terms: https://core.telegram.org/api/terms
