# JH-042 — Agent operating-loop reconciliation

## Decision

Do not transplant PR #16's agent runtime. Current main already owns the canonical reasoning and execution path through Ask Jhadina, core-spine/intelligence, policy/approval, action-core, and durable audit.

PR #16's useful product requirement is retained as a read-only Activity & Audit surface. Its obsolete parallel agent contracts, globalThis audit store, hard-coded module-health claims, root app routes, and direct agent POST surface are rejected.

## Canonical flow

Ask Jhadina -> governed context -> intelligence/DELIA-class strategy -> policy/approval -> governed execution/MARISA-class work -> ActionExecutor -> durable audit/evidence.

JANET, DELIA, and MARISA remain roles/capabilities within the canonical spine; this task does not create a second orchestrator.

## Landed slice

- /activity is a standalone App Router route; PersonalCommandFeed and / are untouched.
- /api/system/activity verifies the signed-in actor before returning records.
- Activity reads the existing SupabaseAuditLedger by actor/domain.
- No global/in-memory audit store, fake status endpoint, or new execution authority is introduced.

## Deferred

A truthful system-status API should be built only after a canonical capability/health registry exists. Hard-coded online/connected/building states from PR #16 are not evidence of runtime health.
