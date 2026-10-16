# JH-CLOSE.03 — Durable authority & recovery handoff (2026-10-16)

**Status:** CODE STAGED / DATABASE BLOCKED / NOT DEPLOYED / NOT ACCEPTED.  
**Stacked on:** PR #1322 `repair/jh-close-01-02d-20261016`, observed head `0df887facb8569ec15e1239ae818d6799060828d`.  
**Scope:** only canonical Memory storage authority, truthful health, read-only recovery certification and production Ask receipt safety. No new JANET, authorization provider or DB.

## 1. Grounded infrastructure evidence

Connected Supabase discovery exposed exactly two accessible control-plane projects:
- `Swlc`, ref `kqbkaozfjubkjevdfvic`, region `ca-central-1`, control-plane `ACTIVE_HEALTHY`.
- `Pupsonstuff`, ref `ztjyewacsmttkzktnyxl`, region `us-west-2`, separate e-commerce and project-specific tables.

A **read-only** SWLC public-schema discovery attempt failed:
`FATAL 57P03: the database system is not accepting connections; Hot standby mode is disabled.`

The earlier canonical `docs/supabase/SUPABASE-AUDIT-REPAIR-2026-10-05.md` records WAL replay and disk-full `No space left on device`. This observation is consistent with the same outage but is **not** an independent current disk-space measurement.

**No** read/write migration, pause/restore, bulk cleanup, Supabase project creation, backup deletion, RLS/grant edit, money movement or service reconfiguration was performed. The user prefers no new paid dependency.

## 2. Source changes / ownership

- `canonical-storage-admission.ts`: rejects unpinned/mismatched HTTPS Supabase destinations and unpinned portable origins. Default fail-closed.
- `createMemoryStorage.ts`: production requires separate `JHADINA_CANONICAL_SUPABASE_PROJECT_REF` pin; Vercel's presence alone no longer chooses an implicitly trusted default gateway. Explicit `oidc_gateway` honors the pinned endpoint; dev/test retains local storage.
- `uncommissioned-ask-approval.ts` and `jhadina-command.ts`: production Ask rejects approval-required requests unless a durable authenticated Action Core receipt store is injected. In-memory local tests remain possible. No automatic approval or execution.
- `handlers.ts`: blocked Memory startup/probe returns sanitized HTTP 503 with `durableMemory: blocked`, `canExecuteScheduledWork: false`, environment and deployed SHA. Scheduler's preflight rejects anything but a 200 + durable ready.
- `recovery-cert/route.ts`: validates canonical Supabase identity **before** privileged read-only probes; tests candidates, approved Memory, reasoning/experience, timeline and existing downstream tables.
- `supabase-production-recovery-cert.yml`: includes the new guard in source-trigger paths; existing OIDC and safe read-only certification remain unchanged.
- Tests: wrong-project, missing explicit destination, insecure gateway, portable origin mismatch, denied production approvals, old prod fallback rejection.

**Deployment configuration remains a separate explicit owner/operations step.** The repo `.env.example` pins the previously identified SWLC ref for reference; it is not proof that a live deployed Vercel endpoint uses that ref. Never publish service-role keys or bearer tokens.

## 3. Exact recovery order — do not skip

1. **Platform:** recover SWLC disk/WAL capacity via non-destructive platform support; no speculative deletion or paid upgrade.
2. **Database:** verify SQL accepts connections, `pg_is_in_recovery() = false`, persistent headroom and no new disk-full events.
3. **Identity:** confirm canonical runtime project ref and production URL match; compare the deployed application SHA with `main` and the audited migrations.
4. **Schema and authorization:** inspect migrations, RLS, grants and service-role/OIDC identity; deny unauthenticated/foreign owners. Do not apply blind migrations.
5. **Memory:** read-only four-table health first; then owner-authorized create/reload/restart/approve/correct/forget with durable lineage.
6. **Approval:** commission the existing Action Core `ApprovalReceiptStore` on a protected owner-authenticated store, with independent approval event, expiry/replay/foreign-owner denial and fail-closed resume. Current production Ask intentionally **cannot** approve pending proposals.
7. **Recovery:** prove backup and restore into **isolated** authorized target; verify sealed manifest/hash, source and target identity, TTL/retention, owner isolation and no mutation of production during validation.
8. **Scheduler:** OIDC exact workflow/branch/issuer/audience, `/api/health` exact production SHA and durable state, then one idempotent no-spend/no-publish worker canary.
9. **Cross-system:** independently attest Memory, Director, Social, Music, Money paper paths, Opportunity, Overage and Spatial; report separate incomplete domains.

Do not infer that the database recovered from a green GitHub CI, green Supabase control-plane label, or a response from Pupsonstuff.

## 4. Acceptance receipt fields

Exact GitHub PR head SHA; CI job URL and conclusion; deployed SHA and environment; canonical project ref; read-only SQL observed-at, recovery state and capacity; provider identity; owner/foreign-owner RLS outcomes; durability/restart/backup-restore receipts; scheduler OIDC source and idempotent worker result; remaining blockers.

Final state is only **ACCEPTED** after operator-observed production evidence. Until then: **STAGED / BLOCKED**.

## 5. Pending external blocker

SWLC DB connectivity refused at audit time. The Supabase MCP could list project metadata and inspect Pupsonstuff but could not inspect SWLC schema. Consequently migration integrity, owner records, live Auth, restored Storage objects, and commercial/live operating status are **UNVERIFIED**, not absent or complete.

**Follow-on:** `JH-CLOSE.04` owner-phone end-to-end continuity, after sufficient `JH-CLOSE.03` commissioning. Do not invent verified personal memory or physical-device success.
