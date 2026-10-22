# PUPSON REAL TOTE — private SKU intake + six-view visual judgment
**October 22, 2026 — continuation of draft #1468.**

## Verified evidence
- Latest pre-assembly source checkpoint `80ff7110424b8a87ea3612330e9432cd684a7d83`: five of five GitHub workflows succeeded, including WebKit iPhone-viewport browser QA.
- The corresponding [Mobile Boutique Browser QA run](https://github.com/bookieandco/crispy-waddle/actions/runs/39749904346) uploaded artifact `pupson-boutique-responsive-qa`, ID `12413642127`, which **actually contains six** PNG screenshots: front/side/back `pilot-tote-candidate-*` and `pilot-tote-approved-*`.
- Human inspection of those *synthetic* views: front/back of procedural candidate have a plain solid panel and one visible high arch; side reveals very thin vertical straps and slab-like bag body. Existing baseline displays two loop handles with a different shape. The preview decal appears on the candidate front. **Neither silhouette nor print-zone alignment is certified**. This fails the user's realism criterion; the WebKit test only proves browser operation, separate assets and UI interaction.
- Connected Supabase PupsonStuff production catalog examined read-only: three existing printify rows (tee/canvas/mug), **no tote**. Do not borrow those other product IDs.
- Public [Printify S&S Bags 42795 Natural Tote](https://printify.com/app/products/1090/s-and-s-bags/natural-tote-bag) data is illustrative supplier reference only. Its public catalog URL is not an authenticated merchant ID. Printify's published 15-by-16 inch flat bag specs and handle data do NOT prove true 3D depth, anchor spacing, strap thickness, licensed blank photos or selected shop variant.
- Vercel account currently showed only the Jhadina project and no separate confirmed PupsonStuff project. No dedicated hosted private iPhone preview authorized or performed.

## New operator-only assembler (source prep, not certification)

The new `scripts/assemble_tote_source_pack.py` makes an **all-or-nothing local manifest** out of operator-owned files. It is dry-run by default, requires exact IDs in a read-only Printify report plus an independent owner selection file, binds measured variant to the catalog variant, hashes source documents/photos, rejects three identical camera-angle files, refuses public *flat thickness* as 3D depth and will not overwrite any existing `manifest.json`.

**On the owner's trusted machine only (no public repository, customer photos or API keys in commits):**

1. Create an external private directory `/private/tote`. Fill `intake.json` using [tote.intake.private.template.json](./source-packs/tote.intake.private.template.json); fill `merchant-selection.json` from [tote.merchant-selection.private.template.json](./source-packs/tote.merchant-selection.private.template.json).
2. Identify the *exact chosen blank tote* in Printify. With a privately configured Printify API token, run `pnpm printify:sku3d --product tote --blueprint REAL_ID --provider REAL_ID --variant REAL_ID > /private/tote/printify-catalog.json`. **REAL_ID is not a usable literal number.** Compare API IDs to the separate owner-selected receipt.
3. Obtain and place the manufacturer/sample `measurement-source.pdf`, permitted blank `front.png`, `side.png`, `back.png`, and permission documents `blank-photo-rights.pdf`, `commercial-usage-license.pdf`. Inputs must refer to the **same** supplier/provider/variant. Do not record catalog-placeholder pixels as physical centimeters or guess a gusset depth.
4. Run:

```bash
cd apps/pupsonstuff
python3 scripts/assemble_tote_source_pack.py --pack /private/tote
# Only when blockers are empty (structural source prep, not physical QA):
python3 scripts/assemble_tote_source_pack.py --pack /private/tote --write-manifest
python3 scripts/factory_source_pack.py --pack /private/tote --for-execution
```

5. The separate **manifest SHA-bound owner execution approval** is still required before exporting to `/private/quarantine` with `pilot_tote_glb.py --write-quarantine`. The exporter cannot replace `public/models/tote.glb`.
6. Run local Blender's `render_candidate_comparison.py` only for a real vendor-specific candidate. Confirm 6 images against licensed blank references, physical print-zone coordinates, front-only/back-only artwork positioning, seams, fabric, handles and real sample. Execute `pilot_tote_acceptance.py` with a signed actual review. Browser-viewport tests **are not** physical iPhone Safari certification.
7. A **separate owner authorization** must first identify a distinct PupsonStuff project and restricted-access mechanism. Only then can a private iPhone host be deployed, with anonymous access rejection and checkout/Printify/spending locks proven. No hosted deployment, live order or payment is authorized by assembling a source pack.

## Honesty and security
The assembler checks filenames, input consistency, hashes and structural attestations. It does **not** cryptographically prove Printify API source provenance, legal ownership, authenticity of the measurement documents or actual print quality. Those require real supplier/operator evidence. Structured `prepared: true` is not `storefrontApproved: true`. Source-specific physical and human approvals remain hard gates.

**Current status:** real merch tote manifest, original GLB production candidate, Blender six-shot supplier certification and private hosted iPhone deployment remain **BLOCKED**. Draft #1468 stays unmerged, original boutique/photo/model/checkout remain unchanged.
