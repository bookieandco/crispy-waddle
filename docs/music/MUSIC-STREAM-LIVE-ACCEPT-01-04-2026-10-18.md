# MUSIC-STREAM.LIVE.ACCEPT.01–.04 — live-preview acceptance and player handoff
Date: 2026-10-18
Branch: recover/music-stream-01-04-20261018. All operations remain on a private protected Vercel Preview.

## Live evidence before source repair
- Public YouTube search via the configured server-side Data API key: HTTP 200, 15 results with video IDs/titles/channels.
- Playlist `https://www.youtube.com/playlist?list=PLBCF2DAC6FFB574DE`: HTTP 200, 13 total playlist entries, **10 accessible video metadata entries**, zero next-page token.
- Spoofed host `youtube.com.evil.example` rejected: HTTP 400.
- No credential values were read or printed. Key is restricted to the Vercel Preview environment.
- Source commit before changes: `36a3886cd2fdb48ff91b2641e2af41bf702ddb8d`, GitHub 12/12 green.
- These prove provider metadata calls and route validation, **not** video embeddability or actual iPhone speaker playback.

## Repair
- Official YouTube video results gain explicit `Play` / `Stop` controls; selecting one mounts a visible, 16:9 official `youtube-nocookie.com` iframe, with a close action and original-video fallback.
- Disallow background audio extraction and autoplay; the user initiates video playback within the official YouTube player. Embedding may fail per video/platform policy.
- Coordinate audible output between local audio, Rare Finds video, and Discovery video: a shared media-focus signal pauses local audio, and a separate YouTube-player ownership event tears down the other YouTube iframe.
- Add mobile-size friendly playback/action layout and keyboard focus styles.
- Provider status now exposes only nonsecret boolean config flags: `publicSearchAvailable` and `oauthAvailable`. The UI correctly says public search is configured without misleading the user into connecting Google OAuth when it is not configured.
- Clarify playlist import button copies only the currently previewed (already retrieved) accessible results into the existing Safari-local Rare Finds shelf. Not a licensed audio import. No automatic full-playlist fetching, downloading, publishing or sync.

## Acceptance gates to close out
- Run GitHub exact-head web typecheck, music tests, launch/build and full PR workflows after committing changes.
- Deploy only a protected Vercel Preview at the exact passing SHA.
- Call `/api/music/youtube/status`, `/api/music/youtube/search?q=...`, `/api/music/youtube/playlist?url=...` through the authenticated deployment fetch path. Check response statuses, relevant result shapes and safety of bad URL.
- Confirm private page HTML via authenticated provider fetch, stable branch alias points to the exact READY deploy, and fetch a new scoped temporary share URL for iPhone.
- **Still requires physical user iPhone**: tap Search, open the iframe, tap Play inside the player, toggle local audio, save Rare Finds, switch tabs, and verify Safari storage and video restrictions.
- Google OAuth remains disconnected, cross-device cloud sync remains uncommissioned; no Supabase migrations/production operations.
