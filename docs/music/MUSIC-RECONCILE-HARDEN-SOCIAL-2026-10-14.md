# MUSIC-RECONCILE.01–.06 / MUSIC-JUGGERNAUT-HARDEN / MUSIC-SOCIAL-LIVE

**Audit date:** 2026-10-14 (GitHub evidence observed 2026-10-15 UTC).  
**Production repository:** `bookieandco/crispy-waddle`. **Baseline:** `main@a534e0f699e1e79ad51d3a4fe48a944a2882f4df`.  
**This branch:** `build/music-reconcile-harden-social-20261014`, based directly on audited main.  
**Research repository:** `bookieandco/music-restoration-intelligence`, separate authority, no imported audio.

## Exact source inventory (.01)

| Source | Observed head | Source disposition |
| --- | --- | --- |
| production main | `a534e0f699e1` | canonical baseline |
| merged Music autopilot PR #964 | `50acaa52a204` source, merged commit `ccf60a0cadcf` | already merged; do not duplicate |
| restoration/DAW PR #1141 | `a5babc6f13d0` | draft/unmerged; selective donor; 168 ahead / 577 behind main |
| old Social portfolio PR #1136 | `df425645b8e9` | open, non-mergeable, superseded in approval design |
| latest Social Identity PR #1237 | `8749e551befc` | open draft, stacked on #1236/#1235/#1223/#1220; 21 ahead / 366 behind main |
| Music operator PR #1203 | `6d2864119df6` | open draft; rights/SWLC/physical-device gates remain |
| research PR #4 | `9a15ab05d575` before provenance-CI update | open draft; separate repo and job-level runner failure |
| End-to-end handoff PR #1194 | `4b0fbb4c6563` | audit only, retained as historical handoff |

## Selective source port (.02)

Copied **unmodified from exact restoration donor** into current-main ancestry:

- `packages/music-core/src/music-daw-session.ts` and its test: non-destructive portable DAW session contracts, VST3/AU admission **not** browser plugin execution.
- `packages/music-core/src/music-daw-waveform.ts` and its test: sample-relative PCM/verified-hash waveform preview.
- `packages/music-core/src/restoration-engine/research-benchmark-bridge.ts` and its test: research metadata is read-only and cannot authorize production/Drive/rights.
- Exported only these three source modules from `packages/music-core/src/index.ts`.

**Intentionally retained in draft #1141, not ported:** worker GPU runtime, DrumSep inference, MIDI/DDSP native models, full DAW page/API and migrations, Google Homebase/DVC changes, native effects, real-song A/B. Their own dependency, approval, rights, and live commissioning gates remain unresolved. Do not close #1141 or claim the broader DAW is integrated solely on the basis of this port.

## Source CI repairs (.03–.04)

- The actual #1141 Media job **failed 5 of 41 restoration tests** with `ModuleNotFoundError: No module named 'numpy'`; log job `113669083520`, run `37883767925`. This branch installs pinned `numpy==2.1.3` immediately before running worker source tests, without commissioning a model. **Acceptance:** exact-head PR Media Certification succeeds; until then the source fix is unverified.
- Research PR #4 run `37715216463`, job `113117539676`, failed before any job steps; job log endpoint returned missing blob. No trustworthy Python stack trace exists. Its workflow now offers manual dispatch and emits **digest-only** proof by independently re-reading pinned Git blobs, checking SHA-256/size/count and recording a seven-day artifact. **Acceptance:** exact-head job starts, completes and emits two digest receipts. A missing runner step is an infrastructure blocker, not evidence of corrupt audio.

## Social Identity and approvals (.05–.06)

- **Already canonical on main:** Music Social proposal API and `jhadina_music_social_lineage`, owner session-bound `requestSocialPublication`, existing Social publication and provider-outbox action policy.
- **Keep from new stack #1237:** exact owner/profile/identity revision snapshots, approved immutable weekly packet, independent single-use child approval, transactionally consumed receipt, and a **non-dispatchable** outbox. These are currently draft/source-only, NOT live database migration.
- **Retain older #1136 as idea/reference donor** for PESO, niche learning, paid-readiness, audience strategy, weekly planning. Do NOT copy its earlier weaker weekly-parent-only execution assumptions over the newer independent-child-approval model.
- **Blocked:** #1110 SWLC database incident; SQL and RLS not certified live; no bound production Social child dispatcher, authenticated owner approvals, or provider result canary. PR #1237 deliberately returns `canDispatch:false` and `canExecute:false` and does not authorize scheduling. No broad Social merge was performed.

## Music autopilot hardening (.01/.05)

- Source service integration harness tests disabled charters and no attributable Social account without hitting external providers.
- An experiment is now keyed to the **versioned brief + exact platform**, rather than matching any row of the same song/family/section from an unrelated platform; no connected approved account means no fake `cross-platform-staging` experiment.
- The service now reports Director/Social waits as `waiting`, counts completed separately from submitted/prepared, surfaces learned-brief IDs, and releases a run `blocked` when any stage is unfinished or ambiguous (not merely when an ambiguous provider action exists).
- Learning requires a persisted **validated** Music row, at least 0.75 confidence, evidence refs, and a matching experiment on the selected song. It prioritizes that tested creative family and versions the subsequent hook/brief ID; never treats a cross-song or low-confidence observation as admitted learning. A growth-core test proves the next brief changes and rejects those controls. This proves source-level behavior, **not** real-world winning creatives.

## MUSIC-SOCIAL-LIVE acceptance boundary — incomplete

The **existing** Music -> approved Director asset -> Social proposal -> `jhadina_music_social_lineage` is kept. The scheduler intentionally stops before owner-session publication, with `approvalRequired:true`. Do not bypass that identity boundary, mint approvals with a service role, reuse consumed child receipts, or publish from Music directly.

Required remaining safe commissioning sequence:

1. Merge/rebase and independently certify the newer Social identity/approval stack with both-owner isolation, identity drift, idempotent child consumption, and RLS tests. Keep the isolated SQL rehearsal separate from production migrations.
2. Verify actual Song -> creative-brief version -> experiment key -> Director asset SHA/approval -> immutable Social packet/action fingerprint -> independent child receipt -> scheduled due action -> provider outbox/post ID -> attributed observation/outcome, with durable receipts at each hop.
3. Commission one final Action Core-authorized Social dispatcher using **existing** Social provider adapters; on missing/expired/mismatched receipt, stale identity, provider ambiguity, unknown rights, no handler or SWLC outage it must fail closed. No silent publication on a scheduler's service role.
4. Test recovery across restarts and lost provider response; no blind retries after ambiguous side effects. Demonstrate real provider published/scheduled status by readback before marking execution complete.
5. Only after the foregoing, run a tightly scoped owner-approved, rights-cleared Music canary. No billable GPU, paid advertising, private-audio publication or production SQL apply is authorized by this document.

## Source truth labels

- **Merged existing:** #964 Music Autopilot/runtime; existing Music-Social lineage API/DB contract on baseline main.
- **Ported in this PR:** portable DAW session + waveform, read-only research bridge, NumPy test dependency, attribution/completion repair, admitted-learning-to-next-brief and tests.
- **Retained as draft/research:** #1141 deep restoration; #4 research; #1136 legacy Social design; #1237 stronger Social identity approval stack; #1203 operator/security.
- **Blocked live:** SWLC incident #1110, restoration worker #822, restoration acceptance #1142, real media assets/device, canonical Social dispatch and provider/approval readback.
- **No claim made:** production migration, complete restoration model, real song certification, real approved publication, live hourly worker, DSP/GPU installation, or independent external test pass without exact-head CI.
