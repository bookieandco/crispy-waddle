# ADS-CONNECT.LIVE.01–.05 — Source closeout and controlled real-world authorization

Date: 2026-10-17

## Canonical reconciliation
- Builds on merged PR #1353 and PR #1357. Base `main` SHA: `8e4509e0312001a79ac4b387a9663be67334abdf`.
- Preserve Growth Production approval receipts, Security/Action Core and Social Core. This sequence does not duplicate account registries or campaign dispatch and never creates ads.
- Current Vercel Jhadina project: production for #1357 reported READY; its environment listing had no `JHADINA_ADS_OWNER_USER_ID`, `MARKIFACT_MCP_ACCESS_TOKEN`, Etsy key/shop, Reddit Ads account OAuth, or spend ceiling credentials. Configuring the app is an operator action, **not** something ChatGPT's separate Markifact connection accomplishes.
- Current SWLC Supabase project `kqbkaozfjubkjevdfvic`: SQL still fails with `57P03`. Canonical issues #1110, #1340 and ADS-CONNECT issue #1358. No migration, backup claims, or database writes here.

## Changes by target
1. **LIVE.01 — Owner-bound authorization**: reuse `createRequestIdentityVerifier` and exact `JHADINA_ADS_OWNER_USER_ID` comparison before any OAuth initiate/status/callback; 401 anonymous, 403 foreign owner, 503 not configured. No roles from editable user metadata.
2. **LIVE.02 — Meta**: expose the already canonical owner-only Markifact **operation-schema** capability check on the Ads Connect mobile page. It does **not** prove account binding, new token creation, or authorize writing. Reconcile the already PAUSED Meta test campaign before any new canary.
3. **LIVE.03 — Etsy**: owner-clicked OAuth 2.0 authorization with required S256 PKCE and state, `shops_r` only. Server exchanges the code, inspects granted scope, reads public `getShopByOwnerUserId` using the authenticated numeric owner prefix, requires exact configured shop ID and user ID, then **discards tokens**; no seller listing changes or permanent token storage.
4. **LIVE.04 — Reddit Ads**: owner-clicked Reddit Ads OAuth (NOT Devvit), exact registered HTTPS redirect, `adsread` only, temporary access, server-side client secret, immediate exact-account `GET /api/v3/ad_accounts/:id` and discarded access token; **no** `adsedit`, `adsconversions`, or ad writes.
5. **LIVE.05 — Real iPhone acceptance prep**: iPhone-size controls, explicit "Authorize read access" buttons, capability/probe/error states, no redirects to untrusted domains, and a nonpersisted result label. Real owner iPhone testing is still a **required external acceptance** and may be blocked by Vercel deployment protection and SWLC auth.

## Security boundaries
- Pending cookie is AES-256-GCM encrypted, HttpOnly, SameSite=Lax, host-only, HTTPS Secure, path-scoped to `/api/growth/providers/oauth`, expires within 10 minutes, contains only random state/PKCE/verifier and exact signed-in owner ID. Requires `ADS_OAUTH_SESSION_SECRET` (random, >=32 chars).
- Callback validates signed-in owner, encrypted cookie, state, expiry, exact configured callback, provider scope, exact Reddit ad account / Etsy seller shop. Clears cookie on all results.
- Callback never stores provider tokens; it sends only generic success/denial/failure in browser URL without auth code or account identifiers. A successful "verified-temporary" is not a durable connection and never changes launch certification.
- Domain of redirect destination is independently checked by client code; all token POSTs and account GETs use pinned official endpoints with `redirect:"error"`.
- Do not request `adsedit` or Etsy write scopes and do not attach payment methods, spend or activate ads. Browser never receives client secrets or access/refresh tokens.
- With an unavailable database, ephemeral cookie replay prevention relies on 10-minute expiry and single-use provider authorization codes; this is NOT a certified distributed durable nonce ledger. Fail-close production connection claims until persistence is recovered.

## Required secure configuration (no values in repository or chat)
- Exact signed-in owner Supabase UUID: `JHADINA_ADS_OWNER_USER_ID`.
- Random server-only `ADS_OAUTH_SESSION_SECRET`.
- Meta: `MARKIFACT_MCP_ACCESS_TOKEN` (dedicated Jhadina credential, distinct from ChatGPT integration).
- Etsy: `ETSY_API_KEY` in `keystring:shared_secret` format, `ETSY_SHOP_ID`, and exact `ETSY_OAUTH_REDIRECT_URI=https://<canonical-Jhadina-host>/api/growth/providers/oauth/callback`. Etsy's OAuth client_id is derived from keystring.
- Reddit: `REDDIT_ADS_CLIENT_ID`, `REDDIT_ADS_CLIENT_SECRET`, `REDDIT_ADS_ACCOUNT_ID`, and exact `REDDIT_ADS_REDIRECT_URI` for same callback. Use the Reddit Ads application, not community Devvit.
- All runtime environment variables remain server-only; no `NEXT_PUBLIC_` prefix.
- A provider credential, API-key registration, browser approval, or source CI pass is not evidence of active/publishable/spend-enabled campaigns.

## iPhone commissioning acceptance — NOT performed by source CI
1. With approved owner session, reach `/growth/ads/connect` in portrait orientation. Check protected owner status, confirm page scroll/no overlap.
2. Check anonymous 401, nonowner 403, absent owner 503 for OAuth/status/read routes. Verify callback rejects absent/tampered cookie, wrong state, expired state, foreign owner and refused consent.
3. Set registered provider callback URLs exactly, authorize only read scope on the owner device, verify one-time account/shop match. Browser should display temporary verification, not "connected".
4. Check Meta page and already-paused campaign separately through Markifact live provider, then reconcile with canonical Growth receipt after SWLC RLS recovery.
5. Prove SWLC migrations/RLS with owner A, owner B and anonymous, device session, immutable approval receipts and budget ceiling, real tracking assets.
6. Only after all gates, return for an independent request explicitly authorizing a paused canary (or later ad activation/spend). No automatic payments or user outreach.

## Official references
- Etsy Open API OAuth/PKCE: https://developers.etsy.com/documentation/essentials/authentication/
- Etsy Open API getShopByOwnerUserId: https://developers.etsy.com/documentation/reference/
- Reddit Ads authorize/token: https://ads-api.reddit.com/docs/v3/authenticate-your-developer-application
- Reddit Ads account read: https://ads-api.reddit.com/docs/v3/api/get-ad-account
- Reddit Devvit separate community API: https://developers.reddit.com/docs/capabilities/server/reddit-api
- Etsy Dev MCP docs only: https://developers.etsy.com/documentation/mcp_server/devmcpserver

**Status: SOURCE IMPLEMENTATION, NOT LIVE CONNECTED, NO FUNDS, NO ADS, NO CONTENT WRITES.**
