# Jhadina launch continuation — 2026-10-03 UTC

Observed main: `f9485800b39c1df0e65570d53c8ec7684049d7ef`.

## Updated release evidence

Production alias https://crispy-waddle-jhadina-web.vercel.app resolves to READY deployment `dpl_6PEsB6AEp6v1mDu94iiUCKkseAWM` on the observed main commit. GitHub comparison confirms merge `fb41db761f200e27fdd9ac286a77646782c60c11` (PR #874) is an ancestor, 243 commits behind. The earlier deployment rate limit no longer blocks the released session repair.

## CRM admission

The earlier missing CRM schema finding is superseded. SWLC currently has 14 relationship tables with RLS enabled, 27 relationship entities and 28 relationship work items. See `docs/architecture/CRM-PROD-FINAL-2026-10-01.md` for the separate CRM admission, backfill and recovery-canary receipt. Table presence and counts were independently queried in this pass; that does not recertify every statement in the CRM handoff or resolve repository-wide migration-history drift.

## WorkSession recovery probe

The companion SQL runs in one transaction under `service_role`, creates a uniquely named synthetic session/task, invokes the actual deployed lease RPCs, and rolls back. It performs no provider work, does not impersonate a signed-in user, and changes no schema or migration ledger.

Verified:
- a foreign owner cannot claim the task;
- worker A claims at attempt 1;
- worker B cannot claim the active lease;
- an expired worker cannot complete;
- worker B reclaims at attempt 2 with a new token;
- stale worker A cannot renew or complete;
- worker B can renew and complete;
- a completed task cannot be reclaimed;
- completion read-back reports released lease;
- independent post-rollback query reports zero probe sessions and zero probe tasks.

Result: PASS for deployed database lease recovery and fencing. Expiry was simulated by changing only the uncommitted probe lease. This is not a worker-process crash, scheduler admission, actual opportunity search, concurrent-load test or authenticated end-to-end test.

## Remaining launch acceptance

Live WorkSession, task and artifact counts are still zero. A successful owner Ask → durable result → reload → resume flow remains unproven.

Voice health returned HTTP 200 with `native:false`, `status:browser-fallback`, `canonicalVoiceProfile:jhadina:canonical`.

Next acceptance sequence:
1. Signed-in owner Ask on iPhone; verify first save and reload context, failed-save warning, account switching and explicit session links.
2. Actual read-only task admitted through the application and scheduler, with durable result and interruption/recovery receipts.
3. Native voice provisioning and microphone/playback/interruption acceptance.
4. Private daily-use acceptance covering the admitted capabilities.

Verdict: session repair DEPLOYED; CRM schema PRESENT; database lease recovery PASS; full Jhadina launch NOT CERTIFIED.
