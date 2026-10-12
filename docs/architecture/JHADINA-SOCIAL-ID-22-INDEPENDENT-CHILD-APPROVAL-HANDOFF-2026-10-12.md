# JHADINA SOCIAL-ID.22 — Independent child Action/Security review and inert outbox
**Date:** October 12, 2026. **Parent:** draft PR #1216 verified commit `46b3c6a161166ffb1e878a86115503407b69662b`.

## Scope and truthful completion status
Source-only, staged on the Social Identity stacked PRs. SOCIAL-ID.16 remains **BLOCKED_FOR_AUDIT_REPAIR** in [#1211](https://github.com/bookieandco/crispy-waddle/issues/1211); no live Supabase DDL, durable receipt write, actual queue, phone owner approval or provider execution has been proved. No original PR #1136 wholesale merge.

## Implemented
- `weekly-child-action-gate.ts`: `requestWeeklyChildIndependentApproval` loads authenticated owner + exact current packet, effective account identity versions and non-executable persisted parent batch through .21 preflight. It calls the existing Action/Security policy, maps organic `public.publish`, comment `consequential.outreach`, paid `paid-ad.publish`, Director `take.generate`. It creates a PENDING Action Core receipt with action-scoped SHA-256 versioned ID; never approves it. Even policy 'allow' still requires owner approval for a weekly child.
- `stageApprovedWeeklyChildOutbox` rechecks owner, content, lineage, identity, version, parent batch and Security policy; calls `AtomicWeeklyChildOutboxStore.consumeApprovalAndStageChild`. Required implementation must lock/recheck those records inside a **single** ACID transaction, consume an independently approved/unexpired receipt and insert a *non-dispatchable* row. Exact same receipt+fingerprint retry returns existing row. Existing action with different receipt/lineage conflicts. Neither this function nor the outbox returns a transport lease, paid provider permit or direct publish access.
- `recoverStagedWeeklyChildOutbox` ensures owner and current canonical packet/identity are unchanged and rejects modified/stale rows.
- `supabase-weekly-child-outbox-store.ts`: hardened JSONB decoder and **commissioned=false** adapter with a proposed single RPC `jhadina_social_weekly_stage_child_outbox_atomic_v1`, and owner+packet+child+receipt readback. This SQL function and tables **do not exist yet as verified production components**. If enabled before creation, it errors closed. No HTTP route or worker connects it.
- Tests use local Action Core `InMemoryApprovalReceiptStore` and test-only simulation of an atomic transaction; verify all four capabilities, unapproved receipt refusal, independent approval consumption, lost-response idempotent retry, replay/conflicts, policy denial, owner isolation, identity/budget drift, DB race and DB outage, malicious persisted `canDispatch`, and no authorization returned. The tests **do not** prove real database ACID semantics or live provider rights.

## Still required, NOT complete in .22
1. Repair SWLC connection and independently test backup restore, RLS, migration inventory (#1211).
2. Build authoritative weekly packet persistence and both .21/.22 atomic single SQL transactions in an isolated schema; independently test exact owner/account/provider policy, race, receipt expiry and replay.
3. Phone owner approval UI, authenticated server route and Action/Security receipt verification with durable RLS; no auto-approvals.
4. At real production dispatch revalidate packet, identity and account rights *within* an actual Action/Security guard and per-target outbox lease. A staged child approval is not itself the separate current execution permit; no such handler is wired here.
5. Test two real accounts, disabled provider, stale snapshots, canary without paid spend, repeat/restart/resume, and exact deployed SHA before declaring SOCIAL-ID.16 or .22 production ready.

## GitHub gate
Keep the resulting .22 pull request draft and stacked on #1216. Exact-head CI must pass Social Core, Jhadina Web typecheck/full tests, UX, JLLM, Media, Spatial, Web Deploy Conformance, Growth Preview and Launch. Source completion ≠ live commissioning.
