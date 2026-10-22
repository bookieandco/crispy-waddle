# JTV-LIVE.ACCEPT.01 → .05 — private live acceptance ledger
Date: October 21, 2026 (America/Los_Angeles)
Repo: bookieandco/crispy-waddle
Source of truth: PR #1459, existing JhadinaTV package/pages, Supabase canonical project kqbkaozfjubkjevdfvic; external acceptance issue #1335.

## Readiness semantics
- **PASS / verified:** direct SQL, current exact-head GitHub checks, a server-only owner config key, and specific local/static tests with reproducible receipts.
- **PREPARED / unverified:** a code pathway exists but owner authenticated device session, REST canary, licensed media, or hardware evidence has not happened.
- **BLOCKED:** a required provider, tester identity, signed source, device or authorized business decision does not exist.
- Never map a successful build, an HTTP 200 readiness JSON, Vercel READY or an Apple **sample VOD** to a licensed Live TV or real-device **PASS**.
- Keep `liveCertified = false` and preserve owner-only restrictions until evidence-based acceptance is complete.

## .01 — real owner login, iPhone portrait/navigation
**Prepared in source.** Existing personal-owner email-link/login/passkey routes and `requireJtvOwner` verified in offline tests; Vercel sensitive `JHADINA_TV_OWNER_AUTH_USER_ID` configured for production/preview, exact value never copied to files.

Changes: TV home nav wraps at 320–430px, native touch navigation targets >=44px, search box wraps below nav without horizontal overflow. Read-only owner-authenticated `/api/jhadinatv/postmerge` readiness display shows verified owner + storage, distinguishes Jellyfin absent from private owner failure, links to `/login?next=%2Fjhadinatv` on failure.

**Still required:** Human open the *exact deployed commit URL* on physical iPhone Safari, sign in with the actual owner, complete Face ID/passkey if enabled, then tap Home → TV → Live/Movies/Series. Check accessibility and that other accounts are denied. This chat cannot create or borrow a browser session or assert Face ID outcome.

## .02 — live owner storage / cross-account isolation
**Verified DB repair, pending JWT canary.** The two existing live migrations have been applied:
- `20261022050023_jhadinatv_owner_consumer_state`
- `20261022050646_jhadinatv_checkpoint_anon_rpc_grant_repair`

The live tables have RLS; policy SELECT/INSERT/UPDATE/DELETE predicates use `auth.uid() = user_id`; direct anonymous DML and RPC EXECUTE denied, authenticated table privileges/RPC execute available. RPC is `SECURITY INVOKER`.

**Still required:** Use `scripts/jtv-postmerge-rls-canary.mjs` on the canonical project with **two real dedicated test sessions** and explicitly gated `JTV_CANARY_ALLOW_WRITES=YES` and `JTV_CANARY_TEST_USERS_ONLY=YES`. Confirm cross-account isolation, monotonic resume, and canary fixture cleanup. Do not request or store a real owner's JWT in a chat, PR, or build artifact. Offline canary tests are not interchangeable with real JWT tests.

## .03 — authorized media and independent device diagnostic
**Blocked for real TV.** `JHADINA_TV_JELLYFIN_*`, `JHADINA_TV_STREAM_SIGNING_SECRET` and independently verified viewing/casting rights evidence are absent from known Vercel environment. No new source, subscription or commercial rights claimed.

An optional **Apple Developer HLS BipBop sample** button on `/jhadinatv/live` provides an explicit, user-initiated, owner-only **test VOD**, kept outside imported channel localStorage and the private media catalog. It tests native iPhone Safari playback with audio. Success would show the video stack works for a public developer sample; it would **not** verify any channel entitlement, EPG, live broadcast, signed proxy, rights to cast third-party content, or continuous-stream renewal.

**Still required:** Owner-supplied permitted HTTPS M3U source or a privately configured authorized Jellyfin user, catalog item, rights, evidence, secure HTTPS host and signing key. Show one actual authorized movie and one permitted live channel on-device.

## .04 — playback reliability, live stream renewal and casting
**Prepared; physical test blocked.** Existing core includes signed-local/cast capability separation, bounded HLS manifest and segment proxy, stream expiry/renewal handling, playback interruption recovery, picture-in-picture, AirPlay, Google Cast and owner-approved custom receiver controllers. A new native iOS `webkitEnterFullscreen` fallback supplements standard fullscreen. Live player controls have 44px targets.

**Still required:** On the physical iPhone, check play with sound, pause/resume, HLS buffering/errors, VOD seek, retry, native fullscreen, PiP/captions (only where supported), background and foreground, 60+ minute expiry refresh, explicit AirPlay/Chromecast hardware pairing and receiver disconnect. No hardware or 60-minute test can be asserted from static CI.

## .05 — production/private deployment and rollback
**Source acceptance underway; no private live release certified.** Recovery PR #1459 originally passed all 10 exact-head workflows at `c70566529e1ca3bdb03d410c3f6521b1b8711c60`. New acceptance commits must pass on their **new exact SHA**. Keep `main` and Vercel's production alias unmodified until review gates are complete.

Read-only environment check: owner UUID is a sensitive Vercel value; provider secrets absent. Do not assume a PR CI build creates a hosted preview; verify deployment ID, READY, exact sha, host protection, application owner sign-in, and real stream separately. No protection bypass or public release should be introduced to make a test pass.

Before release: preserve prior production deployment ID/SHA, verify readiness endpoint owner-only, compile all test evidence, confirm target site access is private, then separately authorize promotion. If any gate fails, preserve safe prior release and link failures to issue #1335.

## Concrete receipts still needed
1. Physical iPhone Safari and owner email link/passkey session, exact URL and commit receipt (no cookies/JWT/passwords).
2. Two actual TEST-account Supabase Auth REST RLS canary with redacted pass/fail and fixture cleanup.
3. Successful Apple HLS demo playback (diagnostic only; does **not** fulfill licensed-media acceptance).
4. Real authorized movie and live-channel HLS segments, 60-minute renewal, and hardware cast/receiver proof.
5. Private deployment exact-head and fallback SHA receipts.

**Current certification:** `NOT_LIVE_CERTIFIED`. All source fixes, static security and CI evidence remain distinct from the missing physical and provider proof.
