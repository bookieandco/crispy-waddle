# PUPSON-FINAL.1–.12 — canonical execution and certification handoff

**Prepared:** 2026-10-08  
**Base:** `bookieandco/crispy-waddle@c2f7b8996017fd9e7083445c36ec00b734eb9ab2`  
**Authority:** `apps/pupsonstuff` and its dedicated Supabase project, not SWLC/Jhadina Web.  
**Fulfillment:** `PUPSON_FULFILLMENT_MODE=dry_run` until physical sample and live certification.  
**Old handoffs:** `docs/PUPSONSTUFF_DESIGN_GENOME.md` and `docs/launch/ps-close-7-certification.md` remain canonical experience and gate contracts.

## Honest work state

| Phase | Software disposition | Proof still required |
| --- | --- | --- |
| .1 — current head / lineage | Canonical branch frozen; #195, #537 remain stale, #199 separate independent store | exact-head CI, secrets/history exposure review |
| .2 — duplicate-safe Printify | Forward-port of #1000 code + regression suite on fresh branch | exact-head CI, Postgres smoke and migration readback |
| .3 — infrastructure | Supabase/Railway already exist; do not duplicate | fresh read-only database, buckets, secret grants, media endpoint checks |
| .4 — dedicated Vercel | Bootstrap exists; dedicated project needed | project/root proof, safe domain, approved credentials, cron readback |
| .5 — creative journey | existing owner-scoped Pet Identity, OpenAI/Muapi and optional local-worker adapter | real 1-photo/3-photo generation, consent, persistence, deletion |
| .6 — boutique/3D | existing immersive boutique, GLBs, magnet guides | iPhone real-device and desktop screenshots, decal/print-master compare |
| .7 — Printify | three exact prototype mappings sandbox_verified in dedicated Supabase ledger (2026-10-08 read) | shipping/cost/print-area current matching and manual review |
| .8 — deployed E2E | source flow implemented | Stripe test receipt, idempotent replay, dry-run no purchase, tracking/admin |
| .9 — samples | deliberately **not certified** | canvas, 11oz mug, medium tee actual received/inspected sample receipts |
| .10 — operations | source controls exist | refunds, cancellations, exception queue, audit/security/privacy checks |
| .11 — canary | **locked** | sample_verified for all three, production Stripe proof, operator authorization |
| .12 — FINAL | **not certified** | consolidated exact-head hashes, actual sale/shipment, rollback and monitoring |

## Mandatory recovery migration

`supabase/migrations/20261008162804_pupsonstuff_submission_unknown.sql` expands
the fulfillment status check to admit `submission_unknown`. Apply only through
a reviewed migration to the **dedicated Pupsonstuff** database, after exact-head
CI and smoke testing. A network failure after Printify POST must not trigger
blind purchase retries; first search provider orders by durable external id.
Preserve ambiguous rows for operator review.

## Optional private Unsloth-backed image generation

PupsonStuff already has OpenAI image edits, Muapi image effects, and
deterministic ASCII; Unsloth is optional, not a replacement.

`PUPSON_OPENAI_STYLE_BACKEND=openai` is the default.
Set `local_worker` ONLY after an authorized, private HTTPS image worker has
implemented `POST /v1/pupson/image/edit` and passed actual reference-photo
and image-byte tests. A bare Unsloth Desktop install is NOT this endpoint.

The worker protocol request:

```json
{
  "schema": "pupson.local-image-edit.v1",
  "engine": "unsloth",
  "model": "operator-pinned-model",
  "prompt": "portrait prompt",
  "reference_images": [{"mime_type": "image/png", "image_base64": "<private>"}]
}
```

The response must be:

```json
{
  "schema": "pupson.local-image-edit-result.v1",
  "engine": "unsloth",
  "model": "operator-pinned-model",
  "image_base64": "<PNG/JPEG/WEBP bytes>"
}
```

Server-side credentials: `PUPSON_LOCAL_IMAGE_WORKER_URL`,
`PUPSON_LOCAL_IMAGE_WORKER_TOKEN` (at least 32 characters),
`PUPSON_LOCAL_IMAGE_MODEL`. Production requires HTTPS. No browser keys,
no remote image URLs, no automatic paid GPU provisioning. Preserve consent,
reference provenance, metadata, raw image confidentiality, exact output, and
the independent print-quality gate. Verify the actual model licence for
commercial outputs and pet-reference handling before release.

## Google Drive role

Google Drive can hold **encrypted, versioned backups of non-live project
artifacts and certification evidence**, with per-file hashes and isolated
restore verification. It is not a replacement for Supabase transactions,
Stripe, or private signed asset authorization. Keep customer photos out of
general shared folders; store only encrypted backups under restricted access
with a retention/deletion policy and an independent encryption key.

Recommended receipt layout (no fabricated receipts):
`PupsonStuff/Launch/2026-10-08/{source-head,ci,media,checkout,provider,samples,rollback}`.
Capture archive hash, independent Drive readback SHA-256, restore receipt,
owner, timestamps, and reference to the exact Git commit.

## Required CI commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @jhadina/pupsonstuff type-check
pnpm --filter @jhadina/pupsonstuff test
pnpm --filter @jhadina/pupsonstuff build
# on fully credentialed non-production target:
pnpm --dir apps/pupsonstuff launch:preflight
```

No statement that the app is publicly operational may be made from an
automated green build alone. The controlled `live` flip requires physical
samples, safe order reconciliation, live Stripe, staffed exception handling,
and owner/operator authorization.

## Commerce-activation correction — FINAL.6–.8

The Printify `dry_run` guard does **not** control Stripe's money movement. A
`sk_live_` key could otherwise accept real payment before sample certification.

`lib/commerce-safety.ts` is now checked at **both** the checkout HTTP route and
the Stripe session adapter. Test-mode checkout requires a `sk_test_` key,
non-production environment, and dry-run fulfillment. Live-mode checkout requires:

1. A `sk_live_` key on **Vercel production** at the exact canonical origin.
2. `PUPSON_FULFILLMENT_MODE=live` after physical samples and operator approval.
3. `PUPSON_LIVE_COMMERCE_APPROVED=true` set deliberately outside auto-bootstrap.
4. `PUPSON_PAYMENT_OPERATIONS_READY=true` after staff and refund/shipping operations.
5. Existing per-item `sample_verified` and approved print-master checks.

The bootstrap writes both new activation values as `false` and leaves `dry_run`
unchanged. Local, preview and test checkouts can still exercise signed Stripe
webhook/test payment flows without buying physical products. The Stripe session
adapter no longer forwards a browser-provided pet-preview URL to Stripe.

This is **code gating**, not an assertion that Stripe test payment/webhook,
production store deployment, or live physical fulfillment has been proven.
