# PUPSON-LAUNCH-CLOSE.09–.20 — finish the private working boutique

Date: 2026-10-20 (America/Los_Angeles)
Repository: `bookieandco/crispy-waddle`
Canonical app: `apps/pupsonstuff`
Starting PR: [#1427](https://github.com/bookieandco/crispy-waddle/pull/1427), branch `fix/pupson-final-visual-3d-20261020`
Initial reviewed PR head: `baa3a5b42cbfb37fb17408df4129b99693399ba0`
Original base: `main@2b8769b7604e24998713b43cbd874eed1eb5295a`
Latest initial check snapshot: PupsonStuff CI, responsive Chromium QA, Spatial Conformance, Cloudflare no-secret proof, and Jhadina Launch Gate all SUCCESS. Supabase Preview SKIPPED. Not a live iPhone, private deployment, real image generation or order certification.

## The finish line

Deliver one dedicated **owner-protected**, **non-production** mobile PupsonStuff URL that can be opened on iPhone Safari and offers:
- Original photographed luxury boutique, swipeable without landscape-only orientation, with warm staggered item-specific visual attention rather than polygon stickers, strobes or glowing everything simultaneously.
- Tap photographed items; clearly labeled product choice; working 3D on tee, hoodie, pillow, bottle, mug and tote, plus procedural canvas; real model/error/fallback behavior; stable camera and orbit.
- Consent-driven upload of 1–3 pet images or reuse an owner-scoped Pet Identity, select a style, generate image, preview it on easel/in boutique and place it on the product in both 2D/3D.
- Honest preview/print separation, no false claim that test-order/prototype merchandise is certified, accessible and secure media handling, end-to-end dry-run path.
- Deployment exact SHA, smoke receipts, screenshot/trace evidence, and documented rollback.

**Do not** activate a public sales store, live Stripe, physical Printify fulfillment, spend on cloud GPUs/model APIs without prior authorization, publish a new domain, expose pet photos, turn on cron, or modify unrelated Jhadina projects. Preserve `public/boutique.png`, the six approved GLB binaries, existing order integrity and distinct Supabase authority. The existing Cloudflare workers.dev deployment is PUBLIC and *view-only*; it is not an acceptable private image-generation host by default. A separate owner-protected runtime is required.

## Execution rules, applied to EVERY step

1. Re-read exact latest `main`, PR head and open diff before write; no stale-base merging. Reuse canonical files/branches, don't import old 3D demo or divergent legacy PR wholesale.
2. Each target gets explicit code, regression tests, screenshots/receipts (as appropriate), evidence of errors remaining, and a verified exact commit. Fail closed, never fabricate visual proof.
3. No unreviewed secrets in code, logs, CI artifacts or user-visible links. Work against synthetic test pets and sanitized metadata until a private runtime and consent are verified.
4. After source edits: frozen dependency install, typecheck, lint, tests, build, asset hash verifier, Cloudflare safety proof and browser tests. New runtime features require real E2E, not merely Vitest.
5. Every release blocker is either **PASS with link to evidence** or **BLOCKED with an owner/external action**. No ambiguous "done" states.

## .09 — Reconcile branch and lock source: FIRST

**Files:** `apps/pupsonstuff/config/original-boutique-assets.json`, `scripts/verify-original-assets.mjs`, `docs/PUPSONSTUFF_DESIGN_GENOME.md`, PR #1427.

- Re-evaluate PR #1427 on current `main`. Merge/rebase only after reviewing conflicts in `Boutique.tsx`, `Product3DEngine.tsx`, `ProductModal.tsx` and asset contracts; don't mix in #1325 blindly.
- Run unchanged SHA lock: six `assets/approved/*.glb` vs corresponding `public/models/*.glb` and original `public/boutique.png`. Snapshot file hashes, source SHA, branch diff.
- Record exact remaining divergence from Design Genome, with feature-specific proof. Keep incomplete boutique shell and proxy out of the storefront.

**Pass:** no source drift/asset mutation, exact-head CI green, specific map of live acceptance gaps.

## .10 — Fix glow/hotspots against real photographed pixels

**Files:** `data/hotspots.ts`, `components/{Hotspot,Hotspots,ProductGlow,Boutique}.tsx`, `app/globals.css`, `lib/lifeGlow.ts`, `lib/silhouettes.ts`; new `__tests__/hotspot-calibration.test.ts`.

- Audit shirt/hoodie/mug/pillow/bottle/tote zones on canonical photo coordinates, *not* guessed polygon geometry. Separate invisible hit-box for touch from visual alpha matte. Eliminate rectangle/polygon outlines, hard bright borders and accidental all-at-once glow.
- Stage soft feathered fallback until a product-specific alpha mask has actual screenshot/photo calibration. Keep glow fully pointer-transparent. Make hover/focus accessible and disable animation under reduced motion.
- Confirm one highlighted product at a time; idle calm and active lifting must not trigger a whole-room pulse; schedule stable during session; if pausing animation and resuming, avoid sync flashes.
- Test edge taps, overlays, accessibility labels, safe pan and overlap between clickable merchandise.

**Pass:** before/after screenshots 390×844, 430×932, desktop; visually recognized item light with no geometric sticker, no missed tap or mismapped neighboring product. Until physical screenshot review: **needs visual approval**.

## .11 — Finish iPhone boutique UX

**Files:** `components/{Boutique,DepartmentNav,MusicToggle,CartButton,ProductModal,BoutiqueImage}.tsx`, `lib/boutique-viewport.ts`, `app/globals.css`, `scripts/qa-boutique-responsive.mjs`.

- Keep the canonical full-height portrait exploration and one-tap whole-room overview; fix any jump when toggling modes, focus restoration, safe areas, nested modal scroll/viewport keyboard behavior.
- Ensure bottom navigation, cart/music controls and studio buttons don't overlap. Preserve one-finger horizontal room pan; while a modal is open, prevent background motion; modal closes back to same merchandise.
- Add actual mobile touch target and scroll-restoration assertions at iPhone 390×844, 430×932, 844×390; test 1440×900 desktop. Include accessibility (focus trap, ESC/back, VoiceOver labels, color contrast) and no horizontal document overflow.

**Pass:** synthetic browser screenshots and real iPhone Safari manual video/screenshots show usable portrait flow without rotating phone.

## .12 — Make 3D loading observable and resilient

**Files:** `components/{Product3DEngine,Scene3DErrorBoundary,ProductModal}.tsx`, `config/product3dModels.ts`, `scripts/qa-boutique-responsive.mjs`; add `__tests__/product3d-runtime.test.ts`.

- Prove all six public GLBs by HTTP and glTF v2 magic/header **and** WebGL on-screen visibility, not binary existence alone. Add deterministic loading indicator, model-missing failure, WebGL context loss/recovery, retry, failover to 2D and useful diagnostics with no sensitive asset URLs.
- Remove silent `return null` on missing named mesh/material. Use independent cloned materials (don't tint shared `useGLTF` caches), dispose clones and reset error state correctly on item changes.
- Clarify whether GLB nodes have additional transforms; don't discard node transforms unknowingly. Pin maximum DPR/light budget on iPhone; pause auto-rotation during touch placement, offer reset camera and avoid runaway resource usage.
- Regression: incompatible GLB, missing asset 404, context-loss mock, shared color persistence, change product while viewer is open, 2D fallback and no whole-app crash.

**Pass:** each of six product cases is visibly lit/framed, orbitable, selectable, retryable; 2D fallback never blocks creation.

## .13 — Calibrate model orientation, origins and materials

**Files:** `config/product3dModels.ts`, `components/Product3DEngine.tsx`, `asset-audits/{reports,renders,scores}`; new screenshot reference matrix.

- Verify shirt, hoodie, mug, pillow, bottle and tote FRONT/SIDE/BACK/TOP screenshot on actual R3F viewer. Map original coordinate ranges, Y-up, raw mesh origin, model rotation, modelScale and camera focus per model.
- **Known risk:** prior viewer now translates meshes by geometric center; decal positions are children of the mesh, so offsets must be in the same coordinate space. Model-level transform, mesh-level transform, print-area transform and camera `OrbitControls.target` must use a single documented coordinate convention. Reconcile before print alignment.
- Pillow is wide in raw X/Z and shallow in Y, previously incorrect facing/size; mug cylinder/hard handle can be misframed. Validate actual resulting screenshots before settling rotations. Don't certify a guess from static bounds.
- Model material roughness/texture color/normal correctness for white vs black hoodie/tee. Do not regenerate or mutate original approved GLBs unless evidence establishes the asset itself is defective and owner approves a versioned replacement.

**Pass:** six-item front/side/back screenshot matrix, no tumbling/lying down/clipping/overscale, correct product silhouette/material, frozen GLB hashes intact.

## .14 — Repair 3D artwork decals / print master agreement

**Files:** `config/product3dModels.ts`, `components/{Product3DEngine,ArtworkEditor,ProductModal}.tsx`, `lib/{print-master,product3d/types}.ts`; relevant print tests.

- Remove naive `<Decal>` placement assumptions for curved/complex surfaces. Verify front-panel projection alignment, decal orientation/scale, curvature, z-fighting and no artwork escaping item surface; use UV/baked print-area preview where projection cannot faithfully represent the print master.
- Record transform chain explicitly: Pet Identity artwork → shopper transform → PrintProfile normalized/clamped transform → rendered decal coordinates; model translation/rotation/scale cannot change that contract silently.
- For mug/bottle wraps, don't label a single front-facing decal as full wrap; either implement accurate wrap mapping or label it front-only preview until confirmed. Compare 2D proof against print-ready dimensions, bounding/inset, effective DPI.
- Add test fixtures for portrait on tee, hoodie, pillow, mug, bottle, tote and canvas, including rotations/scales/clamp, rejection of overflow and low print DPI.

**Pass:** 3D screenshot and exact generated 2D print master visually agree within a documented print-zone tolerance; mock-only cannot mark production print certification.

## .15 — Pet Identity, consent and generator backend

**Files:** `app/api/{creative,generate-preview}`, `lib/{creative-jobs,creative-provider,ai,muapi,local-image-worker,pet-identity-sheet}.ts`, `services/pupson-image-worker`.

- Keep 1–3 image inputs, consent before any third-party processing, saved identity reuse and new-identity option. Validate MIME, file count/size, content scanning, signed owner session, no cross-owner job/asset reads, expired ownership and deletion.
- Choose ONLY the authorized already-supported worker: OpenAI or Muapi after explicit budget/key clearance; private ComfyUI only after endpoint/model/license/secret canaries; deterministic ASCII is **not** a replacement for dog image generation.
- Generation states: submit once, idempotent job key, queued/working/succeeded/failed/cancelled, bounded retries *only* safe where provider semantics permit, sanitized failure, provenance and output retention. One- and three-reference test pets; don't claim likeness until reviewed.
- Never silently route private dog photos to an unapproved endpoint or call APIs from the public view-only Cloudflare Worker.

**Pass:** private consented one-photo + three-photo real generation E2E with owned Pet Identity reuse, test provider receipt/model, failure/recovery and no private data leaked.

## .16 — Image background, upscale, saving and user controls

**Files:** `lib/{background-removal,image-upscale,print-master,creative-jobs}.ts`, `components/{PortraitEasel,BoutiquePersonalizationOverlay,ArtworkEditor}.tsx`, corresponding app API routes and tests.

- Finish shopper options **Remove / Keep / Generate** background; operate on generated art too (not only source upload). Validate transparency, edge quality, aspect ratio, pet likeness and quality warnings.
- Generation result must appear on easel, be reusable on products and project back into the boutique without modifying original `boutique.png`; keep assets private/signed with per-owner storage and lifecycle deletion.
- Pipeline: source → consent → Pet Identity → job/result → background decision → effective DPI/upscale if required → transformed 2D/3D proof → explicit approval.
- Test unsupported worker, image timeout, corrupt output, background-removal failure and generation success but print-quality failure. Never accept a visually nice preview as a print-ready master.

**Pass:** same dog portrait travels among studio, boutique, 2D and 3D with the right ownership and provenance; failure UI remains recoverable.

## .17 — Single complete dry-run storefront journey

**Files:** `components/{ProductModal,CartDrawer,CheckoutSuccessContent,OrderTrackingPanel}.tsx`, `lib/{commerce-safety,orders,fulfillment-bridge,printify}.ts`, `app/api/{checkout,stripe,order-tracking}`.

- Validate tap product → customize → approval → cart → correct style/product/variant → test-only checkout → signed webhook fixture → durable order state → dry-run Printify mapping and customer tracking. Maintain separation: artwork preview is not exact approved print master.
- Confirm all existing fail-closed rules: live Stripe secret cannot be used just because Printify is dry-run, signed catalog snapshot, no blind retry on unknown Printify submission, no duplicate charge/order, no customer-image URLs in Stripe metadata.
- Test cancellation/reopen, duplicate webhook, timeouts, session state, expired assets, uncertified variants and unknown provider order IDs.

**Pass:** synthetic/test-mode journey has auditable receipts and zero live charges or physical orders. Commerce go-live remains independently BLOCKED.

## .18 — Establish a *dedicated private* full-function deployment target

**Files:** `scripts/vercel-bootstrap.mjs`, Vercel/GitHub deployment workflows, environment templates, no secrets in repo.

- Inspect existing owner-connected hosting account and correct historical Vercel 403/permissions issue before creating any new project. Never attach to `crispy-waddle-jhadina-web` or the main Jhadina app.
- Decide and document a supported host capable of server-side image jobs, private data access, protected previews and free/known-cost operation, with no unapproved purchases. Existing public Cloudflare Workers view-only preview may remain as read-only showroom but does not meet full private generator acceptance.
- Private preview must enforce access control at edge/app boundaries (not just a hidden URL), project-scoped credentials, no customer data in public buckets, signed media URLs and off-by-default commerce/webhook/cron features.
- Check existing `vercel.json` cron constraints and isolated Supabase permission grants/RLS; avoid paid or unsupported Hobby-tier cron assumptions.

**Pass:** uniquely identified separate project, private access proof, explicit budget/no-charge policy, environment + runtime readiness receipts. If access issue persists, mark BLOCKED rather than deploying somewhere inappropriate.

## .19 — Exact-source private preview deploy and canaries

**Files:** dedicated deployment workflow(s), `scripts/preview-canary.mjs` and 3D/model smoke scripts, release manifest.

- Only after .09–.18 source acceptance, build/release **reviewed exact SHA** to separate protected preview with owner-approved deployment action. No custom public domain, public promotion or live payments.
- Smoke: homepage and commit identity, all six GLB binary and WebGL visibility, static boutique and hotspot alignment, read-only admin security, protected creative route, sanitized one-photo generation under provider consent/budget approval, saved identity and deletion, test-mode dry-run commerce.
- Scan runtime errors and collect redacted evidence; verify rollback to last protected good deployment. Refuse release on stale SHA, unprotected media, broken model, 2D/3D mismatch or data boundary leak.

**Pass:** owner-accessible **protected** URL, exact SHA receipt, complete smoke table, artifacts and working rollback.

## .20 — Real-device acceptance, reconcile and lock prototype

- On **real iPhone Safari**, prove portrait initial entrance, swipe/department nav, calm isolated glow, every product tap, close/return, six 3D rotations, Artwork fallback, 1-photo/3-photo pet preview, easel, projected art, cart and dry-run receipt. Include landscape and desktop visual regression, poor-network/asset-error recovery, iOS audio gesture policy and reduced motion.
- Review screenshot evidence against approved boutique photo and desired premium design. Resolve P0/P1 defects before merging to main; re-run exact-head CI **after** merge; deploy exact merged SHA privately and re-run canaries.
- File release ledger containing commit/hash, all six assets, 3D screenshot matrix, UI screenshots, pet-image job/output/provider receipts (sanitized), preview access status, dry-run payment status, data retention, rollback and any remaining limitations.
- Owner signs off on prototype. Do **not** conflate the privately functioning prototype with commercial launch. Subsequent public sale requires physical samples, `sample_verified`, live Stripe/webhook/Printify proofs, policies/ops/support and explicit owner approval.

**PASS = private working demo that matches boutique vision, not a commercial launch.**

## Required check set (run at each changed source head)

```bash
node apps/pupsonstuff/scripts/verify-original-assets.mjs
pnpm install --frozen-lockfile
pnpm --filter @jhadina/pupsonstuff type-check
pnpm --filter @jhadina/pupsonstuff lint
pnpm --filter @jhadina/pupsonstuff test
PUPSON_CLOUDFLARE_PREVIEW_ONLY=true PUPSON_FULFILLMENT_MODE=dry_run PUPSON_LIVE_COMMERCE_APPROVED=false PUPSON_PAYMENT_OPERATIONS_READY=false pnpm --filter @jhadina/pupsonstuff build
node --test apps/pupsonstuff/scripts/cloudflare-preview-canary.check.mjs
```

Additional: existing mobile Chromium QA workflow, real-browser rendered GLB matrix, private creative and storage integration checks, exact-head Jhadina Launch Gate and Spatial Conformance, protected-preview canaries and actual iPhone owner acceptance. The Cloudflare `/api/health` returning fail-closed 503 is **expected** in view-only mode, not a live generator health pass.

## Work ordering / dependency graph

```
.09 exact-head + frozen assets
 ├─ .10 glow/photo calibration → .11 iPhone boutique
 ├─ .12 GLB runtime → .13 visible model calibration → .14 decal/print master alignment
 └─ .15 identity + generator → .16 media / artwork persistence
 [.11 + .14 + .16] → .17 dry-run E2E
 [.15 + .17] → .18 protected hosting + real credentials
 [.09–.18] → .19 private exact-SHA preview
 .19 → .20 real Safari / final signoff
```

## Definition of completion

Not finished when PR passes CI alone. Not finished when the public Cloudflare view-only Worker loads. Not finished when a GLB returns HTTP 200. Not finished when placeholder dog art appears. Finished when owner can reliably perform the **consented dog-photo-to-product journey on a protected live iPhone site**, with visible all-six 3D product QA, working flat fallback, verified private generator, traceable print-preview vs print-master separation, original boutique aesthetic, zero live charges and rollback evidence.

### Existing reference sources
- `apps/pupsonstuff/docs/PUPSONSTUFF_DESIGN_GENOME.md`
- `apps/pupsonstuff/docs/launch/PUPSON-FINAL-HANDOFF-2026-10-08.md`
- `apps/pupsonstuff/docs/launch/PUPSON-FINAL-VISUAL-3D-2026-10-20.md`
- PRs #888, #1158–#1164, #1303, #1326–#1327, #1427
