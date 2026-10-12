# JhadinaTV JTV-RECONCILE.01–.03: source and admission handoff

Date: 2026-10-11
Branch: `feat/jtv-reconcile-01-03-20261011`
Base: `main` at `b4209c5bd6ff62a88af87a514725eae4f5ecf8a2`
Status: **SOURCE CHANGES / LIVE COMMISSIONING NOT VERIFIED**

## .01 — Cross-PR reconciliation

- Existing core chain already on main: #224 (intelligence), #250 (playback gate),
  #251 (rights matrix), #252 (JTV-26–31), #726 (Live TV/Jellyfin/EPG),
  #729 (public Auth bootstrap), #731 (admission tests).
- The abandoned #150 Live TV branch was forward-ported in #726. **Do not merge #150**.
- `packages/jhadina-tv-core` is canonical; `apps/jhadina-web` owns web routes.
- A READY Vercel web deployment does **not** prove licensed TV playback or device transfer.
- Open media-progress PR #205 and other music changes require independent review; this
  TV repair does not merge them or invent Supabase persistence.

## .02 — Owner and media-stream admission repair

1. Require authenticated Supabase `auth.getUser()` identity to match the explicit
   `JHADINA_TV_OWNER_AUTH_USER_ID` for source issuance and local streaming.
2. Check each Jellyfin item/channel against the configured Jellyfin user, not merely
   a syntactically valid media ID or an HTTP/HTTPS URL.
3. Enforce scoped playback and casting rights before URLs are issued.
4. Issue HMAC-SHA256-signed, asset-, mode-, audience-, rights-evidence-, owner-,
   territory- and expiry-bound stream capabilities using a server-only key.
5. Return a separate `castUrl` only if `casting` is independently authorized.
   Browser playback uses the local capability; cast transports use the cast capability.
6. Validate signed capability, current provider rights, territory and exact Jellyfin
   asset **again** in the stream endpoint before sending provider credentials upstream.
7. Disallow cross-origin media templates and HTTP redirects. Preserve Jellyfin URL
   subpaths, forward byte ranges, never log or expose the Jellyfin API key.
8. The signed stream endpoint bypasses the *middleware login redirect only* because
   a receiver has no browser cookie; it retains its own mandatory admission gate.
9. `JHADINA_TV_STREAM_SIGNING_SECRET` and owner Auth ID are external deploy inputs.
   Until supplied, playback fails closed; no secrets are in the repository.

**Bearer URL limitations:** A cast URL is deliberately bearer-authenticated so a TV
can request it without a browser cookie. Possession grants media access until expiry,
subject to the proxy's current provider-right and asset checks. Protect it as secret
metadata, do not place it in logs or referrers, and rotate keys after compromise.
Current default capability duration is one hour. Long playback/seek, HLS segment
rewrites, refresh, reconnect and signed URL delivery through protected Vercel domains
still need real-player acceptance and may need further work.

**Provider licensing:** configured rights-evidence IDs are not independent proof of
a media license. Human/legal verification of the evidence remains mandatory.

## .03 — Receiver control (safe default)

- Receiver discovery is owner-authenticated and empty unless
  `JHADINA_TV_RECEIVER_PAIRING_VERIFIED=true` is explicitly configured.
- A 32+ byte `JHADINA_TV_RECEIVER_SIGNING_SECRET`, allowlisted receiver ID and
  strict WSS endpoint are required for a listed receiver.
- Discovery issues owner-bound, receiver-bound, one-minute signing tokens with random
  nonce. The TV must verify signatures, expiration, audience and identity **and keep a
  nonce replay cache** before acknowledging a pairing request.
- Browser code requires a matching `authenticated` acknowledgement before it sends
  a cast-scoped `load` or media-control command; missing/malformed/timeout fails closed.
- No JhadinaTV receiver server implementation or hardware pairing certificate is
  claimed. Keep `PAIRING_VERIFIED=false` until a concrete trusted WSS receiver exists
  and has been audited for signature verification, replay protection, URL handling,
  session binding and disconnect behavior.
- Native AirPlay and Google Cast still require on-device acceptance; this tranche
  does not assert that their SDK/receiver paths work.

## Test gates

JhadinaTV PR workflow must now run:
- core tests and type check
- web type check
- stream signing, expiration and tampering tests
- Jellyfin exact-item entitlement tests
- receiver identity/time/replay-preparation tests
- source issuance API denial and local/cast scope tests
- proxy denial on absent token, mismatched asset, revoked cast rights,
  changed territory, absent owner session and missing key

**Do not merge on red CI.** Repository tests use synthetic/mocked data, not a real
Jellyfin server, license, TV receiver or authenticated browser/device.

## External production acceptance (still pending)

1. Configure owner UUID, secret signing keys, HTTPS provider URL and genuine
   Jellyfin credentials in trusted deployment settings (never chat/source control).
2. Verify legally authorized item/Live TV rights and current rights evidence.
3. Run signed-in/second-user isolation, expired/tampered capability and logged-out
   tests using the actual current deployment.
4. Prove GET, HEAD, Range and full video seek on a real playable VOD source.
5. Prove Live TV playback and EPG, including HLS playlists/segment routing.
6. Prove real iPhone Safari PiP/AirPlay and Google Cast device state/seek/disconnect.
7. Commission a WSS TV receiver; prove signature/nonce verification and handoff
   before enabling the pairing flag.
8. Capture CI commit SHA, Vercel deployment SHA, owner/device testing receipts
   and rollback plan. No production readiness claim until all gates pass.

## Next coding target

`JTV-RECONCILE.04–.06` — canonical series/season/episode UI and provider mapping,
user-scoped durable Continue Watching/watchlist (with monotonic persistence and
two-user isolation), persistent global player and full discovery UX. Keep Supabase-
dependent commissioning marked AUDIT/REPAIR if data storage remains unavailable.
