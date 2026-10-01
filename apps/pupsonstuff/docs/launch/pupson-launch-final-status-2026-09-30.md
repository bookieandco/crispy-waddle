# PUPSON-LAUNCH convergence status — 2026-09-30

## Executive state

PupsonStuff's application code passes its current launch build gate, but customer launch remains intentionally fail-closed because the external production credentials and physical-sample evidence are not commissioned.

This status is based on the live convergence run from GitHub Actions run `36819757115` / job `110232578838` after PR #871 repaired the workflow's pnpm version mismatch.

## Verified application gate

On Node 22 / repository-pinned pnpm 8.15.9:

- workspace install: PASS
- media-service syntax validation: PASS
- PupsonStuff TypeScript type-check: PASS
- PupsonStuff automated tests: PASS — 15 test files / 65 tests
- PupsonStuff production Next.js build: PASS
- server secrets are not exposed through checked NEXT_PUBLIC_* aliases: PASS
- `PUPSON_FULFILLMENT_MODE` remains `dry_run`: PASS

## Live Supabase state

Dedicated project: `Pupsonstuff` (`ztjyewacsmttkzktnyxl`) is ACTIVE_HEALTHY.

Current launch ledgers remain empty:

- `pupson_catalog_variants`: 0 rows
- `pupson_orders`: 0 rows
- `pupson_creative_jobs`: 0 rows
- `pupson_creative_outputs`: 0 rows
- `pupson_fulfillment_orders`: 0 rows

The PS-CLOSE / PS-RECON server-only tables remain RLS-enabled. Supabase's `rls_enabled_no_policy` findings are informational for this service-role-only boundary and are not being silenced by adding browser access.

## Railway preprocessing state

Project: `PupsonStuff Media Services`.

Healthy authenticated gateway services:

- `pupson-media-gateway`: latest deployment SUCCESS
- `pupson-media-gateway-runtime`: latest deployment SUCCESS
- public Railway gateway domain exists for the runtime

The raw `backgroundremover-runtime` remains without a public domain as intended. Two older legacy remover services have historical FAILED deployments and staged changes; they are not on the admitted launch path and were not promoted just to make dashboards green.

## Vercel state

Connected team currently exposes only:

- `crispy-waddle-jhadina-web`

A dedicated Vercel `pupsonstuff` project has not yet been created. The convergence workflow attempted the repository's governed bootstrap but correctly stopped before mutation because `VERCEL_TOKEN` is not configured in the `pupsonstuff-production` GitHub environment.

## External credential gate

The live `pupsonstuff-production` GitHub environment supplied none of the production/certification secrets to the convergence job. The following inputs are currently absent there:

- `VERCEL_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PRINTIFY_API_KEY`
- `PRINTIFY_SHOP_ID`
- `OPENAI_API_KEY`
- `MUAPI_API_KEY`
- `PUPSON_ADMIN_USERNAME`
- `PUPSON_ADMIN_PASSWORD`
- `PUPSON_ADMIN_SESSION_SECRET`
- `PUPSON_PRINTIFY_WEBHOOK_SECRET`
- `CRON_SECRET`
- background-removal endpoint/token or `KNOCKOUT_TOKEN`
- an admitted print-resolution upscaler endpoint/token or `KNOCKOUT_TOKEN`

No credential values were printed or committed.

## Launch-stage disposition

### PUPSON-LAUNCH.1 — dedicated deployment

**BLOCKED EXTERNALLY.** Code, bootstrap script, domain rules, cron definition, and one-shot convergence workflow exist. Actual dedicated Vercel project creation cannot run without the Vercel deployment credential.

### PUPSON-LAUNCH.2 — production environment

**BLOCKED EXTERNALLY.** Launch preflight works and enumerates the missing environment. Real values must be commissioned into the target secret store; they are intentionally not recoverable from source.

### PUPSON-LAUNCH.3 — Printify prototype catalog

**BLOCKED EXTERNALLY.** Read-only discovery is implemented and tested, but the live run cannot query Printify without `PRINTIFY_API_KEY`. The certification ledger remains empty, so no catalog mapping has been guessed or fabricated.

Required exact prototype matrix remains:

1. `frame1 / canvas-12x16`
2. `mugWhite / mug-11oz`
3. `concertShirt / tee-concert-m`

### PUPSON-LAUNCH.4 — deployed end-to-end certification

**READY TO EXECUTE AFTER .1-.3.** Test/build contracts are green. The deployed test must still prove real generation, background handling, print master creation, tamper rejection, Stripe test checkout/webhook idempotency, dry-run fulfillment, admin auth, cron recovery, private assets, and deletion/retention.

### PUPSON-LAUNCH.5 — physical samples

**REAL-WORLD BLOCKER.** One physical sample for each prototype mapping must be received and inspected. This evidence must never be fabricated. No purchase was placed by the convergence run.

### PUPSON-LAUNCH.6 — live commerce switch

**LOCKED.** `PUPSON_FULFILLMENT_MODE` must remain `dry_run` until all three exact mappings are `sample_verified`, Stripe production configuration is separately validated, and the exception/refund queue is staffed.

### PUPSON-LAUNCH.FINAL

**NOT YET AUTHORIZED.** Application code is launch-grade at the automated gate; the remaining blockers are external commissioning and physical QA evidence.

## Repair history

- PR #870: added one-shot launch convergence.
- First run stopped at pnpm setup because the workflow pinned pnpm 10.18.3 while the repository pins pnpm 8.15.9.
- PR #871: removed the conflicting workflow pin and re-ran.
- Repair run: install, syntax, type-check, 65 tests, and production build passed; external-secret gate then stopped provider/deployment work as designed.

## Next executable boundary

Once the required production/certification credentials are populated in `pupsonstuff-production`, change the one-shot marker and rerun `.github/workflows/pupsonstuff-launch-convergence.yml`. The workflow will then perform live Printify discovery and the dedicated Vercel bootstrap without changing fulfillment out of `dry_run`.

After exact Printify candidates are reviewed and sandbox-certified, perform the deployed E2E matrix and order the three operator samples. Only physical passing evidence can unlock `sample_verified` and the final live switch.
