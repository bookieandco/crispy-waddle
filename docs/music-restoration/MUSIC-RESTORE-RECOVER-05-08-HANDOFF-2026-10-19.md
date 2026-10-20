# MUSIC-RESTORE.RECOVER.05–.08 — live audit / staged acceptance handoff

Date: 2026-10-19, America/Los_Angeles
Status: SOURCE WORK ONLY; **live production release blocked**.
Relationship: stacked on production PR #1421 (RECOVER.01–.04); research PR #6 remains separate.

## .05 — Observed infrastructure evidence

- A read-only Supabase project listing showed **Swlc** as `ACTIVE_HEALTHY`.
- Actual read-only SQL, migration-list, security-advisor, and performance-advisor requests to that same project's PostgreSQL all failed: **SQLSTATE 57P03**; `database system is not accepting connections`; `Hot standby mode is disabled`. The management project health label is therefore NOT evidence of a reachable database.
- A separate read-only Supabase log search found repeated PostgreSQL startup log hints on 2026-10-19 stating: "This probably means that some data is corrupted and you will have to use the last backup for recovery." This is a **warning/hint**, not independently established corruption or safe restore instructions. Treat data preservation and Supabase support/recovery investigation as P0; do not run destructive WAL reset, restore or migrations without controlled operator authorization.
- No schema, grants, RLS, Storage, database size, current backup or migration state was established. Do NOT infer absence of records from those connection failures.
- Production app source still has a historical fallback to the RunPod 8091 Music proxy (GitHub issue #822). No current authenticated worker-health/model receipt was retrieved in this tranche.
- Worker code in PR #1421 now reports dependencies separately from a commissioned model. RECOVER.05 additionally requires explicit model weight SHA-256, model admission receipt, and real-canary receipt before either public health or FINAL service treats the worker as `productionReady`.
- No service config, billing, deployment, SQL, migration, secrets or audio objects were changed.

## Smallest safe operational recovery, in dependency order

1. Operator verifies current database billing/capacity and incident state; obtain fresh *successful* read-only SQL and migration inventory before interpreting configuration. Do not assume an upgrade fixes hot standby startup.
2. On a connected database inspect `music_restoration_*` and `music_daw_*` tables, roles, functions and RLS; verify private buckets, two distinct owners, anonymous denial, service-role API and restrictive grants; collect current migration ledger. Run Supabase advisors.
3. Create a recoverable backup; prove isolated restore with independent hashes and owner separation BEFORE applying `20261007194500_music_daw_portable_sessions.sql` or any other migration.
4. Verify current worker URL/token route and admitted host. Do not rely on the historical RunPod URL unless current host evidence confirms it. Pin Demucs weights digest, model and device/version, record one actual completion receipt and hash-check output. No fabricated `productionReady`.
5. Only then validate one approved real-song case through existing ingest, separation, perception, repair candidate, blind A/B, actual QC, human approval, private DAW export and durable FINAL receipt. Preserve exact original bytes and `reconstructed` / `creative` labels. A successful demo or synthetic fixture does not fulfill this stage.
6. Independently process a second *different source*, rights-cleared multitrack, remote-only archive restore with independently checked original SHA-256, and an actual owner iPhone portrait and laptop saved/reopened session plus playback/export.
7. Advanced overlap vocal separation, deep drums, guitar identification, MIDI, installed/native effects and wet/full-length renders stay optional and **blocked** until the previous baseline gates pass. Require per-feature licensed inputs, pinned model/plugin digest, true counterexample benchmark, processing provenance, full-song output and owner approval.

## Machine-readable acceptance

`packages/music-core/src/restoration-recovery-acceptance.ts` exports
`evaluateRestorationRecoveryLaunch(evidence)`. It returns explicit named
stage gates for infrastructure (.05), first real song (.06), second song and
archive/device (.07), and six optional feature classes (.08).

The evaluator is pure and cannot itself prove rights or independent hashes:
operators must independently validate the evidence and keep immutable source
identifiers, receipt timestamps and verification logs. The included Vitest
tests use **synthetic assertions only**, not live production/audio acceptance.

## Not performed / release blockers

- No real owner recording downloaded, restored, auditioned or exposed.
- No second original, license clearance, multitrack, or remote-only restore measured.
- No physical phone/laptop test was run, and no desktop native VST/AU host was commissioned.
- No Supabase backup/isolated restore, SQL migration, real database RLS tests, worker commissioning, spending, or deployment.
- Do not merge or announce advanced model/wet render as available solely from donor code.
- Treat a failed/empty provider query as unavailable evidence, not a passing or empty state.

Close out only with the required true real-world receipts; GitHub CI success
is code conformance, not permission to certify music or service readiness.


## 2026-10-20 — recovery verified, safe source reconciliation

- **Live database recovered:** successful read-only SQL on Swlc (ca-central-1)
  reported `transaction_read_only=off` and `pg_is_in_recovery()=false`.
  Migration history, SQL, security and performance advisors work.
- Organization subscription is **Pro**. Official Supabase documentation says
  daily database backups normally exist on this plan with seven-day
  retention, but the connected Supabase actions DO NOT expose backup entries.
  Neither a dated completed backup nor a **tested isolated restore** is
  confirmed. Operator must inspect the actual Database > Backups dashboard.
  A DB backup covers Storage metadata, NOT private stored WAV/FLAC objects.
- Actual `music_restoration_*` tables exist with `ENABLE RLS` plus
  `FORCE RLS`, service-role-only SELECT, and service-role-only policies.
  The `jhadina-music-restoration` Storage bucket is private. This is a
  static database privilege check, NOT yet a second-owner live-negative test.
- Restored database has **zero** music restoration cases, artifacts, jobs,
  final certifications and reviews. An authenticated real-case DAW round trip
  cannot yet be demonstrated, since the app requires a valid owned case.
- The `20261007194500_music_daw_portable_sessions.sql` migration is **not
  applied**; `public.music_daw_sessions` and `public.save_music_daw_session`
  do not yet exist. No live migration was attempted.
- Supabase branching tool reported a historical development branch named
  `main` with status `MIGRATIONS_FAILED`, created 2026-08-07. This is not
  proof the current primary production database is down; do not reset it or
  infer current data loss from that status.
- Reconciled source PR #1421 onto current `main` with a merge commit,
  preserving the latest social/sports commits; reconciled stacked PR #1422
  onto that base. They remain **draft, unmerged, undeployed**.
- Fixed DAW save/load and local-native import routes plus Restoration Studio
  case-list and FINAL routes to await the existing
  `createRuntimeServiceRoleClient()` helper. This enables Vercel's
  request-context OIDC credential path when no long-lived server key is set,
  without bypassing owner session claim verification or broadening RLS.
  Synthetic route tests cover authenticated GET/POST, missing privileged
  client failure and forged owner header denial.

### Exact next runtime gates

1. Operator inspects **Database > Backups** and confirms the last completed
   post-recovery point, plus a separate Storage-object preservation strategy.
   Before SQL, preferably verify an isolated restore without modifying Swlc.
   Do not claim backup success from the Pro plan label alone.
2. Review the pending migration against the current live schema, dry run in
   an isolated environment, and independently check owner ACL, revision
   conflicts, mutation replay and response metadata.
3. Only after verified backup + explicit release authorization, apply the
   approved migration, rerun security/performance advisors, and check
   `music_daw_sessions` grants and RPC execution exclusively for service role.
4. Commission authenticated runtime service proxy and owned-case iPhone
   save/reopen. No source-only CI can prove this. With zero cases presently,
   first ingest a clearly permissioned owned recording.
5. Then continue the separately gated real-song and advanced model testing.

No database writes, production deployment, migration or audio import were
performed in this recovery continuation.
