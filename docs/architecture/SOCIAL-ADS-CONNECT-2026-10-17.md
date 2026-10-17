# SOCIAL-ADS-CONNECT.01–.04 — source audit and operator-safe readiness (2026-10-17)

## Authority and baseline

Canonical repository: `bookieandco/crispy-waddle`, branch from `main` at `c58a3e833219a24563bde6dcfb5f81c2e6bd0f0a`.
Source merge status: Growth production #504, Markifact adapter #509/#510 and Social Core #494 are merged. Do not rebuild Growth, Social, Action/Security, paid outbox or the existing Markifact transport.

On this audit date, #1328 (free-first creator pipeline) is draft/unmerged, 17 ahead / 146 behind main, with Supabase migration / RLS / iPhone checks still external. #1136 (Social Juggernaut) is unmerged and stale, 179 ahead / 900 behind main. SOC-ID draft stacks remain uncommissioned. Do not merge stale branches to commission a provider.

## Verified capabilities vs unresolved credentials

- Meta: ChatGPT's Markifact connection returned one accessible Meta ad account and one Facebook Page. It returned no Instagram binding or business portfolios. **This proves only the interactive connector session**, not `apps/jhadina-web`'s deployed credentials, OAuth scope, account authorization, ad eligibility, pixel installation, or permitted live spending. Exact account IDs and user identities are intentionally omitted from this public repository.
- **Existing paused provider record:** a read-only Meta Ads account lookup on 2026-10-17 found one Jhadina Growth/Pups on Stuff acceptance campaign created 2026-09-21, currently configured/effective **PAUSED**. The same account returned **zero ad sets and zero ads**. This is prior external proof that a paused campaign record exists (it is **not** proof that the current Vercel runtime is connected, or that anything ran, spent money or converted). Reconcile this campaign's provider ID through an owner-scoped durable receipt before any further paused canary; **do not create a duplicate**. No real account/campaign identifiers are stored here.
- Meta/Google adapter: `MarkifactPaidMediaProvider` supports documented operation IDs for `meta_ads_create_campaign` / `gads_create_campaign`, checks `requires_approval=true`, and forces `PAUSED`. The operation-schema check is read-only. No provider account is certified solely by that check.
- Reddit: Growth Core implements a channel contract, Reddit native-creative targeting plans and evidence-aware diagnostics. There is **no commissioned production Reddit Ads dispatch adapter or Reddit Ads OAuth**. The Markifact tool registry advertises Reddit Ads operations, but no saved Reddit Ads connection was found during this audit.
- Etsy: `etsy-market-scout.ts` uses a server-side `ETSY_API_KEY` for read-only listing/shop discovery. This is not Etsy Ads authorization. Etsy Open API's private scopes and OAuth are a separate task. Never represent marketplace views as verified conversions or automatically control Etsy Ads.
- Artsy: no integration was found. Artsy is a separate platform from Etsy; require explicit platform confirmation before selecting an API.
- Instagram: an accessible Facebook Page is not proof that an Instagram professional account, ad identity, domain or pixel has been linked.

## Delivered in this PR

1. `buildAdsConnectionReadiness` reports **credential presence only** and explicitly states `launchAuthorized:false`. No secret values or account IDs are returned.
2. `GET /api/growth/providers/readiness` requires a valid Supabase session **and** an exact `JHADINA_ADS_OWNER_USER_ID`. It is cache-disabled, non-mutating, and refuses missing operator commissioning.
3. Harden `GET /api/growth/providers/markifact/health?channel=meta` with the same operator gate, only `meta`/`google` operation-schema reads, generic provider error responses, and an explicit `accountBindingVerified:false`/`spendAuthorized:false`.
4. Regression tests cover no secrets, missing tokens, invalid spend ceilings, owner/foreign identity and Etsy/Reddit/Artsy distinctions; `.env.example` documents required server-only names.
5. No migration, ad account connection, new campaign creation, publication, DMs, product shipping, spending, analytics claim or launch occurred **in this PR**. Previously created PAUSED provider campaign remains untouched.

## Operator closeout — strict order

1. **CONNECT.05 / owner authorization:** configure `JHADINA_ADS_OWNER_USER_ID` as the verified owner Supabase Auth user ID in the correct Jhadina Vercel project. Never commit the value. Recheck GET access: anonymous 401; other signed-in user 403; unconfigured owner 503; exact owner gets metadata only.
2. **CONNECT.06 / Meta server connection:** obtain a Jhadina-scoped Markifact access token or implement first-party Meta OAuth with permitted scopes in a separate audited PR. Configure `MARKIFACT_MCP_ACCESS_TOKEN` server-only. Do not copy a token from ChatGPT or paste a secret into chat or GitHub. Call owner-only health for Meta; `CAPABILITY_READY` certifies merely the operation schema.
3. **CONNECT.07 / account match:** on the **same deployment and same operator**, read allowed Meta accounts/Pages/Instagram; match intended brand to a single provider account; validate ownership, app rights, ad account status/currency, business verification when required and eligible landing domain/pixel. Do not hardcode IDs globally or mix brands.
4. **CONNECT.08 / Reddit Ads OAuth:** create/choose a verified Reddit Ads Business developer app and account; connect via approved OAuth scopes. Implement an explicit read-only account/profile/pixel discovery adapter first, then independently certify a PAUSED-only write operation under existing Action/paid-ad approval. Never treat ordinary Reddit API credentials as Reddit Ads credentials.
5. **CONNECT.09 / Etsy vs Artsy:** confirm which marketplace is intended. For Etsy research, configure `ETSY_API_KEY` server-only; separate seller OAuth and native ad-control capabilities are not established. Artsy requires a separately vetted connector.
6. **CONNECT.10 / ceilings + lineage:** set `GROWTH_AD_MAX_DAILY_BUDGET_MINOR`, `GROWTH_AD_MAX_LIFETIME_BUDGET_MINOR`, `GROWTH_AD_BUDGET_CURRENCY` after an explicit approved test budget; verify account+brand identity in canonical Growth and Social registers and make sure the Supabase production schema/RLS can be accessed and audited. Budget values alone do not grant spending authority.
7. **CONNECT.11 / controlled external canary:** first reconcile the existing paused acceptance campaign rather than duplicate it. Require up-to-date passing exact-head CI, authenticated iPhone QA, account-specific approval and one explicitly authorized **paused** test campaign with provider ID reconciliation. No delivery, funding, activation or live ads without a further affirmative user approval and measurement/stop-loss plan.

## Proof classification

- **Code-provable now:** route authentication and operator gates, pure status decoder, no side-effect calls, existing paused/approval policy, repository test/CI results.
- **Provider-provable later:** saved workspace OAuth, account/page mapping, API scope, revoked token behavior, test operation schema and provider report reconciliation.
- **Operator/external:** budget authorization, billing instruments, Meta Business / Instagram setup, Reddit developer/business account, Etsy/Artsy choice, Supabase recovery/migration/RLS, real iPhone use, and any paid publication.

The correct source-only result is **DRAFT / NOT COMMISSIONED**. Keep all paid ads paused and account funding/spending disabled. This document is not production certification.
