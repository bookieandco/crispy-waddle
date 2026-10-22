# PUPSON-FINAL-VISUAL-3D.01–.08 — owner-locked release pass

Date: 2026-10-20 (America/Los_Angeles)
Base examined: `main@2b8769b7604e24998713b43cbd874eed1eb5295a`
Code branch: `fix/pupson-final-visual-3d-20261020`

## Authority: preserve the actual boutique
- Canonical visual: `public/boutique.png` (1568×1003). No replacement storefront/grid, no regenerated room, no use of unfinished `boutique_shell.glb` or rejected `boutique_proxy.glb`.
- Preserve the existing six GLBs byte-for-byte: shirt, hoodie, mug, pillow, bottle, tote. Canvas may stay procedural.
- iPhone first: full-height photo/pan plus optional room overview; image and hotspots must share one coordinate space.
- No live money movement, product orders, model downloads, unapproved provider/GPU spend, domain publication, customer uploads, or security-gate relaxation.

## Verified source-level findings
1. A generic `silhouetteClipPath` polygons each hotspot. The glow and 240ms photo clone previously had hard polygon edges; this is the reported odd geometry.
2. `Product3DEngine` looked up one mesh/material by exact names, returning `null` on mismatch. The model could be invisible with no recoverable UI. The loader can also fail if the deployed Worker does not include GLBs.
3. Shared cached GLB materials were recolored via `material-color` even though `useGLTF` caches their underlying materials; isolate per-viewer material instead.
4. Source-model bounding boxes/units differ widely. The pillow is broad in X/Z, shallow in Y; a 0.5 raw-unit print decal over a ~109 raw-unit width was effectively invisible. Mug and bottle decal scales were wider than those products.
5. The static Cloudflare Free preview intentionally rejects API uploads, creative jobs, DB, Stripe and Printify. It CANNOT certify a working dog generator or checkout, regardless of how appealing the homepage looks.
6. Earlier Cloudflare upload was behind the later glow/portrait commits. Browser QA on local Chromium is not a real iPhone Safari proof.
7. A real pet-image worker protocol exists (`services/pupson-image-worker`), but operator-owned ComfyUI models, private networking, reference-photo canaries, and runtime secrets have not been certified. The image-to-3D Hugging Face script is scaffolded, not an activated production generation service.
8. The previous Vercel creation attempt for a *separate* PupsonStuff project failed with HTTP 403. The Jhadina web project must never be hijacked.

## Implementation in this branch (source; not yet certified)
- Remove polygon-shaped highlight/selection photo clone; render a quiet masked/feathered glow without silhouette outlines. Keep calm staggered timing and touch-safe panning.
- 3D viewer: use independent cloned materials, center GLB meshes with original geometry untouched, fail visibly on absent mesh/material and add a retry affordance.
- Add 3D Product / Artwork switching on every customizable mapped product, regardless of animation availability.
- Stage geometry-derived pillow orientation and decal size corrections, plus smaller mug and bottle projections. **Their print-area alignment is not certified until real screenshots at front/side/back.**
- Browser QA checks that all six GLBs are served as actual glTF v2 binaries and that flat/3D controls are reachable.
- Remote Cloudflare canary now checks GLB binary payloads, not merely 200 HTML and safety API routes.

## Required finish sequence

### .01 — Review exact-head and preserve assets
Run `node apps/pupsonstuff/scripts/verify-original-assets.mjs` at the PR's exact head. Compare to the immutable asset manifest, then confirm no executable or dependency drift beyond this scope.

### .02 — Source tests + type/lint/build
```bash
pnpm install --frozen-lockfile
pnpm --filter @jhadina/pupsonstuff type-check
pnpm --filter @jhadina/pupsonstuff lint
pnpm --filter @jhadina/pupsonstuff test
PUPSON_CLOUDFLARE_PREVIEW_ONLY=true PUPSON_FULFILLMENT_MODE=dry_run PUPSON_LIVE_COMMERCE_APPROVED=false PUPSON_PAYMENT_OPERATIONS_READY=false pnpm --filter @jhadina/pupsonstuff build
node --test apps/pupsonstuff/scripts/cloudflare-preview-canary.check.mjs
```

### .03 — Actual viewer regression
In Chromium/Safari view the 3D apparel, pillow, mug, bottle and tote from the existing photographic boutique. Confirm model silhouette, camera centering, rotation, texture, rim/handles, orbit and zoom bounds. Capture desktop and 390×844 / 430×932 portrait screenshots. Do not mark print placement approved from the photo alone.

### .04 — Glow/photo calibration
Review how light travels across apparel: one localized item at a time, no simultaneous flashes, polygons, auras around empty background or selection clones, with reduced-motion support. After the owner compares screenshot pixels, optionally replace radial feather with per-product alpha mattes generated against `boutique.png`. Do not infer precise pixel-perfect segmentation from a generic shape polygon.

### .05 — Pet Identity and generator E2E
In a PRIVATE credentialed nonproduction environment, prove consent, one-photo and three-photo new Pet Identity, saved identity reuse, async creative job outcomes, provider provenance, cancellation/retry safety, pet likeness, secure media persistence/expiration/deletion and background options. Confirm OpenAI/Muapi only when credentials explicitly provided and budget authorized; local ComfyUI requires a separately functioning private worker. The public view-only Worker must remain disabled for these APIs.

### .06 — Artwork → product → print-master QA
For each launch variant, compare easel reveal, boutique projection, 2D placement, 3D decals, transform clamping, print-profile geometry, generated transparent background, effective DPI/upscaling and customer approval. Fail closed if model decal disagrees with the exact 2D print master. A handsome 3D preview alone cannot authorize a physical print.

### .07 — Private preview deployment and exact SHA
The dedicated private full-function PupsonStuff preview needs its own isolated host/project and server-side secrets. Prior Vercel project creation was blocked at 403. Cloudflare's EXISTING Workers preview is publicly reachable and view-only by design; do not silently use it as the private/full-function target or broaden access. Do not change the Jhadina deployment or domain. Reconcile the separate hosting permission/identity issue, require protection, then deploy the tested PR merge SHA only with owner authorization; run health, GLB, image and end-to-end canaries against that exact URL.

### .08 — Owner iPhone acceptance → production gate
Use real iPhone Safari portrait and landscape for pan, selection, glowing apparel, open/close, all six 3D assets and one consented sample dog portrait. Preserve test payments and `dry_run`. Before live commerce require actual sample_verified launch variants, certified Printify IDs, Stripe test receipts, refunds/support, signed webhook/idempotency proof, privacy/retention, monitoring and explicit owner launch authorization.

## Decision
This branch is a targeted repair, **not** evidence that external services, 3D rendering on an iPhone, generation or fulfillment are operational. No deploy or paid action is implicit in a green build.
