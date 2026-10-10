# MUSIC-STREAM.FIX.01–.04 — execution handoff

**Production repository:** `bookieandco/crispy-waddle`  
**Base:** main at `9eaafe85395e85cea779946fca5672a3d413a102`  
**Scope:** listener-facing Music catalog/session/player only, separate from Music Restoration/Juggernaut.

## Implemented in this branch

1. Replace independent in-memory API instances with the canonical `SupabaseMusicRepository` and a verified Supabase SSR user session. Search and import share durable user-scoped tables; callers cannot impersonate another user with `x-user-id`.
2. Bound YouTube metadata import to valid, capped input. `youtube_music` imports are **catalog metadata only** and intentionally have `authorized: false` until media playback rights are established separately. Never infer download/playback rights from OAuth or metadata.
3. Add `GET /api/music/playback?trackId=` and `GET /api/music/session`. Return a playable URI only for the logged-in owner's matching track/source/media asset, with a separately authorized source, explicit `provenance.playbackAuthorized=true`, safe HTTPS asset URI, and a valid expiry when provided. Secrets and raw DB errors remain server-side.
4. Move the single Music player into the persistent Jhadina app shell, with scoped per-user queue/position persistence. Search-result playback commands resolve fresh authorized assets, then dispatch to the global player. The player never persists signed media URLs. Old unscoped playback URL caches are removed. Auth is rechecked on shell navigation; failures hide another account's cached player state.
5. Add no-provider, unauthorized-source, cross-user isolation, malformed input, unsafe URL, and expired-rights regression tests.

## Deliberately not claimed

- Existing production Supabase may be unhealthy; source integration is not proof of DB availability.
- Real provider or owned audio is not silently commissioned. A suitable `music_sources` row must have `authorized=true`, plus a matching `music_assets` row with `provenance.playbackAuthorized=true`. The media URL must be HTTPS and legitimately accessible to the authenticated listener.
- Live iPhone background audio/AirPlay/Cast, streaming URL renewal, seamless transitions, unified video/music focus, and real device playback still require runtime evidence.
- This is **not** a Spotify/YouTube stream downloader, entitlement bypass, DRM workaround, or royalty-rights claim.
- Current shuffle remains simple random selection and can repeat; True Shuffle/Autoplay Radio is the next separate tranche.

## Certification steps

- `pnpm --filter @jhadina/music-core test && pnpm --filter @jhadina/jhadina-web test && pnpm --filter @jhadina/jhadina-web type-check`
- Check next-head GitHub Actions rather than reusing an earlier green main receipt.
- When SWLC is restored: two different authenticated users, each importing/searching; verify isolation even after switching browser accounts.
- Admit one separately verified owned/licensed HTTPS audio asset and test play/pause/seek/next/navigation/reload with current production deployment commit.
- Confirm physical iPhone background and output routing separately.

## Next tranche

`MUSIC-STREAM.FIX.05–.09`:
- proper shuffle history and repeat, semantic artist/album search, queuing of non-current tracks;
- authorized asset URL refresh and expiry handling;
- legitimate Spotify API OAuth/list sync without implying playback;
- Your Library, Recently Played, For You, playlists and offline admitted-media flow;
- user-scoped listening telemetry, opt-in preference memory, and cross-device resumes.
