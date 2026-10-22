# Jhadina Social — provider connections and SuperFeed public reader
Date: 2026-10-21
Source branch: `feat/social-provider-connections-superfeed-20261021`
Parent: draft #1442, itself stacked on release-gated draft #1440.
**No production deployment or database modification has occurred.**

## Source reference
- https://github.com/lonekorean/super-feed (2017 MIT, Copyright Will Boyd).
- Adapted *idea* only: per-provider modules, merged feed, source fairness and
  limited consecutive cards. Clean TypeScript implementation in Social Core,
  not a copied ASP.NET singleton, thread loop or an imported 2017 SDK.
- Its supported Blogger, CodePen, Dribbble, Flickr, GitHub, Instagram,
  Last.fm, Twitter, WordPress modules should **not** be treated as
  present-day API authentication capability. Legacy Instagram v1 token
  instructions and X/Twitter API integrations are not used.

## Implemented (source-only)

`packages/social-core/src/super-feed.ts`: canonical source IDs,
hard-allowlisted URI generation, deterministic merge/dedupe, bounded source
diversity (two picks per source, two consecutive maximum) and provenance.
Tests include malformed IDs, source balance and duplicate exclusion.

`apps/jhadina-web/src/lib/social/public-feed-transport.ts`: real read-only
public RSS/Atom fetch for only:
1. GitHub public user activity `https://github.com/{login}.atom`.
2. YouTube public channel videos `https://www.youtube.com/feeds/videos.xml?channel_id={UC...}`.
3. WordPress.com public blog `https://{subdomain}.wordpress.com/feed/`.

Requests never use user-supplied arbitrary URLs, credentials or OAuth tokens.
They reject redirects, cap payloads at 256 KB, timeout after five seconds,
strip untrusted markup, retain only HTTPS entry links and are explicitly not
stored as authoritative Social observations. Upstream feeds may be unavailable
or rate-limited. No social scraping, write, likes, follows, comments or DMs.

`GET /api/social/feed/preview`: signed-in owner required; accepts one to
four repeated `source={provider}:{id}` values. Validates every identifier
before fetching, then returns up to 24 fair-mixed items. No DB writes and
no persisted feed subscription.

`GET /api/social/connections/catalog`: signed-in provider capability
overview preserving existing Hootsuite/Ayrshare account bindings and their
status. Clearly distinguishes configured provider secrets, registered
profiles, and live-delivery evidence (not proven). A sealed YouTube browser
cookie is `browser_credential_present_unverified`, NEVER proof of a
connected/validated Social profile. Facebook/Instagram/TikTok/X/LinkedIn/
Threads direct OAuth entries remain `official_oauth_not_configured`, not
links to fake logins.

`/social/connections`: iPhone portrait provider cockpit, editable temporary
source list, preview/review cards, explicit OAuth setup states and owner-click
YouTube read-only consent when Google credentials exist. Linked from canonical
`/social` so no duplicate Social system or new publication executor.

`/api/auth/youtube/start` + `callback`: reuse existing
`youtube.readonly` OAuth integration, now requires a signed-in Jhadina
owner both before redirect and before code exchange and binds the short-lived
CSRF state to that owner. Existing httpOnly encrypted token cookies stay as
before. OAuth is only initiated when the user clicks authorize. This does
not enable YouTube publishing or a personal Instagram/TikTok feed.

## Known blockers

- Existing direct Social binding/grant/outbox hardening from #1440 remains
  **draft/unmerged/unapplied**. No platform account may be marked
  publication-ready until permissions, owner binding and exact scopes pass
  real service-role/OIDC and two-owner isolation tests.
- Production app is still `main`; this branch has not been deployed.
- YouTube Google client ID/secret and encryption secret are configured
  via existing server-only settings, not checked or exposed here. Live OAuth
  requires operator-owned Google consent-screen/redirect configuration;
  success on a real iPhone is not certified.
- Direct Facebook/Instagram requires official Meta developer app,
  professional Instagram account where relevant, requested scopes and
  owner consent. TikTok, X and LinkedIn require their own sanctioned
  developer API/OAuth permissions, not legacy super-feed credentials.
- Persistent feed subscriptions and private-feed refresh tokens require
  an owner-scoped durable store, token encryption/refresh, explicit grants
  and RLS before activation. No token is written to Supabase in this PR.
- News feeds are external, public and untrusted, never automatically
  inserted into Jhadina Memory or used as approval evidence.

## Test/release gates

- Verify Social Core package tests, public XML/size/fetch tests, owner
  session and source validation, connection status/secret redaction and
  YouTube CSRF/owner-switch denial.
- Verify exact-head Social/Growth web type-check, global Next build and
  PR CI. Then separate owner iPhone acceptance using a deployed review
  build **only after explicit authorization**.
- Do not merge/deploy or add OAuth credentials, request consent, connect a
  platform, publish, send messages, spend or subscribe automatically.

**Next:** complete official Meta and TikTok consent-bound adapters with
encrypted owner-scoped token storage once production DB authority release
gates are satisfied, then add durable feed subscriptions and scheduled
read-only polling. No private API shortcuts.
