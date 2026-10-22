# PUPSON-3D.FACTORY.PILOT.06–.08 — CI-secured coding acceptance

**Date:** 2026-10-22. **Scope:** existing draft PR #1468 stacked on draft PR #1465. No merge, deployment, GPU spend, supplier API write or storefront GLB replacement authorized.

## .06 — GitHub reconciliation and merge preparation

- PR [#1465](https://github.com/bookieandco/crispy-waddle/pull/1465) at original head `6fc6a183ee09611c40a3b72f4837bf41603f5bd2`: **31/31** exact-head reported workflows successful, open/draft, mergeable to `main`.
- PR [#1468](https://github.com/bookieandco/crispy-waddle/pull/1468) originally at `9e17609efd682c904b2729388f3818679b90c970`: **5/5** exact-head reported workflows successful, stacked on #1465, draft/mergeable.
- #1465 includes both original child #1441 and parent #1427 by merge ancestry and preserves non-overlapping main updates. Do **not** merge older duplicates separately or squash away required provenance without review.
- This PILOT source changed #1468 after the original successes; the **new exact head must be CI-checked again**. Do not treat its old green checks as current.
- Proposed coding merge order, only after intended review/release authorization: **#1465 → #1468**. Check GitHub required reviews/branch rules (not proven accessible here). Keep separate private-runtime, payment, customer-photo and actual product-asset activation gates.
- Source integrity: the photo boutique, 3D active GLBs, hotpots, model registry, checkout, and Printify mutation code were **not replaced by this pilot**.

## .07 — Read-only, exact-ID Printify SKU evidence

The canonical server-only `lib/printify.ts` has a read-only GET `getBlueprintSizeGuide` using Printify's documented endpoint `/v1/catalog/blueprints/{blueprint_id}/size_guide.json`. The new `lib/product3d/printify-sku-evidence.ts` checks one **explicit numeric blueprint, provider and variant** against catalog results. The script `scripts/printify-3d-sku-evidence.ts` uses only the existing typed GET client and **prints** a structured report; it never publishes products, modifies the user's Printify shop, or stores API credentials.

Operator-controlled command from `apps/pupsonstuff` on a trusted machine with an existing configured `PRINTIFY_API_KEY`:

```bash
# Substitute real IDs only after identifying the exact selected sellable SKU.
pnpm printify:sku3d --product tote --blueprint 123 --provider 456 --variant 789 \
  > /private/source-packs/tote/printify-catalog.json
sha256sum /private/source-packs/tote/printify-catalog.json
```

The numbers above are CLI placeholders, **NOT discovered Printify IDs**. The offline source-pack `factory_source_pack.py` now requires that report file, its SHA-256, and corresponding `blueprintId`, `printProviderId`, `variantId`. It checks the catalog receipt's identities and print-area positions before acceptance. Receipt **content is operator-supplied evidence, not a cryptographically authenticated Printify signature**.

The catalog API exposes variant sizes and available print-zone `width/height` **in image pixels**, while the size guide may contain separate garment measurement *ranges*. These do not reliably establish the **complete physical [width,height,depth]** of the actual model, nor handle/strap drop for totes. Fill `dimensionsMm` and supplier measurement evidence *only* from manufacturer specs or physical samples. No existing generic GLB bounds are valid supplier measurements.

**Current operational blocker:** this session has no verified Printify account API token/selected SKU, so neither the exact live variant IDs nor its physical dimensions are asserted. The tote and hoodie source-pack templates remain blank/fail-closed. No personal media or private catalog report committed.

Official catalog/size-guide reference: https://developers.printify.com/#catalog

## .08 — Cost-free locally modeled physical tote fallback

- Existing GPU runners remain separate, unexecuted; `scripts/procedural_tote_geometry.py` creates a single measured **body/gusset/handle geometry array on CPU**, with rounded corners, fabric taper/drape and wide fabric strap ribbons. `scripts/model_supplier_tote_blender.py` is the Blender exporter for this **quarantined draft**, no paid GPU, model checkpoint, third-party inference or hosted upload.
- Use **`pupson-procedural-tote-cpu`** as source identity rather than faking a Hunyuan run: the candidate intake registry understands it, and `factory_source_pack.py` does not require a Tencent license/weights for original procedural source.
- Four structural requirements before any real CPU export: verified Printify source pack and catalog receipt, manufacturer/sampled full SKU dimensions, measured `proceduralTote` specification (body height, handle drop, strap width/thickness/anchor spacing) and a **separate exact-manifest operator approval**. `--write-quarantine` is absent by default. No file is written for ordinary inspection.
- The Blender GLB is a **candidate**, not visually/photo/physics production ready: handle islands, seams, print-zone UV alignment, believable fabric shader/texture, physical supplier matching and mobile load remain manual QA tasks. Nothing changes `public/models` or `config/product3dModels.ts`.

Operator-only example, with real SKU dimensions and locally installed licensed Blender:

```bash
# Read-only CPU geometry inspection (may run without Blender installed).
python3 scripts/model_supplier_tote_blender.py \
  --pack /private/source-packs/tote \
  --output /private/quarantine/tote-cpu-01.glb

# Once package + model are independently approved, export on a CPU host.
blender -b --python scripts/model_supplier_tote_blender.py -- \
  --pack /private/source-packs/tote \
  --output /private/quarantine/tote-cpu-01.glb \
  --write-quarantine --approval-file /private/approvals/tote-cpu.json
```

Expected approval JSON fields: `enabled: true`, `model: "measured-tote-cpu-v1"`, `manifestSha256` matching the source manifest bytes, `approvedBy` and `ownerCpuComputeNoBilling: true`. Avoid placing receipts/keys/photo records in Git. This JSON is an operator attestation, not a cryptographic signature of their identity.

## Automated evidence / acceptance

```bash
pnpm --filter @jhadina/pupsonstuff type-check
pnpm --filter @jhadina/pupsonstuff test
python3 -m unittest discover -s apps/pupsonstuff/scripts -p test_factory_generate.py -v
python3 -m unittest discover -s apps/pupsonstuff/scripts -p test_procedural_tote.py -v
```

The scoped mobile browser workflow runs the Python CPU mathematics, strict SKU tests and source asset lock, plus existing synthetic GLB browser screenshot tests. Passing these **cannot** certify a new candidate's physical shape, commercial use rights, live Printify dimensions or an actual protected iPhone deployment.

## Priorities after this sequence

**.09** first genuine source-pack/physical tote measurements and real CPU Blender GLB (if all rights met). **.10** same-camera screenshots, geometry inspection, print-area/decal and actual product sample comparison. **.11** owner-approved restricted iPhone preview and checkout-proof flows. No main merge, live commerce, paid GPU or product-replacement claim without separate review.
