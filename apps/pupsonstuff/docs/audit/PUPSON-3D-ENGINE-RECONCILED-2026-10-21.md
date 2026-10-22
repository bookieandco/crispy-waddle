# PupsonStuff 3D engine — reconciled audit and execution order

**Date:** 2026-10-21 (America/Los_Angeles)  
**Canonical repository:** `bookieandco/crispy-waddle` → `apps/pupsonstuff`  
**Parent repair:** draft PR #1427, `285d0e164aa0d8f4189e4cf964f98acfe65fad2f` when inspected  
**Incremental camera PR:** #1441 (this branch), based on PR #1427, **not** on an obsolete main snapshot

## Original intent (from design genome, prior blueprint and recent handoffs)

The customer enters the **original photographed boutique** `public/boutique.png`. Products glow one at a time, are selected in their exact image-space regions, lift subtly, then open a product studio. There the shopper uses an existing Pet Identity or 1–3 consented pet photos, generates/reuses dog artwork, sees the easel reveal, projects art across the boutique, previews the product in 3D where supported, edits the composition, approves the exact 2D print master, then proceeds through gated checkout/fulfillment.

This is **not** a brief to replace the photo with an explorable room, a generic product grid or an AI-generated remake of the boutique. The intended mood is premium cream/bronze/wood, not flashing polygon contours.

## Source-of-truth boundaries

| Subsystem | Existing implementation | Decision |
| --- | --- | --- |
| Photographic storefront | `components/Boutique.tsx`, `BoutiqueImage`, `Hotspot`/`Hotspots`, `ProductGlow` | **Preserve** photo and common image-space touch targets; polish glow |
| Product 3D | `components/Product3DEngine.tsx`; `config/product3dModels.ts`; `lib/product3d/*` | **Extend existing engine**, not build a rival viewer |
| Approved product GLBs | shirt, hoodie, mug, pillow, bottle, tote | **Do not rewrite binary files**; enforce `config/original-boutique-assets.json` hashes |
| Canvas | existing procedural frame | Keep procedural |
| 3D room | `BoutiqueScene.tsx`, `boutique_shell.glb` | **Optional later**; shell is an unfinished architectural blockout; rejected `boutique_proxy.glb` must not be used |
| AI pet artwork | Pet Identity / creative jobs / output IDs / background removal | Separate from 3D geometry; private credentials and consent required |
| Image-to-3D | experimental Hugging Face / modeling scripts, audit tooling | Not a certified live generator. Add only behind validation and approval |
| Fulfillment | print master, Stripe, Printify | 3D preview is not production authority; existing release gates remain |

## Evidence-based findings, not presumed completion

1. Original polygon highlights and duplicate moving photo cutouts explain the reported odd silhouette. PR #1427 introduces feathered highlights; physical iPhone pixel calibration remains open.
2. Main-branch `Product3DEngine` still used strict mesh-name lookups that could return `null`. PR #1427 makes failures visible, adds retry, cloned materials, centered geometry, and more appropriate decals. That branch has **not merged**.
3. GLBs use inconsistent raw geometry units, and hand-entered camera positions are fragile. PR #1441 adds `modelBoundingRadius` and `fitProductCamera` and wires them to the existing viewer; radius is rotation-invariant and scales with the model transform, not with print coordinates.
4. White hoodie appearance and pillow/mug/bottle decal projector alignment remain **visual QA**, not certified by the asset audit scores or TypeScript.
5. PR #1427 had **146/151 Vitest tests passing** at inspected head; five failing tests were legacy launch-readiness/Stripe fixtures after strengthened gates. Cloudflare local OpenNext also rejected pinned Next 15.5.28 on support policy. Do not bypass security to force green.
6. PR #1441's first head completed TypeScript and passed all **six newly added framing tests**; overall suite remained **152/157** because the same five legacy fixture failures persisted. New camera screenshots / real iPhone proof are still pending.
7. The view-only Cloudflare preview cannot execute consented pet generation, payment or Printify calls. Vercel dedicated project creation was previously blocked by permission 403; neither is a fully approved private full-function launch.

## Execution sequence — in dependency order

### PUPSON-3D.ENGINE.01 — stable framed products (implemented; not visually certified)
Keep product registry and six approved GLBs; derive perspective camera from actual mesh bounds, respect portrait aspect, preserve source-camera direction, fit orbit limits. Add unit tests for invalid geometry/scale and very different source units.

### .02 — independent visual evidence lane (source implemented; CI pending)
Keep the **full** CI/launch suite as a blocking release gate. Run type-check plus **scoped 3D tests** before the isolated, no-secret, no-customer-data browser screenshot job so unrelated commerce-fixture errors do not suppress visual evidence. Capture approved models with synthetic decals (front, side, back); require WebGL canvas and nonempty artwork marker.

### .03 — calibrate each asset against actual screenshots
Inspect shirt, white hoodie, black hoodie, mug rim/handle, pillow plane, bottle cap and tote handles. Compare centered front view, vertical extent, lighting, material texture retention, zoom orbit and clipping in 900-square renders and portrait viewports. Record per-product defects separately; never regenerate all six GLBs to fix a camera or light bug.

### .04 — decal-to-print agreement
For every mapped variant compare 2D editor, 3D projected artwork and exact 2D master. Fix the relevant `PrintArea` or projector, not order/product IDs. Cylinder decals are front-only previews until approved 360° wrap mapping exists.

### .05 — photographed boutique effects
Approve one-at-a-time glow/hover/lift on actual boutique screenshots, no polygon shapes outside product, no aggressive flashing and reduced-motion support. Replace broad radial matte with optional product-alpha mattes only after grounded pixel segmentation.

### .06 — physical iPhone acceptance
Test 390×844 and 430×932 Safari portrait plus landscape. Verify photo panning, hotspot hit tests, full-room overview, product view switch, orbit/pinch, rendering performance, WebGL-loss recovery, two-dimensional fallback and accessibility. Linux WebKit is supplemental, not physical iPhone evidence.

### .07 — governed future asset intake
Image/reconstruction source → provenance/license/consent → geometry/UV/component audit → normalized orientation/pivot/material map → optimized GLB preview → screenshots → registry approval → content-hash lock. No unsupervised model replacement or paid generation.

### .08 — isolated private full workflow and release evidence
When operator-owned credentials/host permissions are available: consented dog-photo tests, generated art, 3D/print alignment, deletions/reuse, test checkout and certified Printify samples. Preserve `dry_run`, no production commerce or domain publication without separate authorization.

## Verification rules

- A pass in 3D geometry/unit tests **does not** certify appearance.
- A view-only browser screenshot **does not** prove real photo uploads, production print quality or Safari on a physical iPhone.
- A green build **does not** certify a deployed/private shopping experience.
- No public launch, customer content, provider purchases, secrets, Supabase writes or production service modifications are implied by this audit.
