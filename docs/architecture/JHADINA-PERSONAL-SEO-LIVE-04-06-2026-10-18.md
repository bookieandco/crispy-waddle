# JH-PERSONAL-SEO.LIVE.04–.06 — source acceptance and operator gates

**Scope:** personal Jhadina Growth only; no Ryze competitor, paid account, publishing, SEO write, social post, or external campaign.

## LIVE.04 — Google Search Console authorization

- Owner-initiated `POST /api/growth/seo/oauth/start` checks Jhadina auth, same-origin POST, active owner Venture, and a server-registered site+GSC property.
- Generates 32-byte random state, S256 PKCE challenge, 10-minute authenticated encrypted HttpOnly state cookie, and a Google consent URL requesting **only** `webmasters.readonly`. The browser leaves the app only after the owner presses Connect.
- `GET /api/growth/seo/oauth/callback` checks same Jhadina identity and encrypted state, exchanges the code on Google's fixed host, rejects missing offline refresh or any Search Console write scope, verifies access to the exact registered Google property using the existing read-only GSC API adapter, then saves an encrypted HttpOnly owner+Venture refresh grant for up to 30 days.
- `POST /api/growth/seo` uses that encrypted grant on the owner's device; no browser-provided access token, site URL, GSC property, or consent status is treated as trusted.
- Existing *server-only* pre-provisioned GSC refresh token remains an alternative for trusted server flows. **The per-device grant does not authorize background workers or another owner.**
- Does not read existing YouTube Music tokens; only reuses the established server-side encryption helper and optionally the existing Google OAuth client credentials.

### Required owner/operator steps (not completed by source-only code)

1. Identify the actual owned production HTTPS website and its real Supabase Venture ID. The previously mentioned Cloudflare Workers **preview** must not be presumed to be the final owned domain, publicly indexable or eligible for Search Console ownership.
2. In Search Console, verify control of the exact website/domain and read-only API access. Configure Google's OAuth consent and the callback URL for the real, protected Jhadina deployment.
3. In private Vercel/runtime environment (not GitHub source), set `JHADINA_PERSONAL_SEO_SITES_JSON` with the verified owner user ID, Venture ID, website and corresponding `gscProperty`.
4. Configure `JHADINA_GSC_OAUTH_REDIRECT_URI` as `https://<real-jhadina-host>/api/growth/seo/oauth/callback`. Use existing private `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` if suitable or dedicated `JHADINA_GSC_OAUTH_CLIENT_ID`/`JHADINA_GSC_OAUTH_CLIENT_SECRET`. `JHADINA_OAUTH_ENCRYPTION_KEY` must be present and protected. Never paste keys/tokens in a PR, chat, client response or screenshot.
5. Owner explicitly presses **Connect Google Search Console**, reviews Google consent, then checks real property readback. No permission or connection was inferred from the code changes.

Google specification: https://developers.google.com/webmaster-tools/v1/how-tos/authorizing

## LIVE.05 — real read-only PupsonStuff audit

Implemented source flow: verified private Venture binding → bounded pinned-DNS HTTPS crawl honoring robots and sitemap → existing technical/link findings; separate fixed-host PageSpeed and first-party GSC analytics.

Before recording a real accepted scan, capture exact site host, signed-in owner, *provider or HTTP evidence*, successful robots read, partial page count, safe PageSpeed response, Search Console owned property, source timestamps and error budget. The results cannot be invented from source fixtures. A Cloudflare view-only preview may intentionally lack public indexing/robots/GSC property and therefore **fail closed** until the user owns a suitable site.

No real customer site scan, PageSpeed provider call or GSC consent has been commissioned in this branch. The unit tests are simulations. Do not claim real ranking improvement, Core Web Vitals field verification, sales or revenue.

## LIVE.06 — iPhone portrait acceptance

- `/growth/seo` includes owner-bound site chooser, SEO/links, mobile/desktop lab PageSpeed, Google Search Console connection, evidence notes, preview-only repairs and weekly history.
- Critical phone checks: portrait ~390px, iPhone Safari authentication, SSO/deployment protection, Google consent redirect and return, no horizontal overflow, API 401 without login, API 403 on cross-origin scan, no exposure of token in client/UI network response, and no CMS change or spend.
- Source UI/build certification is **not** a physical iPhone test. The actual protected preview URL and owner session must be validated before claiming phone acceptance.
- Vercel project previously observed `live:false`, SSO protected, so READY build status is not an independently usable protected mobile site.

## Release and commissioning truth

Recovery PR **#1407** tracks this work on the current-main reconciliation; supersedes unmerged original PR #1392. Even if source checks pass, keep release gated until the correct Jhadina deployment/environment, domain/owner property evidence, actual Google authorization and physical phone checks are verified. No automatic publishing, paid APIs or advertising activation.

### Operator acceptance checklist

- [ ] Exact-head GitHub Growth, Launch, UX and Web conformance checks green after latest OAuth commits
- [ ] Review security boundaries: PKCE, state, exact owner and site, single readonly scope, encrypted cookie, no browser token
- [ ] Owner-approved domain/Venture mapping exists in private runtime
- [ ] Google API client and exact redirect URI configured; consent completed
- [ ] First-party property verified by live Google response
- [ ] Real owner-site HTTP + PageSpeed snapshot captured and compared to source findings
- [ ] iPhone Safari portrait login/connection/scan smoke verified with receipts
- [ ] No site modification, public publishing, external outreach or money movement
