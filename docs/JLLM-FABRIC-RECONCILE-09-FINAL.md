# JLLM-FABRIC-RECONCILE.09 — bounded source closeout

Date: 2026-10-17 (America/Los_Angeles)
Recovery PR: #1364 (DRAFT)
Historical lineage: jllm-01-intelligence-fabric (271 ahead / 7,167 behind at audit)
Source change heads: .06–.07 3d7c8d9416f6df39875bb79c0843899f42628e2e; .08A 2a1452af5d77ecbf386d1a9b7c0f30a77afc1613; .08B b3eede33d27024e142ba02b4c5f0cffc891f32f2

## Four independent admission statuses

| Gate | Expected deliverable | Current disposition |
| --- | --- | --- |
| .06 local-model provider | Gated local adapter + deterministic fake-transport tests; no unintended external egress | SOURCE IMPLEMENTED, **runtime DISABLED** pending approved physical local worker |
| .07 canonical Artifact Core reconciliation | Do not import historical duplicate tables, bucket or migrations; owner/clean compatibility planner and tests | SOURCE IMPLEMENTED; direct resumable uploads/perception workers **BLOCKED FOR AUDIT/REPAIR** (#1389) |
| .08 progressive voice | Stream integrity/EOF tests, browser barge-in cleanup and cooperative worker stop | SOURCE IMPLEMENTED; provider hard-preemption, acoustic voice quality, and real iPhone testing **NOT VERIFIED** |
| .09 exact-head certification | Reproducible Intelligence Core + JLLM + Web/voice/Artifact regressions | Source CI must be evaluated on this final head; no runtime promotion |

## Invariants

- Main's governed `IntelligenceRouter`, Personality/RNC, Memory, Actions, Security, WorkSessions and evidence-binding remain canonical.
- `localModelEntry` defaults disabled. The constructor adapter has no HTTP/process adapter. An injected transport is *not* evidence of locally trusted execution.
- Owner-scoped artifact compatibility emits only inert planning outcomes. No new SQL, Supabase bucket, remote upload/write, auto semantic learning or scanner bypass.
- Reject unauthorized reranker content changes, unknown or compilation-excluded evidence, provider attempts to create policy/action authority, and implicit privacy downgrades.
- Chunked native voice exists; first-wave audio generation occurs in blocking provider calls and cannot be claimed immediately preemptible by a browser abort.
- Prevent browser speech fallback replay after a native audio chunk has already played. Fail closed on unsupported MIME, speaker identity mismatch, missing done event and interrupted reads.
- Preserve current main's rapidly evolving unrelated subsystems. PR should be merged only after GitHub resolves any new-main divergence and all required exact-head checks pass.

## Certifying procedure

1. Verify draft PR head SHA, base SHA, mergeability; rerun when either changes.
2. Require JLLM source certification, Intelligence Core type-check/tests, web build, interactive/context/UX/security and media/voice contract checks; inspect logs for any failures. A passing CI job is not proof of real devices, runtime services or permissions.
3. Audit available Vercel deployment metadata for the *same commit*. A READY production deployment for a different main SHA does not certify this PR.
4. Independently bind/confirm Jhadina's correct Supabase project before querying or modifying schema. Current connector inventory contains named Pupsonstuff and Swlc projects but no clearly identified Jhadina Artifact Core project. **Do not guess** project ID or apply seven old migrations.
5. Capture real user-authorized iPhone microphone, barge-in and voice-quality receipts, first-audio latency, two-provider identity/QC evidence, scanner/extractor benign/hostile media drills, and local worker provenance. If unavailable report BLOCKED, never synthesize receipts.
6. Keep production inactive: no model activation, no migrations, no voice identity approval or owner publishing/action execution without independent authorization.

## Final definition

This target closes the **bounded source implementation and review plan**, not the externally dependent `LIVE-RUNTIME PASS` or `FULL PRODUCTION CERTIFIED` state. At this commit do not assert any exact-head check success until GitHub returns a completed result. Confirm against GitHub PR #1364 before merge.
