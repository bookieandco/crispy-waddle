# MUSIC-SECURITY.ACTIVATE.26–.30 — source-only executable acceptance handoff
Date: 2026-10-09. Stacked dependency: PR #1195 → #1196 → #1197 → #1198 → #1199 → this branch.

## Verified status
- PR #1199 at `f060926d7a2c71903a2bd61ee3d3d2f5bfff3fe2` passed all eight reported GitHub workflows before this work.
- Direct SWLC PostgreSQL read-only SQL still failed with `57P03` / 'hot standby mode disabled'; incident #1110 remains unresolved. **No DDL, provider-token commission, Storage mutation, account creation or paid capacity change.**
- `main` is not updated by source-only commits on this branch. Native physical playback and two-user RLS results are NOT claimed.

## Implemented source-only work
- **.26** `packages/music-core/sql/MUSIC-SECURITY-ACTIVATE-PREFLIGHT.sql`: refuses to proceed with unrecognized Music catalog policies and prints Storage policy expressions for mandatory operator review. It must be used only after PostgreSQL is restored.
- **.27** `apps/jhadina-web/src/lib/music/verified-audio-admission.ts`: independently verified byte hash, user folder, canonical private object path, file type, recent proof timestamps, separate rights reviewer and operator, with playback URL pinned to an independently supplied trusted Supabase Storage origin → **unapplied** deterministic rights plan. No public API for authorizing music assets and no database mutations.
- **.28** `music-two-user-readonly.ts`: requires two independent Supabase JWTs and positive records for both users, then verifies that Music catalog tracks, approved source rows, audio asset rows, cross-device checkpoints and private Storage objects cannot be read across users. Explicit cross-owner HTTP 403 is accepted; unknown errors/absent test fixtures **fail**.
- **.29** `music-two-user-live.test.ts`: runs only when `MUSIC_RLS_LIVE=1`. Default CI skips live customer data. It performs **no writes**, and no service-role key is used.
- **.30** `music-release-gate.ts`: evaluates distinct GitHub, writable DB/restore, RLS, two-user read **and write** denials, owned audio hash, licensed playback, URL renewal, actual iPhone audio and operator-release evidence. Green CI alone leaves the release locked.

## Live RLS test configuration (do not commit these values)
Set ephemeral environment variables privately: `MUSIC_RLS_LIVE=1`, `MUSIC_RLS_URL`, `MUSIC_RLS_PUBLISHABLE_KEY`, `MUSIC_RLS_USER_A_JWT`, `MUSIC_RLS_USER_B_JWT`, `MUSIC_RLS_USER_A_ID`, `MUSIC_RLS_USER_B_ID`, and, for each `A`/`B`, `MUSIC_RLS_USER_<A/B>_TRACK_ID`, `MUSIC_RLS_USER_<A/B>_CHECKPOINT_TRACK_ID`, `MUSIC_RLS_USER_<A/B>_STORAGE_PATH`. Each user's fixtures MUST exist and be readable to its rightful owner. Use short-lived account credentials, do not log them, and remove them after testing.

With an authorized recovered environment and fixtures, run:
```sh
MUSIC_RLS_LIVE=1 pnpm --filter @jhadina/jhadina-web test -- music-two-user-live
```
The test verifies only read isolation, including source/asset grant visibility. Each user's fixtures must also include \`MUSIC_RLS_USER_<A/B>_SOURCE_ID\` and \`MUSIC_RLS_USER_<A/B>_ASSET_ID\`, referring to actual owner-readable rows. **Write-denial** drills must occur under a separate approved sandbox transaction/rollback with known synthetic accounts. Do NOT try intentional unauthorized mutating requests against real customer records.

## Recovery/commission order
1. Owner-approved SWLC capacity/recovery from incident #1110. Verify real DB connection, `pg_is_in_recovery() = false`, free disk headroom and backup restore; never delete WAL or skip restoration evidence.
2. Run the two read-only preflights (`MUSIC-SECURITY-PREFLIGHT-READONLY.sql` and `MUSIC-SECURITY-ACTIVATE-PREFLIGHT.sql`); reconcile any old permissive catalog or Storage policy and role grants. **Do not blindly apply** the draft SQL files; create a reviewed, ordered Supabase migration with rollback.
3. Enable reviewed RLS on every `music_*` table and ensure `music-owned` is private and size/MIME restricted. Two-user read-only probe may run when fixtures exist; staging write-denial proofs are required separately.
4. Run private signed upload with exact byte/hash readback. Have independent reviewer and operator approve rights and provenance before a privileged backend writes `music_sources.authorized=true` and vetted `music_assets`. The admission plan itself never executes this write.
5. Prove live browser/iPhone source playback, signed URL reissuance, pause/seek/lock screen/background, and real device interruption/AirPlay receipts.
6. Review all stacked PRs, exact-head CI, permissions and merges in order. **Green workflows certify source checks only**, not production viability.

## Residual caveats
- No scheduled live test, no unattended rollout or production rollback was performed.
- Storage policy composition uses OR; a permissive unrelated old policy can defeat new grants. Human review remains mandatory.
- The isolated RLS test requires positive fixtures and does not validate streaming licenses, OAuth permissions, database write denials or private bucket runtime MIME configuration.
- Release gate fields are *claims* supplied by a future independent reviewer, not cryptographically verified attestations.
