# JH-UX2 Connected Feed: Audit, Permissions, and Handoff
Date: October 17, 2026.

## Implemented on draft branch
- Authenticated read-only YouTube Data API subscription lookup and bounded subscribed-channel activity sample. It does NOT replicate personalized YouTube Home.
- Owner-bound YouTube OAuth start, callback, Home read and Music authorization status. Old unbound sessions require reconnect.
- Home now has All updates / Social / Watch / Work views, with detailed platform selectors hidden behind a disclosure.
- Recorded timestamps sort genuine updates. Canonical Social observations, Money, Opportunities, TV and Growth are preserved; generic preset stories are separated as shortcuts.
- Visible source health, explicit connection entry points, accessible buttons, original actions, and no synthetic user posts.
- Three pure-function deterministic unit tests cover sorting, deduplication, platform filters and shortcuts.
- YouTube shortcut now points to the Home feed instead of Social publication editor.

## External platform connection truth
YouTube: consented youtube.readonly supports subscriptions and channel activity, not personalized recommendations.
Facebook: owned Pages/authorized Graph API and analytics; no arbitrary friend's Home timeline through a normal app.
Instagram: professional creator/business owned media and approved insights; consumer home feed not available through this integration.
TikTok: authorized creator's own public videos through Login Kit / Display API after developer approval, not For You.
Reddit: 2026 Data API requires approval and use restrictions; no bypass scraping.
Bluesky: public AppView plus authorized ATProto timeline; a priority free-first next connector.
Mastodon: public feeds or authorized home timeline; another free-first connector.
Threads, X, LinkedIn, Snapchat, Tumblr, VK: provider-specific permissions/tier review required; do not claim connected without verified access.

## Operator-only commissioning gates
1. Identify canonical Supabase and verify authenticated owner/RLS; Social publisher registration is not proof of working read access.
2. Configure Google OAuth client ID/secret, encryption key and exact redirect/app URL in selected Vercel environment, with secrets never exposed to browser or chat.
3. Use iPhone Safari signed in to Jhadina: consent to YouTube; check actual uploaded video sample, revoke/refresh/reconnect, cross-owner denial and provider quota/error behavior.
4. Build read-only Meta Pages / Instagram Professional adapter inside the canonical Social data plane after app approval. Keep Facebook data-download Personality import separate.
5. Add Bluesky and Mastodon read sources. TikTok, Reddit and other feeds require provider approval and authorized scopes; do not automatically scrape.
6. Run exact-head Web TypeScript, targeted Vitest, full Web tests and production build; validate mobile tap targets, modal focus, status wording, media mini-player continuity and authenticated preview.
7. Only merge after appropriate checks and review. No new Social authority, auto-publishing, ad spend, purchases or personal-memory admission.

## Follow-up coding sequence
JH-UX2.04 — Unified connection cards: source/account scopes, last sync, state, failure and reauthorize actions.
JH-UX2.05 — Durable owner-scoped ingestion, idempotency, cursor, backoff and explicit freshness, contingent on correct Supabase RLS.
JH-UX2.06 — Meta owned Page/IG read-only ingestion and normalization, not friends' home feeds.
JH-UX2.07 — Bluesky/Mastodon, then reviewed TikTok/Reddit.
JH-UX2.08 — User-selected ranking categories and explainable provenance with privacy controls; no automatic Personality learning.
JH-UX2.09–FINAL — iPhone acceptance, cross-router player continuity and deploy SHA/live canaries.

No OAuth authorization, provider reads as owner, Supabase migrations, publishing, trading, ad spend or production deployment occurred from this source-only draft.

## October 17 continuation: connection privacy and UI verification
- Added explicit Google OAuth configuration preflight: the app reports operator setup required rather than showing a broken connect flow when ID, secret, encryption key or callback origin are missing.
- OAuth is bound to current Jhadina identity throughout start/callback/status/Home. Previously unbound browser credentials are denied and need new owner consent.
- Callback explicitly clears the prior browser's \`/api\`-scoped refresh cookie before storing new consent, including when Google returns no refresh token.
- Added authenticated, same-origin browser-local YouTube disconnect. It removes owner, access, pending OAuth and refresh cookies; it does not revoke Google Account permissions.
- Distinguishes successful YouTube connection from actual feed health; failed subscribed-channel lookups do not fabricate posts or report all sources healthy.
- Platform filters list only observed/connected sources; the broader platform list is in Social → Connections, separated from publication administration.
- Regression coverage: owner-scope and no-provider-call on denial; OAuth CSRF state and owner mismatch; old refresh-token cleanup; upstream failures and no fabricated posts; authenticated disconnect and path-scoped cookie deletion; feed sorting/dedup.
- Remaining operator gates: Google app consent/test-user or verification eligibility, exact deployed callback URL, credentials configured in correct environment, authentic owner sign-in, real account OAuth, quota/refresh/revocation receipts, physical iPhone Safari acceptance. See current exact-head CI: do not inherit pass status from earlier commits.

**Critical limitation:** The Social account registry represents brand/publication profiles and observation/proposal records, not arbitrary followers' personal social feeds. No Meta/Reddit/TikTok read integration has been commissioned by this PR. The explicit connection inventory is a plan, not an API grant. No paid data provider is required to prove the YouTube slice.
