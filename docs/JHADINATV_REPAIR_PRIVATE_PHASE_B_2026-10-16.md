# JTV-REPAIR.01-.04 → JTV-PRIVATE.FINISH.08-.12 (2026-10-16)

**Branch:** `repair/jtv-repair-01-04-and-private-08-12-20261016`.
**Status:** source implementation and tests proposed; external commissioning NOT VERIFIED.

## Preserved
- Existing media rights / territory and signed Jellyfin admission.
- World discovery metadata-only, local M3U/XMLTV imports (no public rebroadcast).
- Existing JTV CI and in-repository source catalog; no stale #150 merge.

## Implemented
- .01: owner-scope retained; deployment auth/keys and licensed rights remain outside the repository.
- .02: exact item lookup endpoint and watch-page ID resolution.
- .03: HTTPS same-origin, path-restricted HLS manifest references signed to the already-scoped media capability; rejects cross-provider redirects/references; encrypted HLS/DRM and receiver renewals still require tests.
- .04: Cast format is no longer blindly labeled mp4; AirPlay picker confirmation required. Opaque Jellyfin proxy casting now fails closed pending a real MIME and hardware canary.
- .08: owner-authorized Jellyfin personal movies/series and existing controlled streams.
- .09: separate Movies, Series, Search browsing routes, with no fabricated default titles.
- .10: exact series/season/episode mapping; unknown episode IDs are rejected.
- .11: RLS schema + user-scoped state API and operational checkpoints/watchlists. **Migration is committed only, not run.** Cross-device sync fails closed until Supabase commissioning.
- .12: watch-page resume/watchlist controls and Ask Jhadina per-owner operational viewing context; no permanent preference memory promotion.

## Unresolved acceptance
1. Check current-head JhadinaTV CI, media CI, web typecheck; review failures before merge.
2. Inspect Vercel production TV owner Auth ID, streaming-signing secret, Jellyfin environment, rights evidence and verified source entitlement. Do NOT put secrets in source.
3. Review and apply `supabase/migrations/20261016213000_jhadinatv_owner_consumer_state.sql` to canonical Supabase after connection restored; two distinct real auth users must prove RLS reads and writes isolated, RPC monotonic.
4. Safari iPhone actual audio, HLS VOD and Live TV, multi-variant playlists, manifest rotation/expiry after one hour, network interruptions and seek/Range. The same-directory HLS rule deliberately rejects out-of-scope references; alternate Jellyfin layouts need explicit security review.
5. On physical receiver, test AirPlay confirmed wireless state; Google Cast MP4/HLS real MIME/receiver; keep custom pairing unverified without WSS receiver implementation.
6. Continue Watching and watchlist across two devices; explicit opt-in before promoting viewing behavior into long-term Jhadina memory.
7. Playlist/browser-only import state is still local; user-scoped durable synchronization for imported URLs/EPG needs a separate encryption/retention design.
8. Verify signed-url timeouts and renewals, disable unproven cast or broadcaster sources rather than weakening authorization.
9. Track final git SHA, all required CI results, deployed SHA, service logs, owner/device receipts, rollback.

This PR does not authorize real media rights, expenditures, new subscriptions, or an automatic production deployment.
