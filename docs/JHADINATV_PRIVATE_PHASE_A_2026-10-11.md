# JTV-PRIVATE.FINISH Phase A — single-owner operational handoff

Branch: `feat/jtv-private-phase-a-20261011`  
Security foundation: PR #1215 merged to main (`69d7b8e27aae43aaa323c091d13f5fbb5776c8c6`).

## Scope

**.01 Reconcile:** owner-only signed Jellyfin access, device pairing fail-closed and live status privacy were merged after ten checks passed.

**.02 Source classifications:** `PrivateAccessKind` separates owner-approved playlists, personal files and verified free streams from discovery-only, official-player and subscription links. These are viewing-access categories, not commercial distribution licenses or DRM circumvention.

**.03 Catalog cleanup:** remove fabricated titles tagged public-domain/licensed from the production server catalog. No default playable movie claim exists without Jellyfin.

**.04 M3U owner import:** explicit confirmation is required. Import accepts local pasted M3U only, stores max 500 unique HTTPS URLs per device, drops HTTP/credential-bearing and invalid entries, avoids server-side proxy/fetch of user-controlled URLs. Import does not independently establish legal rights or stream availability.

**.05 World discovery:** owner-only GET `/api/jhadinatv/world/channels` fetches fixed public metadata `https://iptv-org.github.io/api/channels.json`, filters country/search, excludes closed and NSFW, returns at most 80 entries with HTTPS broadcaster website links. It never returns stream URLs or auto-admits entries. Country/language/category filtering is implemented for imported channels.

**.06 XMLTV:** pasted guide stored in browser; matches by exact tvg-id, parses timezone-aware program dates, shows current program. Jellyfin existing EPG remains independently supported when commissioned.

**.07 iPhone web playback:** direct `<video playsInline controls>` for approved HTTPS sources, native HLS where supported, explicit tap-to-play with audio, retry/fullscreen, buffering/errors, native controls and responsive layout. Physical iPhone Safari test is still mandatory; the code does not guarantee any unknown source works.

## Storage and privacy

Imported channel URLs and XMLTV are saved **only in the current browser's localStorage**; this is not backed up or synced. Browsers sharing the same origin/profile can inspect localStorage. The app gates rendering and loading behind the verified JhadinaTV owner API, but the storage itself is not cryptographically tied to a login. Do not use on an untrusted shared browser. Phase B should migrate to user-scoped durable state/backup and handle clearing during sign-out.

## Current release blockers (AUDIT/REPAIR)

- `JHADINA_TV_OWNER_AUTH_USER_ID` must be set to the actual Supabase Auth owner UUID. Without it, status rejects access. No owner ID is guessed.
- Confirm one or more broadcaster sources genuinely permit private access. The importer only checks syntax/HTTPS; it cannot independently prove broadcaster permission, regional availability, codec compatibility, CORS, or EPG correctness.
- Test a real HTTPS native HLS stream and audio on physical iPhone Safari, including pauses, interruptions, fullscreen, reconnect and controls. Some official streams prohibit embedded players and must be opened on their official sites.
- Native Safari HLS is supported, but MPEG-DASH, DRM/EME, authenticated HLS segments, browser compatibility other than Safari, tokenized long-running playlists and server-side transcoding are NOT solved by this tranche.
- Jellyfin credentials, licensed personal-media catalogue, receiver/Chromecast, durable cross-device state, API provider availability and Homebase remain later milestones.
- Importing arbitrary third-party playlists must never make JhadinaTV a public relay. Provider-specific permissions still apply.
- Remote worldwide metadata depends on an upstream community dataset and may be temporarily unavailable. It is **not** authoritative broadcast licensing data.

## CI requirements

- TV Core tests/typecheck, including explicit owner approval, HTTPS validation, deduplication and XMLTV mapping.
- Jhadina Web Pages Router TypeScript and focused owner-only world API test.
- All existing JTV security and web checks.
- No claims of hardware, live-rights or playback certification without device/provider receipts.

## Next milestone

Phase B `JTV-PRIVATE.FINISH.08-.12`: personal Jellyfin playback, genuine movie/series catalog, episode hierarchy, watchlist and monotonic Continue Watching, true owner-scoped durable state.
