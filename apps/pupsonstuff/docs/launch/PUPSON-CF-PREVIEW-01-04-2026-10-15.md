# PUPSON-CF-PREVIEW.01–.04 — owner-controlled, view-only Cloudflare Free deployment

**Date:** 2026-10-15. **Canonical source:** `apps/pupsonstuff`, main branch. **Never use the Jhadina Vercel project.**

## .01 — Create a Cloudflare Free account (owner action)
1. On iPhone open https://dash.cloudflare.com/sign-up and create a Cloudflare account. Verify your email. Do not upgrade or attach a payment method.
2. Confirm Workers Free is selected. Published free-tier limits include a 64 MiB uncompressed Worker bundle and 10 ms CPU per request. Earlier PUPSON-HOST tests verified only the homepage and fail-closed health route under local workerd.
3. Find the account ID under Cloudflare Workers dashboard account details. Do not share it in public logs (the account ID isn't a password but is still a scoped deployment identifier).
4. In Cloudflare dashboard, create an **API token** using the `Edit Cloudflare Workers` template, scoped only to the new Cloudflare account. Never paste token to ChatGPT or a Git commit. The token grants Worker mutation powers: rotate/revoke if exposed.

## .02 — Configure private GitHub environment (owner action)
- GitHub repo `bookieandco/crispy-waddle` → Settings → Environments → create `Pupsonstuff_cloudflare_preview`. Configure appropriate required reviewers if available.
- Add environment secrets exactly `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. Keep them environment-scoped, not `NEXT_PUBLIC_*`.
- Do NOT configure Supabase service-role, Stripe, Printify, image API tokens, product domain, or cron in this stage.
- Cloudflare Workers Free may still involve capacity limits and later paid products; do not enable automatic upgrades or paid add-ons.

## .03 — Deploy only by explicit GitHub Actions confirmation
- After all PR and exact-head main tests are green, go to GitHub Actions → **PupsonStuff Cloudflare Free View-only Preview** → Run workflow, select `main` and `DEPLOY_VIEW_ONLY_FREE_PREVIEW`.
- Manual-only workflow; deploy job is disabled unless the user selects the exact confirmation, on `main`.
- Builds source with `PUPSON_CLOUDFLARE_PREVIEW_ONLY=true`, runs Vitest + TypeScript, enforces original boutique asset hash and validates that no Worker routes, cron, storage resources, or paid bindings were attached.
- Only a new `pupsonstuff-preview-free.<user-subdomain>.workers.dev` URL is authorized. Never bind `pupsonstuff.com`.
- The Cloudflare Worker has `PUPSON_FULFILLMENT_MODE=dry_run`, both commerce flags false, **no secrets or Supabase**, and API middleware allows only read-only `GET/HEAD /api/health`; checkout, creative jobs, uploads, webhooks and admin APIs return 503 regardless of Stripe or provider keys.
- No automatic hosting mutation, provider costs, Printify purchases or paid subscription is authorized by this PR. The owner choosing `Run workflow` later authorizes the free preview upload only.

## .04 — Acceptance and next gates
- Workflow reads deployment URL from actual Wrangler receipt (not guessed).
- Remote canary checks **GET** `/` → 200 HTML, **GET** `/api/health` → 503 `not_configured` + exact commit SHA and `dry_run`, **GET** `/api/checkout` → 503 view-only safety.
- All three pass before calling the result a **view-only preview**, not a working shop.
- After preview, require live Workers CPU measurement, iPhone hotspot/panning screenshots, Supabase least-privilege integration, privacy/retention tests, separate consent/cost limits for image jobs, sample-verified merchandise, Stripe test signing and idempotent Printify dry-run.
- A 5-minute queue schedule, always-on AI work, real billing, custom domain and production payments remain disabled.

References: https://developers.cloudflare.com/fundamentals/account/create-account/ ; https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/ ; https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/

## 2026-10-16 verified environment reconciliation
The owner's GitHub environment PDF shows **Configure Pupsonstuff_cloudflare_preview** with both environment secrets already present. The earlier workflow used `pupsonstuff-cloudflare-preview` and GitHub provided both secrets as empty (see Actions run 38944890273, attempts 1–3). The workflow now binds to the existing exact underscore-separated environment. Do not recreate, expose or copy Cloudflare credentials. When the workflow runs again, its existing manual confirmation remains mandatory and the preview-only guards remain unchanged.
