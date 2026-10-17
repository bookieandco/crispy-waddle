# ADS-CONNECT.05–.11 — Etsy, Meta, Reddit Ads source-and-provider handoff
Date: 2026-10-17

## Baseline and verification
- Canonical repo: `bookieandco/crispy-waddle`.
- PR #1353 (ADS-CONNECT.01–.04) passed all nine exact-head GitHub checks and was merged to `main` with merge SHA `5d2f8ed87265157536495a7164cefcb6c5b68ea0`. Branch for current changes derives from that exact main commit.
- The existing Jhadina Vercel project had **none** of `MARKIFACT_MCP_ACCESS_TOKEN`, `JHADINA_ADS_OWNER_USER_ID`, the Growth spend ceilings, `ETSY_API_KEY`, or Reddit Ads credentials at the audit. Do not equate a ChatGPT Markifact integration with a server-side Jhadina secret.
- ChatGPT's separately authorized Markifact session has a Meta Ads account and Page, and found one PAUSED Jhadina/Pups on Stuff campaign from 2026-09-21 with zero ad sets and zero ads. This external record MUST be matched to the canonical Growth outbox receipt before any new paused canary. Never repeat-create by assumption; no account IDs or owner identities committed.
- SWLC Supabase `kqbkaozfjubkjevdfvic` remains listed `ACTIVE_HEALTHY` yet SQL queries return `57P03` (not accepting connections). No database migration, restart, RLS certification, or live approval has been attempted. This is externally BLOCKED_FOR_AUDIT_REPAIR.
- Prior creator pipeline PR #1328 and Social Juggernaut #1136 remain separate/unmerged; preserve current Growth, Social and Action Core as the single authority.

## The developer references from the owner
1. `https://developers.reddit.com/docs/capabilities/server/reddit-api` is **Devvit's community Reddit API**, where installed community apps can access posts/comments under their Reddit permission; it is not authorization to read Reddit advertising accounts or run paid campaigns. Devvit does not expose a user's saved/voted/private profile data.
2. `https://ads-api.reddit.com/docs/v3/` is the distinct Reddit **Ads API v3**; `adsread` is a limited advertising read scope, whereas `adsedit` grants write access. We only implement the exact-account `GET /api/v3/ad_accounts/{ad_account_id}` read endpoint; no `adsedit` or OAuth callback/reconnect yet.
3. `https://developers.etsy.com/documentation/mcp_server/devmcpserver` exposes the free Etsy Dev MCP at `https://mcp.api.etsycloud.com/mcp` for **specification and guide discovery only**; it does not execute Etsy API requests or connect seller data.
4. `https://developers.etsy.com/documentation/essentials/authentication/` confirms the Etsy Open API needs `x-api-key` for public reads, OAuth 2.0 with PKCE for protected seller endpoints. Our `GET /v3/application/shops/{shop_id}` checks an exact public shop record only, never ownership or write authority. An active Etsy Seller App is the least-privilege path for managing only one's own shop; no Ads execution claim.
5. Do not scrape marketplaces, use unofficial browser automation, bypass Reddit API access, or request unwarranted platform scopes.

## Implemented source steps
- **.05** Preserved and merged owner-only readiness baseline #1353, verified production Vercel secret key *names only* and SWLC current database error.
- **.06** Added pure, bounded Meta existing paused-campaign reconciliation that requires an exact advertiser match and PAUSED state, and explicitly forbids duplicate creation. Actual provider vs durable receipt correlation remains blocked until database recovery.
- **.07** Added an official Reddit Ads v3 exact-account GET probe with client-injected fetch, strict identifier validation, no redirects, no writes, and proof containing no token or advertiser ID. Devvit capability never satisfies Ads.
- **.08** Added Etsy Open API v3 `getShop` read-only probe with exact positive shop ID, no seller OAuth/write capability, and a docs-only MCP configuration example.
- **.09** Added a conservative nine-evidence certification contract that never issues paid approval, campaign creation or activation even with all booleans true.
- **.10** Added owner-gated, no-cache read-only external probe endpoints and certification endpoint; no network call unless the owner invokes `probe=1`. All 401/403/503 fail closed; provider errors are redacted.
- **.11** Added a mobile-first Growth Ads Connect hub with status, read-only verification controls and explicit launch blockers; no mutable controls, campaign dispatch, payments, ad spend, posting, product shipments or database writes.

## Exact runtime secrets and operator ownership
Set only by an authorized owner on **the correct** Jhadina Vercel project, never in GitHub, chat, build artifacts or browser:
- `JHADINA_ADS_OWNER_USER_ID`: verified signed-in Supabase Auth UUID, not user-supplied `x-jhadina-user-id`.
- `MARKIFACT_MCP_ACCESS_TOKEN`: distinct server-scoped Markifact OAuth token; no ChatGPT token copy. The existing Meta adapter only certifies Meta and Google paused-campaign operations.
- `REDDIT_ADS_ACCESS_TOKEN`, `REDDIT_ADS_ACCOUNT_ID`: separate `adsread` permission; token rotation/refresh and an authorized Reddit developer app are uncommissioned. Do not equate presence with a durable Reddit integration.
- `ETSY_API_KEY`, `ETSY_SHOP_ID`: public shop query only; seller OAuth `shops_r` / `listings_r` subject to separate permission and PKCE before private reads.
- `GROWTH_AD_MAX_DAILY_BUDGET_MINOR`, `GROWTH_AD_MAX_LIFETIME_BUDGET_MINOR`, `GROWTH_AD_BUDGET_CURRENCY`: budget upper bounds, *never* spending authorization.

## Certification matrix
| Gate | Source evidence | Production evidence |
|---|---|---|
| API and owner authentication | Tests and exact-head CI required | Real iPhone owner 200 / anon 401 / foreign 403 / absent owner 503 |
| Meta | Merged PAUSED-only adapter, existing Meta record | Dedicated runtime OAuth, exact brand/account binding, paused receipt readback |
| Reddit Ads | Exact-account GET-only proof | Separate Reddit Ads app, adsread OAuth, exact live account match, refresh/rotation |
| Etsy | getShop GET-only proof, docs MCP | Seller App/API key/shop match; separate scoped OAuth before any private reads |
| Storage | Canonical Supabase Growth RPC source | SWLC recovers, migrations/RLS tested (2 owners + anonymous), offsite proof |
| Paid approval | Action/Security/Growth immutable receipt boundary | Explicit owner approval, verified spend caps, tracking, device, paused provider canary |

**Release state: SOURCE ONLY / NOT COMMISSIONED.** Code passing CI is not a working production connection, nor permission to spend. Do not deploy a live ad, attach billing or activate without another explicit instruction.
