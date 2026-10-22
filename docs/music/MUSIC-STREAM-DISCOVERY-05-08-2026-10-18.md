# MUSIC-STREAM.DISCOVERY.05–.08 — source handoff

Date: 2026-10-18

## Results

- **.05:** Replace bearer-only YouTube cookie mismatch with an encrypted, owner-scoped JSON token; enforce short-lived OAuth CSRF state, exact callback-host verification, session ownership, refresh expiration and reconnect behavior. Legacy unscoped cookies are not trusted. Preview OAuth requires operator-configured exact callback origin; it is never silently sent to the production host.
- **.06:** Add `/api/music/youtube/search` using only the official YouTube Data API `search.list` endpoint, bounded 2–120-character user-submitted queries, a maximum 15 videos per call, validated video ID and thumbnail origin, provenance/rights labeling, per-instance rate guard and bounded short-lived results cache. **No auto-query, extractor or stream-URL resolution.**
- **.07:** Add `/api/music/youtube/playlist` via `playlistItems.list`, strict YouTube playlist URL admission, manual page-by-page preview (50 items/request), cursor validation, safe ID mapping and partial/deleted video exclusion. Owner chooses Save; no server catalog write or auto-import.
- **.08:** Add an iPhone-friendly `YouTubeDiscoveryPanel` on Music Search and Discover, optional provider authorization, bounded button-triggered search, visible thumbnail/results, original-video link and Select/Save to existing local Rare Finds. Local audio and YouTube results carry independent source labels and cannot accidentally turn remote links into local playable files. Bulk import caps at 250 saved links.

## Requirements to use real remote results

1. A configured, authorized `YOUTUBE_DATA_API_KEY` (or `GOOGLE_YOUTUBE_API_KEY`) in the project's *server environment* **or** user-approved Google/YouTube OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JHADINA_OAUTH_ENCRYPTION_KEY`, `YOUTUBE_REDIRECT_URI`).
2. OAuth redirection must have an explicitly approved exact allowed origin for this preview. If mismatched, /api/auth/youtube/start fails closed.
3. Vercel preview authentication remains enforced for the exact `/music/local` page and the scoped YouTube API GET endpoints. In production, Supabase account auth is required. Remote quota restrictions and Google verification are operator/external gates.
4. SWLC Supabase recovery is **not** prerequisite for private browser-local bookmarks, but remains required for production cloud music sync.

## Evidence boundaries

- Unit/source tests and CI are code evidence, **not** production provider credentials, authorized account consent, real YouTube responses or iPhone e2e.
- YouTube Music's private upload collection is not exposed through standard YouTube Data API search, and not a licensed streaming source. Playlist items may be unavailable/private/not embeddable; show accessible metadata only.
- No downloading via spotDL, no reuse of GPL SimpMusic source, no youtube-dl/yt-dlp, no hidden playback, no ads blocked, no Supabase migrations, no billing, no public release, no production merge.
- API rate guard/cache is **per instance**, not a distributed quota counter. Leave quota budget and alerts for production ops; UI requires deliberate user actions.
- YouTube results metadata is transient; only user-selected bookmarks live in the current browser, and owner may need to refresh stale catalog metadata.

## Acceptance

1. Ensure latest commit exact-head web type-check, tests, lint and build pass, and Vercel private preview READY.
2. On an authorized preview, type a query and press Search; confirm real video ID, source, and author, and save results into Rare Finds after navigation.
3. Paste a permitted YouTube playlist and page manually; verify dedupe, Save all (up to shelf capacity) and visible iframe.
4. Test invalid URLs/playlist cursors, expired OAuth, wrong-owner sessions, request rate-limit and provider quota errors.
5. Verify browser local file playback works unchanged; production/auth boundaries and no unauthorized downloads remain intact.
