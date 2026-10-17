# JTV-LIVE.ACCEPT.01–.05 — Evidence ledger (2026-10-16)

**PR:** https://github.com/bookieandco/crispy-waddle/pull/1329
**Parent `main` exact SHA:** `2df9aed86772265508d81580f6ceb34e73bc0bdd`
**Status:** Repository acceptance implemented / external acceptance NOT ADMITTED. Do not merge or deploy solely on this ledger.

## .01 — Current-code CI
- Verified 10/10 successful GitHub workflow results on `08661b205f38eaf7cce31f6ea9641d74b2ef1a58` including JhadinaTV, Media Production, filtered web production build and Launch Gate.
- Additional safety tests added on this PR after that SHA. The release must use *the latest branch exact SHA*, not the earlier successful run; record new CI results before considering code accepted.
- Do not conflate build green with authorized playback.

## .02 — Supabase owner storage and two-user isolation
- Target Supabase project `kqbkaozfjubkjevdfvic` (Swlc, ca-central-1), control-plane `ACTIVE_HEALTHY`.
- Direct `list_tables` and `list_migrations` FAILED: PostgreSQL FATAL 57P03, not accepting connections; hot standby mode disabled.
- PostgreSQL log contains 'redo in progress' and repeated 'not accepting connections' on 2026-10-16/17 UTC. Schema presence cannot be inferred.
- **No migration applied.** Do not run migrations, restart database, change Auth, or declare RLS ready while DB recovering.
- On recovery: compare existing tables and migrations, audit SQL in `supabase/migrations/20261016213000_jhadinatv_owner_consumer_state.sql`, apply once if absent, run security/performance advisors.
- Actual two distinct authenticated test users (non-owner and owner): confirm read isolation, insert/update/delete and RPC ownership, stale timestamp rejection, durable two-device resume. No service-role bypass. Archive anonymized result receipts.

## .03 — Provider/license and deployment admission
- Vercel project `crispy-waddle-jhadina-web`, id `prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco`.
- Environment list read with `decrypt=false` returned **zero visible TV keys** prefixed `JHADINA_TV_`, and `hiddenProductionEnvCount=0`; cannot infer real Jellyfin credentials or owner identity.
- Required deployment inputs: verified owner Supabase Auth UUID, 32+ byte stream-signing secret, HTTPS Jellyfin URL, API key/user ID, authenticated playback right, verifiable media-right evidence, trusted public origin.
- Owner-only `/api/jhadinatv/live/status` should reject when missing; do not invent credentials, licenses or public re-stream rights.
- A successful environment-variable count cannot itself certify genuine broadcaster licensing.

## .04 — Real playback and device acceptance
- Repository tests prove signed-token denial, item/territory/casting checks, browser-only session, HLS path/cross-origin refusal, and now fail-closed discovery for unsupported Google Cast media and AirPlay connection confirmation.
- **No physical iPhone, TV, Chromecast, AirPlay receiver, WSS Jhadina receiver, or permitted live broadcaster receipt.**
- Real acceptance requires physical iPhone Safari, tap-to-play audio, HLS live/VOD/seek/reconnect, one-hour token expiry/renewal, title→episode mapping, subtitles, PiP, AirPlay and Google Cast connection/state/disconnect.
- Cast is deliberately disabled for opaque Jellyfin proxy URLs with unknown MIME. Do not bypass capability checks to make a button appear.
- Custom JhadinaTV pairing remains disabled until separately audited receiver/signature/replay-cache implementation.

## .05 — Exact-head deployment and promotion
- Latest observed READY production target was `2df9aed86772265508d81580f6ceb34e73bc0bdd`, **not** the JTV repair PR head.
- Do not promote draft PR or claim live acceptance without .01–.04 receipts. Production target is retained.
- Once accepted, stage a reviewed production build, verify SHA match, owner/non-owner admission, real playing stream and rollback candidate, and only then promote that tested build.
- Never incur paid plans, deploy host infrastructure, register media rights or expose tokens without explicit owner authorization.

## Exit criteria
`JTV-LIVE.ACCEPT.READY` requires: all exact-head CI success; database read/write reachable and real two-user isolation pass; documented valid media rights, Jellyfin secrets loaded *only* into deployment; one real authorized movie and live channel playback; Safari physical playback and applicable casting; current-head Vercel deployment, logs and rollback receipt. At this audit snapshot it is **NOT READY**.
