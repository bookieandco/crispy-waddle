# SAM-SAFETY-LEDGER.05 → .07 — evidence boundary and source-only handoff

**Target:** PR stacked on SAM-CERT-HARDEN.01–.04 (#1336). Do not duplicate the earlier source-hardening work.

## .05 — Identify canonical authority sources

- `packages/jhadina-action-core/src/supabase-audit-ledger.ts` and `public.jhadina_audit_event` are the existing hash-chained Action Core audit schema/RPC.
- Read RPC `list_jhadina_audit_events` requires the same authenticated actor as its query and is **not** an exhaustive cross-actor SAM transport audit.
- `packages/opportunity-core/src/domain/engagement-ledger.ts` and `provider-transport.ts` model packet-scoped approved sends and external receipts; their existence in source does **not** prove every real provider transport is present in one durable, complete production ledger.
- Other external action surfaces (agency portal submissions, provider email, contract execution, payment, external fallback/direct send) require independent read-only receipts and completeness proof. An empty Action Core audit table is **not** an absence certificate.

## .06 — Bounded, non-authorizing Action Core observation

- Added `sam_safety_probe` as a dedicated action to `jhadina-sam-runtime-gateway`, behind its **existing exact GitHub OIDC** identity check.
- This action executes only six fixed read-only `count:exact/head:true` queries from `public.jhadina_audit_event` scoped to domain `sam`; no actor data, metadata, action payloads, write methods or caller-selected domain are returned.
- The audit table is **not** added to the generic `SAM_TABLES` adapter.
- Snapshot reports `atomicSnapshot:false` because separate count requests cannot establish a single transaction/read fence.
- No additional database migration, grant, auth change, financial authority, outreach or publishing path.

## .07 — Refuse false-green commissioning

- Domain `evaluateSamSafetyLedgerProbe` accepts only correctly scoped and coherent observations; even valid zero-event responses remain **blocked** with `safetyEvidenceComplete:false` and null violation/fallback counters.
- Scheduled SAM commissioning records explicit `safetyPreflight` and `safetyProbeError`; when a runtime source is unavailable it does not silently substitute a pass.
- A `certification.status !== 'pass'` causes a nonzero GitHub job exit code, preventing a green run from being mistaken for live admission.
- Tests cover invalid source/scope, forged flags, inconsistent totals, missing events, completed-but-unreconciled actions, failed actions, OIDC-gated fixed read scope and nonzero exit behavior.

## Still required before a real safety PASS

1. Platform: recover SWLC Postgres SQL and PostgREST (issue #1110), then verify deployed `sam_safety_probe` in the actual Edge runtime.
2. Durable coverage: inventory **all** SAM-capable outward transports and bind their append-only external execution receipts (send, bid, signature, payment, side channels) and authorization correspondence.
3. Integrity: prove a complete source roster, deterministic time window, sealed read-fence/consistent snapshot, hash-chain integrity and gap-free event coverage. Correlate all actors and permitted action classes; do not rely on a single `sam` domain.
4. Fallback: obtain independently sourced fallback/escape-hatch telemetry with explicit detection for unauthorized bypass. Absence must be attested, not assumed.
5. Only then implement an audit service that can produce trusted 0/positive violation counts; do **not** accept self-supplied JSON/status flags as production evidence.
6. Re-run real dated commissioning and three correlated live notices with separate rollout review. No production certification is claimed here.

**Authority invariants:** No automatic provider outreach, federal bid, execution/signature, billing, funds, deletion or destructive recovery. Code and tests are safe to review while SWLC is blocked.
