# MUSIC-STREAM.RECOVER.01–.04 — source recovery

Date: 2026-10-18
Baseline current-main commit: ad5830382d6c209dca63da41c93f2575d6ed2242
Reviewed stacked donor head: 6d2864119df659ced397be8c802ec523956dc87f (draft PR #1203; 178 ahead / 886 behind base main, divergent).

## Recovered in source, not commissioned
- RECOVER.01 Authenticated Supabase SSR catalog scope; remove client x-user-id/demo identity and disconnected per-route in-memory repositories. A YouTube metadata import is **not** approved music or playable audio. Bounded import and tenant isolation tests.
- RECOVER.02 Owner/source/asset/rights-gated HTTPS playback tickets. Short-lived private Storage URLs are signed only with user-scoped SSR Storage RLS and never persisted to client storage; malformed schemes and expired signed links refused. Exact table RLS and private storage policy must be independently verified.
- RECOVER.03 One app-shell Music audio host with user-scoped queue/position, no URL-bearing command bus, account-switch invalidation and refreshed playback grants; coordinate TV/Music focus in the browser; include playback controller and security tests.
- RECOVER.04 Search, library, playlists, recent completed sessions and explicitly basic same-artist suggestions appear on the Music page. Preserve existing Music Juggernaut, Restoration Studio, YouTube connection and shell. No stale historical tree merged wholesale.

## Mandatory exact-head CI (not a substitute for runtime)
Run pnpm --filter @jhadina/music-core test, pnpm --filter @jhadina/music-core type-check, pnpm --filter jhadina-web test, pnpm --filter jhadina-web typecheck and web build (check actual package script names in CI). Require no cross-user playback, offline metadata authorization, injected URI, signed URL persistence, or malformed input regressions. GitHub CI must be complete and PASS at this PR's exact head; PR remains DRAFT until verified.

## Operator-owned blockers
- Canonical SWLC Postgres incident #1110: 57P03 / 53100 disk/availability in prior receipts, not retested live here. Existing Music table RLS and private Storage tenant isolation are **not certified**, and checkpoint migration/policies are unapplied. Do not run migration push/repair blindly.
- Two separate real users and JWT-based RLS-negative tests, plus private music-owned Storage tests; independent audio byte/SHA and rights review. Do not infer playback rights from YouTube/Spotify metadata or a checkbox.
- Actual owned playable audio, renewed tickets and streaming on the intended deployed origin; Safari iPhone portrait, background interruption, lockscreen/Media Session behavior and TV arbitration need physical evidence.
- No merge, deployment, production DB writes, external provider calls, purchases, billing, entitlement grants or release activation performed by this source change.

## Evidence policy
Code-provable changes must be distinguished from CI checks and live operator receipts. If main has moved since the pinned baseline, re-compare and reconvene a fresh exact-head integration. No release-ready or live-streaming claim.
