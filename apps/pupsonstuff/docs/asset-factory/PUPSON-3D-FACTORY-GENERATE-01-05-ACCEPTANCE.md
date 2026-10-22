# PUPSON-3D.FACTORY.GENERATE.01–.05 — coding completion and operational acceptance
**2026-10-21. Source implementation is committed in draft PR #1468. No vendor-ready generated asset exists yet.**

The canonical application stays `apps/pupsonstuff`; source models and product artwork are separated. Preserve `public/boutique.png`, the boutique hotspots, existing GLB hashes and `Product3DEngine`. The source here is **not** a second Director 3D backend and must not auto-publish models or submit any Printify order.

## Execution results by target

| Target | Coding status | Operational/evidence status |
| --- | --- | --- |
| **.01** Real-SKU physical reference pack | **Implemented:** offline `scripts/factory_source_pack.py` validates supplier variant, W/H/D, front/side/back source images, SHA-256, licensed source/output provenance and generator rights. Honest `docs/asset-factory/source-packs/{tote,hoodie}.manifest.template.json` files added. | **BLOCKED:** exact real Printify blueprint/provider/variant, dimensions, photos and rights have **not** been verified. No fabrication of supplier dimensions. |
| **.02** Local GPU/checkpoint readiness | **Implemented:** `scripts/factory_gpu_runner.py` offline preflight verifies local code/weights, NVIDIA VRAM, immutable manifest/approval receipt, quarantine path and rights flags. | **BLOCKED:** no operator-owned NVIDIA GPU, predownloaded weights, validated exact checkpoint terms, operating-system egress firewall or runtime receipt available here. Nothing installed or billed. |
| **.03** Generate source candidates | **Implemented:** isolated invocation of *locally installed* Hunyuan3D-2 shape + paint and Unique3D multiview path. Generates only after `--execute` with manifest-bound approval, OS network-block attestation and local model/weights. Invalid outputs rejected and no existing quarantine file overwritten. | **NOT RUN:** no full inference or model output. Stable DreamFusion is a research source, intentionally not misrepresented as a production one-step factory. |
| **.04** Normalize accepted candidate to measured SKU | **Implemented:** existing `scripts/normalize_generated_glb.py`, fixed to preserve transformed normals and UVs. One uniform scale, no width/depth squashing, baseline remains untouched, outputs only under quarantine with SHA receipt. | **NOT RUN ON A NEW MODEL:** real SKU/GLB missing, no Blender binary provisioned in the agent runtime. CPU math contracts tested. |
| **.05** Product screenshot + print QA | **Implemented:** `scripts/render_candidate_comparison.py` creates identical studio front/side/back renders of proposed + approved GLB via local Blender (operator-gated). `scripts/factory_baseline_review.py` gives factual existing geometry telemetry and NEVER certifies visual/physical likeness. Existing QA and Printify print-master remain canonical. | **NO ACTUAL NEW-CANDIDATE VISUAL QA:** no new generated/normalized asset, real SKU or sample. Independent iPhone and vendor print-zone proof outstanding. |

## Existing audited baseline evidence (real, not guessed)

- **Tote:** `asset-audits/reports/tote.json` records **852 triangles**, **0 textures**, one zero-area triangle, a 0.38 × 0.5184 × 0.10 (export-unit) bounding box. The body/handle silhouette was previously flagged visually blocky. These are **NOT** certified Printify dimensions.
- **Hoodie:** `asset-audits/reports/hoodie.json` records **21,044 triangles**, **2 textures** (reported base color and normal), four zero-area triangles and ~0.7533 × 0.8993 × 0.2475 export-unit bounds. The side profile still needs comparison to actual garments. These are **NOT** certified Printify dimensions.
- `docs/fulfillment/catalog-mapping-report.json` currently contains placeholder products and a previously recorded blocked Printify API lookup. Do not claim this is live data or that Printify merchant variants have been found.
- Puppy's dog portraits are **NOT** reference media for product shape reconstruction. Use licensed photos of blank products, create reusable supplier-shaped models, then apply the existing artwork/print zones after human signoff.

## How a real operator completes inference (outside this PR)

1. Acquire *actual* product SKU catalog/variant and manufacturer dimensional specification, legitimate front/side/back blank-product photos, and commercial rights. Populate a local pack at `/private/source-packs/tote/manifest.json` with images; SHA-256 all 3 original image files and confirm rights. Do **not** commit photos/customer identifiers or operator secrets to GitHub. The reference-pack templates are blocked by default.
2. Run `python3 scripts/factory_source_pack.py --pack /private/source-packs/tote`. It must output `prepared: true`. A JSON string alone is operator attestation, not proof that a third-party source's license was lawfully reviewed; retain documents externally.
3. On an operator-owned, CUDA-capable host with a locally installed official generator and **approved model checkpoint cache**, independently establish firewalled network egress. Do not download checkpoints, provision machines or use a paid API implicitly. First run:

   ```bash
   python3 scripts/factory_gpu_runner.py --pack /private/source-packs/tote \
     --repo /local/models/Hunyuan3D-2 --weights /local/weights/Hunyuan3D-2 \
     --output /private/quarantine/tote-candidate-01.glb
   ```

   An unready preflight must enumerate blockers and performs no inference. Recheck genuine checkpoint/code compatibility and legal terms, including Tencent's territorial exclusions before commercial use. The required model code/weights and operational GPU cannot be verified from GitHub source files alone.
4. With **separate explicit authorization** for the exact manifest SHA, an operator can supply `--approval-file /private/approvals/run.json --execute` on a machine enforcing egress. An approval record must contain `enabled:true`, `manifestSha256`, `generator`, `approvedBy`, `termsAndCheckpointsReviewed:true`, `noPaidGpuOrApi:true`. Environment requires `PUPSON_FACTORY_OS_NETWORK_BLOCKED=true` as operator attestation. *This switch is not itself an OS firewall.*
5. Run the existing Blender normalizer in inspect-only mode with real SKU W,H,D. After source run is approved and audited, write a **new** quarantined normalized GLB and `.review.json`. All assets should be physically upright Y-up in glTF with approved +Z front. Never use nonuniform stretching to conceal geometry problems.
6. Use `blender --background --python scripts/render_candidate_comparison.py -- --candidate /private/quarantine/your.glb --approved <repository-approved-glb> --out /private/quarantine/qa-your-id --render`. Compare front, side, back images on iPhone and in the current `Product3DEngine`. Run `scripts/audit_glb.py`, check UVs, surface normals, material fidelity, real supplier print zone, and verify a physical sample.
7. Retain raw source, normalized and screenshot SHA receipts; propose a **separate reviewed** commit modifying the `product3dModels` asset registry only after approval. No automatic promotion, live Printify mutation, checkout or public deployment.

## Acceptance definitions and next coding order

- **Done here:** deterministic source intake, source-only GPU execution integration, quarantine normalization and visual-comparison tooling, automated non-GPU safeguards.
- **Not done:** live catalog data, manufacturing sample, owned CUDA compute, actual Hunyuan/Unique3D inference, candidate GLB export, real Blender screenshots, human visual quality score, physical iPhone signoff and privacy-safe deployment.
- **Priorities:** real Printify tote SKU, licensed blank tote 3 views, controlled first local Hunyuan candidate; next hoodie with Unique3D comparison; then material/geometry improvement and print-zone certification. Do not activate the old unverified hosted Stable Fast 3D call as a fallback.
- **Release:** keep #1468 and parent #1465 as drafts until exact-head CI, manual visual review and separate owner-approved rollout. Do not substitute unit tests for Blender, model, GPU or physical proofs.

## Commands for CI evidence (no hardware or external calls)

```bash
python3 -m unittest discover -s scripts -p test_factory_generate.py -v
python3 -m unittest discover -s scripts -p test_normalize_generated_glb.py -v
python3 scripts/factory_baseline_review.py --product tote
python3 scripts/factory_baseline_review.py --product hoodie
```
