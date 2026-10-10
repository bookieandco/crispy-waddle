# MUSIC-STREAM.DEVICE.10–.15 — Runtime streaming and native handoff
**Stacked:** PR #1195 → PR #1196 → this device branch. Do not merge out of order.

## Implemented and source-verifiable
- **.10** Playback ticket validation: owner, explicitly authorized media asset/source, URL protocol, local/loopback denial, signed-URL expiry, signature-without-expiry denial, fresh server re-resolution.
- **.11** Audio source lifecycle: Music UI sends only track identity; persistent shell fetches fresh authenticated tickets. Media errors trigger controlled refresh, not indefinite retry; expiresAt triggers renewal checks; no signed playback URIs in browser storage. Owned files with vetted `music-owned/<userId>/...` Storage provenance may receive a fresh 180-second signed URL through authenticated Supabase Storage RLS; this requires a real existing bucket and matching object/policy.
- **.12–.13** Rights-reviewed podcast/internet-radio *admission contracts* reuse the Music repository; catalog UI displays only previously admitted entries. Stream bytes are never fetched on the server, stored as "offline", or downloaded. Publisher evidence is provided by an operator, **not automatically verified by code**. No public import endpoint is exposed.
- **.14** Native iOS `JhadinaAudioPlaybackController.swift` provides standalone AVPlayer session configuration, AirPlay/Bluetooth-capable output options, lock-screen play/pause and URL expiry validation. The current Xcode target is **JhadinaSafety**, and the native Music controller is **not integrated into an app target**; physical/background certification is required.
- **.15** Owner-scoped cross-device checkpoints via `/api/music/checkpoint`; browser saves paused/resumable positions and can restore a paused remote checkpoint. Migration `packages/music-core/sql/002_music_playback_checkpoints.sql` supplies auth.uid() tenant RLS. It has **not been applied to SWLC**.

## Deliberate release exclusions
1. Production Supabase recovery, migration execution, 2-user RLS tests, authorized HTTPS audio bytes, expired signed URL reissuance by storage/provider, background streaming and real iPhone/AirPlay controls are NOT certified.
2. A metadata-only Spotify/YouTube OAuth connection grants no audio streaming or downloads. True account OAuth token exchange/refresh, scopes audit, first-party playback SDK compliance and platform entitlements need separate provider work.
3. RSS/Podcast feed discovery, parsing and verification are not built here. Only explicitly admitted podcast episodes enter the existing music catalog; do not call this an RSS subscription feature.
4. AM/FM radio tuning without device-specific receiver hardware and licensing is not implemented. Internet radio only.
5. **Owned Supabase Storage re-signing is code-complete only** for vetted `music-owned` objects and still needs live bucket/RLS/bytes tests. Third-party provider token refresh/re-signing remains unimplemented; no provider credentials or protected stream extraction.
6. Native Swift file has not been compiled in Xcode or wired to an entitled iOS Music host. Web persistent player is App Router scoped; Pages Router TV cross-domain continuity remains separate.
7. Checkpoint writes are ordinary resume positions, not independently verified listening streams or royalty proof.

## Admission / test plan
- Exact PR-head `pnpm --filter @jhadina/music-core test`, `pnpm --filter @jhadina/music-core type-check` and web test/type-check/build.
- Review and then apply only the additive checkpoint migration with production credentials once SWLC is recovered; prove authenticated, anonymous, and cross-user RLS denies.
- Commission the private `music-owned` bucket under authenticated RLS, seed one genuinely owned file with verified object provenance, then run play/pause/seek/next, actual 180-second ticket renewal and revoked-source scenarios in a deployed build.
- On physical iPhone, test lock screen/background, AirPlay/Bluetooth/car route changes, AVAudioSession interruption handling and app termination. Record actual receipts.
- Keep source-only PR in draft until the above production gates are satisfied.

## Follow-on coding priorities
`MUSIC-LIVE.16–.20`: third-party provider-specific media ticket refresh, verified podcast RSS/Atom ingress, curated radio directory and operator rights validation, native Music app host integration, browser/TV focus arbitration, offline rights expiry/revocation lifecycle.
