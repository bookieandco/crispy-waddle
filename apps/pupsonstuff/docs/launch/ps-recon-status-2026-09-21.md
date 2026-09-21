# PupsonStuff PS-RECON status — 2026-09-21

## Outcome

PS-RECON.1 through PS-RECON.7 are code-complete and source-certified on PR #498.

The exact PupsonStuff CI head passed:

- frozen-lockfile workspace install;
- PupsonStuff TypeScript type-check;
- **48/48 automated tests** across 11 test files;
- Next.js 15 production build on Node 22.

Director Core's targeted test/type-check workflow also passes with the image-reference capability repair.

PS-RECON.8 remains intentionally fail-closed. The prototype is not authorized for customer fulfillment until the dedicated deployment, provider catalog, test checkout/generation, and physical sample evidence below exist.

## PS-RECON.1 — Creative correctness — complete

- Shopper uploads are capped at 1–3 Pet Identity references.
- OpenAI receives admitted reference images independently rather than collapsing them into a single contact sheet.
- Single-image providers can still use the provider-neutral identity sheet.
- Shopper prompt and background intent are durable job fields.
- Photo-processing consent is explicit in the UI and enforced by the API.
- Remove-background is the shopper default.
- Remove mode is enforced on both source references and generated output.
- Print certification independently verifies that remove-background artwork retains real alpha.
- OpenAI image generation is model-configurable and currently defaults to `gpt-image-2.5-sunburst`; production should explicitly pin the intended model/snapshot.

## PS-RECON.2 — Print master gate — complete

- Print masters are product/variant-specific.
- Approved x/y/scale/rotation is persisted into print provenance.
- Source-detail DPI is calculated from the actual placed footprint.
- Pixel interpolation is not accepted as newly created detail.
- Insufficient source detail requires an AI upscaler or fails closed.
- The final print master must pass the POD quality gate.
- Checkout requires production-ready quality with score >= 90.
- Checkout also binds the quality profile to the exact storefront product and variant.

## PS-RECON.3 — Durable creative worker — complete

- Creative requests perform an idempotency lookup before uploads/Pet Identity creation.
- Queued jobs are atomically claimed.
- A cron catch-up route is protected by `CRON_SECRET`.
- Unknown provider-submission failures are terminal instead of blindly retried, preventing duplicate paid image-generation requests.
- Stale running jobs fail closed with an operator-visible reason.

## PS-RECON.4–6 — Product Studio — complete

- 3D product preview is the default when a real model exists.
- The shopper-facing Flat-vs-3D toggle is removed.
- Drag/pinch/rotate placement is restored.
- Placement is projected into the 3D decal preview.
- Prompt and background controls are present.
- Reference-photo UX recommends one strong image and allows up to three.
- The source storefront catalog remains provider-neutral.

## PS-RECON.7 — Catalog and commerce convergence — complete

- Fake/placeholder provider IDs are removed from the source storefront catalog.
- Real Printify IDs live only in `pupson_catalog_variants`.
- Admin catalog state is read from the live certification ledger.
- Checkout snapshots the exact approved print asset plus the complete certified Printify mapping into Stripe metadata.
- Paid-order persistence uses that signed historical checkout snapshot rather than mutable catalog/output pointers.
- Fulfillment re-checks the current live catalog before provider submission, so a later mapping suspension/change still blocks production.
- Live mode requires `sample_verified`, not merely sandbox certification.
- Physical-sample promotion requires prior sandbox certification of the same mapping plus provider-order and inspection evidence.

## Database state — verified

Dedicated project: `Pupsonstuff` (`ztjyewacsmttkzktnyxl`).

Verified:

- PS-CLOSE migrations are present.
- PS-RECON creative-intent migrations are present.
- `user_prompt` and `background_mode` are live.
- `(job_id, attempt)` has a unique attempt identity.
- The redundant PS-RECON attempt index was removed; the canonical UNIQUE constraint remains and the Supabase duplicate-index warning is cleared.
- The performance advisor now reports only legacy `pupson_creations` / `pupson_creation_assets` / `pupson_pod_jobs` RLS-initplan warnings plus unused-index informational notices; those older-table warnings were not mutated as part of this production path repair.
- `pupson-originals`, `pupson-creative`, and `pupson-print-ready` are private.
- PupsonStuff server tables remain RLS-enabled with no browser policy; the security advisor reports those as informational `rls_enabled_no_policy` notices, consistent with the server-only/service-role boundary.

Current required prototype catalog matrix:

| Product | Variant | Live mapping | Certification |
| --- | --- | --- | --- |
| `frame1` | `canvas-12x16` | missing | missing |
| `mugWhite` | `mug-11oz` | missing | missing |
| `concertShirt` | `tee-concert-m` | missing | missing |

Therefore catalog sandbox and physical-sample gates are both correctly blocked.

## Vercel state — verified

The connected Vercel team currently exposes one project:

- `crispy-waddle-jhadina-web`

There is **no dedicated PupsonStuff Vercel project** yet.

The repository already contains the PupsonStuff Vercel cron definition for:

- `/api/internal/creative-worker`
- every 5 minutes

Do not deploy the PupsonStuff app over the Jhadina web project. PS-RECON.8 requires a separate Vercel project rooted at `apps/pupsonstuff` with its own environment and domain.

## PS-RECON.8 — remaining production certification

### 8.1 Dedicated deployment

Create/link a dedicated Vercel project with root directory `apps/pupsonstuff`, Node 22+, preview/production environments, and the five-minute creative-worker cron. Attach both owned domain hosts. Use **https://www.pupsonstuff.com** as the production canonical origin and redirect `pupsonstuff.com` to it. `PUPSON_PUBLIC_ORIGIN` must be `https://www.pupsonstuff.com` in production.

### 8.2 Server-only environment

Configure and verify the server-only values required by `launch:preflight`, including:

- Supabase service credentials;
- Stripe test secret and webhook secret;
- Printify API key/shop ID/webhook secret;
- OpenAI and Muapi keys;
- background remover and AI upscaler;
- admin credentials/session secret;
- `CRON_SECRET`;
- `PUPSON_PUBLIC_ORIGIN` (production must be `https://www.pupsonstuff.com`);
- `PUPSON_FULFILLMENT_MODE=dry_run`.

No server secret may exist under a `NEXT_PUBLIC_` alias.

### 8.3 Prototype catalog sandbox certification

For the three required prototype variants:

1. run read-only Printify catalog discovery;
2. review the actual product, variant, blueprint, print-provider and print-area IDs;
3. persist the exact mapping through the authenticated catalog-certification route as `sandbox_verified`;
4. run `pnpm launch:preflight` and require the sandbox catalog gate to pass.

### 8.4 Deployed end-to-end certification

On the dedicated non-production deployment:

- verify anonymous/admin boundaries;
- verify one-photo and three-photo generation;
- verify OpenAI and Muapi generation;
- verify Remove/Keep/Generate background behavior;
- approve all three prototype print masters;
- verify tampered cart/output/product/variant data fails closed;
- complete Stripe test checkout;
- replay the Stripe paid webhook and confirm order/line/fulfillment idempotency;
- run the fulfillment worker in `dry_run` and prove no Printify purchase occurs;
- verify the creative cron catches queued/stale jobs;
- verify private signed assets and retention/deletion behavior.

### 8.5 Physical sample certification

Obtain one operator-created sample for each prototype variant outside the customer fulfillment path.

Record:

- provider order ID;
- received timestamp;
- approving operator;
- print-placement pass;
- color pass;
- material pass;
- damage-free pass;
- optional inspection notes.

Promote only the exact sandbox mapping that produced the passing physical sample to `sample_verified`.

### 8.6 Production acceptance

Only after all three required prototype variants are `sample_verified`:

- rerun `launch:preflight` with zero blockers;
- verify a clean dedicated production deployment;
- verify Stripe production configuration separately;
- staff the exception/refund queue;
- then change `PUPSON_FULFILLMENT_MODE` from `dry_run` to `live`.

## Repository-wide CI note

PR #498's PupsonStuff CI is green. The broader Jhadina Launch Gate is separately failing in pre-existing `@jhadina/music-core` restoration-engine type errors. Those errors are outside the PupsonStuff PS-RECON change set and should not be weakened or hidden to make this PR appear green.

## Current decision

**PS-RECON.1–7: PASS.**

**PS-RECON.8: BLOCKED BY REAL-WORLD CERTIFICATION INPUTS.**

No provider purchase was placed, no customer fulfillment was enabled, and `PUPSON_FULFILLMENT_MODE` must remain `dry_run`.
