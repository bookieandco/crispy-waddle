# JH-UX2.04–.08 | Social feed synchronization, public sources, and optional Make.com bridge
Date: 2026-10-17
Parent: draft PR #1354 (`feat/jh-ux2-connected-feed-foundation-20261017`), **not merged main**.
Branch: `feat/jh-ux2-social-sync-ranking-20261017`.

## Decision on user-supplied links
- The GitHub REST `meta` API documentation is **GitHub infrastructure metadata**, not Facebook/Instagram Graph API.
- `mir-ashiq/metaai-api` is unofficial Meta AI chat/image automation via browser cookies. It is not a licensed Facebook/Instagram feed connector; do not collect/inject user cookies into it.
- Make.com is an **optional workflow transport** with scenarios, app connections and webhooks; its free tier uses capped credits. It is not a feed licensing/permission bypass and never owns Social approvals, finance, ad spend, Memory or Personality.

## Code targets
| Target | Code-backed outcome | Commissioning requirement |
| --- | --- | --- |
| JH-UX2.04 | Typed external source states, scope/read capability, last verified/sync, error and retry fields; connection overview and Make truth card | Provider credentials/real account consent |
| JH-UX2.05 | Typed candidate normalization, HMAC Make envelope, timestamp/owner restriction; webhook returns 503 after validation rather than acknowledging unpersisted work | **BLOCKED** on canonical Supabase target, owner-scoped durable store, atomic replay/unique keys and RLS. No source events persisted |
| JH-UX2.06 | Pure official Meta Page / IG Professional payload normalizers gated by owner Graph evidence marker | **BLOCKED** on Meta developer authorization and verified Graph API permissions, no private Facebook Home feed |
| JH-UX2.07 | Bounded public Bluesky AppView author-read and `mastodon.social` author-preview adapters; authenticated preview endpoint | Public previews available only after deploy; authenticated followed/private timeline requires separate consent |
| JH-UX2.08 | Owner-selected deterministic `Latest first` vs `Mix sources evenly` order, retaining source URLs/provenance; no automatic personalization | Acceptance tests and real iPhone UI review |

## Make intake protocol (NOT commissioned)
1. Configure an operator-controlled Make scenario with a **custom webhook / HTTP request**, not a user-cookie scraping tool.
2. Scenario sends raw JSON with `kind: feed_candidate`, `ownerId`, `workflowId`, `deliveryId`, `candidate` to `POST /api/social/bridge/make`.
3. Compute `x-jhadina-make-signature: sha256=<hex HMAC-SHA256(secret, timestamp + "." + rawBody)>`; include `x-jhadina-make-timestamp` Unix timestamp seconds or milliseconds. Keep secret server-side and out of the Make request payload/logs. HTTPS is mandatory.
4. The receiver requires `JHADINA_MAKE_WEBHOOK_SECRET` (minimum 32 characters) and a fixed `JHADINA_MAKE_ALLOWED_OWNER_ID`, bounds payload length and age to 5 minutes, and restricts event types to read-only candidates.
5. It **returns HTTP 503** after successful signature/envelope checks, because durable idempotency and tenant storage are not yet commissioned. Do **not** enable or schedule a live Make scenario against this endpoint until this dependency is resolved. Make retries must be configured only when durable receipts exist; otherwise they may waste credits.
6. A signed Make event is `workflow_unverified`; it cannot be displayed as provider-verified, silently admitted to Memory, or interpreted as approval to publish/spend/send/trade.

## Proposed durable schema (not applied)
After identifying the **correct Jhadina Supabase** project (the connected Supabase project list currently contains Pupsonstuff and Swlc, neither proven to be Jhadina's canonical tenant), use the Supabase CLI to generate a new named migration and review it before applying. Proposed tables:
- `jhadina_feed_connections`: UUID user_id / provider / external account binding, owner-authorized scopes, state, last_success, last_failure, retry_at, cursor, created/updated timestamps; unique (user_id,provider,external_account_id)
- `jhadina_feed_items`: UUID user_id, provider, external_id, account_id, created_at, observed_at, URL, public/protected rights, provenance and `workflow_unverified|provider_verified` trust; unique (user_id,provider,external_id), capped retention
- `jhadina_feed_deliveries`: unique (user_id,provider,delivery_id), immutable signed-body fingerprint, accepted_at, terminal status. Atomic insert/receipt guarantees at-most-once handling under retries.
All tables are **RLS enabled**, owner SELECT only to authenticated identity with `auth.uid()=user_id`; no anon access; client insert/update grants withheld until explicit policy review; worker writes guarded by verified server identity and canonical store. Apply an upsert that cannot upgrade `workflow_unverified` to verified without an independent provider receipt. Execute cross-owner SELECT/INSERT tests and Supabase security advisors before activating.
- No migration was applied. No database claims or external activity receipts are implied.

## Public read safety
- Bluesky uses `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed` for a user-supplied handle. It reads genuine **public author** posts, not private following timelines.
- Mastodon uses `https://mastodon.social/api/v1/accounts/lookup` + `/accounts/{id}/statuses`, **public** visibility only, fixed host (SSRF defence). Arbitrary instances need separate reviewed allowlisting.
- Both routes require a signed-in Jhadina owner, limit response count/content and treat provider failure as unavailable. These previews are not durable follows.
- No X, Meta, TikTok, Reddit or Snapchat private account access is inferred from a status label or Make connection.

## Exact closeout requirements
1. Run exact-head `@jhadina/jhadina-web` typecheck, targeted tests, UX Final, Social Core, Next production build in GitHub Actions.
2. Review code for callback/renderer/provenance protections and untrusted URL handling, restore original PR base independently.
3. Identify canonical Jhadina Supabase tenant, apply reviewed migration with RLS isolation verified before enabling any Make ingestion.
4. Obtain actual provider grants from the user, confirm owner binding and source API receipts.
5. Verify real iPhone Safari design, feed-order stability, focus semantics, media playback, and backward compatibility.
6. No one-click publishing, messaging, payments, ad spend, crypto trading, personality memory admission or unsolicited external action.

## Recommended cheap-first production order
1. Finish YouTube PR #1354 and owner consent.
2. Deploy public Bluesky/Mastodon previews; verify they're labeled public rather than connected personal feeds.
3. Commission durable store and replay protection only on the canonical Jhadina Supabase tenant.
4. Add approved Meta Page/Instagram Professional read OAuth and analytics, then constrained Make transport optionally if free credits justify it.
5. Consider n8n/Activepieces existing PupsonStuff integration as a self-hosted alternative when Make's caps become meaningful; preserve Action Core as authority.
