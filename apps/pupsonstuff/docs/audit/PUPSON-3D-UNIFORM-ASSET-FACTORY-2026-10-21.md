# PupsonStuff — Uniform Professional Product Asset Factory
**Status: source-only normalization/acceptance scaffolding. Not a running generative service or approved storefront replacement.**

## Goal
Create **one product-accurate, reusable, blank 3D master per real supplier SKU**. The customer's pet artwork is a separate print-preview and print-ready 2D master controlled by the existing Printify flow. Do NOT generate a brand-new hoodie, tote, mug, or bottle geometry for each personalized order.

Keep the original photo boutique (`public/boutique.png`), its touch hotspots and one-at-a-time glow exactly as designed. Generation happens offsite/upstream, never in the photo or product viewer request path.

## Source model comparison — checked from upstream repos and LICENSE files

| Repository | Source role | Verified license and limitations | Production disposition |
| --- | --- | --- | --- |
| [Tencent-Hunyuan/Hunyuan3D-2](https://github.com/Tencent-Hunyuan/Hunyuan3D-2) | Image to shape + separate image-guided paint; exports textured meshes | **Tencent Hunyuan 3D 2.0 Community License**, NOT MIT. It excludes EU, UK, South Korea, limits some commercial uses; >1 million MAU condition, territory and notices/disclosures; checkpoints and dependencies must be vetted. Repo README says roughly 6 GB VRAM for shape and 16 GB for shape+texture. | Strong *candidate* for detailed product blanks, but commercial rights/geography first. No inference runtime activated. |
| [AiuniAI/Unique3D](https://github.com/AiuniAI/Unique3D) | Single-photo multiview reconstruction and textured mesh | Repository source **MIT**, yet code licensing is not a blanket guarantee about downloaded weights/dependencies/input photos. Linux setup documents CUDA and nvdiffrast; outputs may need remesh/retopology. | Useful alternate asset candidate when shape silhouette is better; rights and GPU remain unverified. |
| [ashawkey/stable-dreamfusion](https://github.com/ashawkey/stable-dreamfusion) | Text/image-conditioned NeRF and DMTet research, export OBJ/MTL/texture | Repository source **Apache-2.0**. The Stable Diffusion, Zero123 and other checkpoints retain separate licenses. Research pipeline/optimization is comparatively involved. | Research fallback, NOT default geometry for production SKU accuracy. |

Previously evaluated: [Microsoft TRELLIS](https://github.com/microsoft/TRELLIS), [TRELLIS.2](https://github.com/microsoft/TRELLIS.2), optional paid [Meshy API](https://docs.meshy.ai/en/api/image-to-3d). This does not create a second provider executor. The canonical general 3D backend authority remains `packages/director-core/src/world-3d-backend-profile.ts`. The existing PupsonStuff `lib/product3d/candidate-intake.ts` is the quarantine gate; the three new source IDs were added there, **not** installed into the storefront.

**Free to download ≠ free to run.** Local self-owned GPU compute may have no per-request API bill, but suitable hardware, electricity, model storage and labor are real costs. No hosted GPU, model download, API call, user-media transfer or bill was authorized/executed in this change.

## Single boutique-wide studio standard

File: `lib/product3d/asset-standard.ts`.

- **Axes:** GLB +Y up, +Z toward the product's front camera. Orientation must be visually confirmed; do not infer “front” from box ratios.
- **Dimensions:** true supplier/physical sample [width,height,depth] in millimeters, stored as GLB **meters**; centered mesh pivot. A single height-derived scale; **no X/Y/Z stretching** to disguise flat or malformed geometry. Candidates >7% outside verified width/depth envelope blocked from normalization.
- **Mobile budget:** single UV-mapped textured mesh/material for the **current** viewer, <=120k triangles, <=10 MiB GLB; maximum 2,048px texture edge as a review target, not yet a programmatically certified cap.
- **Materials:** distinct physically grounded metallic/roughness profiles for fabric, glazed ceramic, matte canvas, and coated metal. Existing texture/normal/PBR connections are preserved; unlinked scalar inputs alone may be standardized.
- **Render comparison:** same neutral studio lighting/backdrop, +Z front and 0°/90°/180°/270° turntable framing; shadow/contact realism, silhouette of sleeves/handles, material folds, colors and seams checked with screenshots.
- **Art:** pet artwork is never permanently baked into the reusable blank GLB. Decal must land on the physical print zone without floating, leaking onto the rear or changing between product options.

Not all products should become mathematically identical: **same visual presentation and verified physical proportions**, with different SKU-specific material and shape.

## Offline execution path (operator-owned computer only)

1. Obtain **licensed actual blank product references** from manufacturer/vendor, at minimum front, side and back, **real measured SKU dimensions**, colorway, category material, actual Printify printable region.
2. Obtain explicit model/weights/territory approval and separately approve a generation run if compute/install is needed. Generate one source candidate on an independently provisioned GPU via upstream tool's own documented recipe. Input must be synthetic or operator-owned reference, **not a customer-uploaded pet photo**. Archive generation settings, checkpoint hashes, image-source hashes, license decision and runtime receipt.
3. Run the headless normalizer in **inspection mode** on an existing candidate GLB. The tool imports one mesh/material with UVs, measures real geometry, rejects wrong physical aspect ratio, generates a single scale and does NOT silently destroy textures. No `--write-quarantine` means no files written.
4. After explicit consent and generator-run receipt, add `--front-verified --write-quarantine --generator-receipt '<approved immutable run record>'`; output path **must contain a `quarantine` directory**. It writes a new GLB and `.review.json` receipt and **will not overwrite** existing files. Example below uses synthetic dimensions and does **not** describe an actual Printify hoodie SKU.
5. Run `preflightProductGlb` with the real SHA, license/output proof, further Python geometry audit (`scripts/audit_glb.py`), existing 3D mobile screenshot matrix, Printify placement checks and operator comparison to physical reference. Reject or refine candidates until textures, geometry and print area are good.
6. Only after human visual/sample signoff and a separate change reviewing product3dModels/asset hashes may an approved GLB replace an existing one. **No auto-activation** and no production payment/checkout change.

```bash
# Requires an existing Blender binary and existing locally generated GLB.
blender --background --python apps/pupsonstuff/scripts/normalize_generated_glb.py -- \
  --input /local/candidates/hoodie.glb \
  --output /private/quarantine/hoodie-candidate-01.glb \
  --asset-id hoodie-candidate-01 \
  --vendor-mm 500,700,120 \
  --vendor-evidence "SYNTHETIC TEST ONLY - replace with SKU dimensional evidence" \
  --material textile \
  --front-verified

# CPU-only validation of mathematical safeguards (no Blender needed)
python3 -m unittest discover -s apps/pupsonstuff/scripts -p test_normalize_generated_glb.py -v
```

`--write-quarantine` is intentionally omitted above. No model was generated or normalized by committing these source files. The Blender CLI must be independently exercised in a real supported Blender installation before claiming end-to-end acceptance.

## Acceptance evidence required
1. Real SKU references and dimensional source with allowed usage geography.
2. Actual model/checkpoint/dependency/commercial output license review, plus any required notices.
3. Raw GLB hash, normalized GLB hash, valid embedded textures + topology, studio render angles, camera axis proof, reference comparison.
4. Controlled material lighting/UV and accurate supplier print-zone previews.
5. Real iPhone portrait performance, texture loading and interaction.
6. Separate private-host/owner approval before any deployment, customer media upload, GPU compute spend, paid calls or live commerce.

**Existing active storefront/photo/GLBs/Printify print master are intentionally unchanged.** This stage makes generated candidates measurable, reproducible and safe to compare, not instantly production-quality or free of manual finishing.
