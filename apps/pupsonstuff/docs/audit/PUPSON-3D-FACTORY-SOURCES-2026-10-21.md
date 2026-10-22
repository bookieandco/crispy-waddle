# PupsonStuff 3D Asset Factory — Meshy and TRELLIS source audit

**Scope:** Incremental extension of the existing PupsonStuff Product3DEngine and approved GLB asset pipeline. **No generator invocation, server, paid request, new GPU, customer-image upload, GLB replacement, registry activation, or deployment.**

## Verified references

| Provided link | What actually exists | Integration disposition |
| --- | --- | --- |
| [meshy-dev/Meshy-guide](https://github.com/meshy-dev/Meshy-guide) | MIT-licensed documentation/tutorial repository, **not** a local model, rendering engine, or free API server | Use workflow concepts only; official live [Image-to-3D](https://docs.meshy.ai/en/api/image-to-3d) and [pricing](https://docs.meshy.ai/en/api/pricing) take precedence over README |
| [Trellis-3d/Trellis-3D](https://github.com/Trellis-3d/Trellis-3D) | One 735-byte personal introduction README, no runnable image-to-3D code, no repo license | **Do not treat as a TRELLIS runtime or clone/execution source** |
| [microsoft/TRELLIS](https://github.com/microsoft/TRELLIS) | Actual research image-conditioned 3D generation + textured GLB export using `postprocessing_utils.to_glb`; MIT with separately licensed subcomponents | Future operator-owned private Linux/NVIDIA GPU source adapter; official prerequisites >=16 GB VRAM |
| [microsoft/TRELLIS.2](https://github.com/microsoft/TRELLIS.2) | Newer image-conditioned reconstruction with rich surface materials, open surfaces; MIT core with separately licensed dependencies | Evaluate for higher-fidelity fabrics **later**; official prerequisite >=24 GB NVIDIA GPU |

The supplied Meshy guide claims a free API/test workflow and identifies Meshy 6, but currently published developer documentation says personal API keys require a paid plan; free accounts can try the built-in Playground only. Live Image-to-3D docs show an `/openapi/v1/image-to-3d` asynchronous task and current model identifiers including `meshy-7.1`. Do not hardcode guide pricing, make calls based on a documentation dummy key, or assume unlimited/free API rights.

**Licenses:** MIT for code/documentation does **not** automatically license Meshy-generated assets, inputs, checkpoints, other model weights, third-party submodules or customer's photo. Record actual grant/provenance/terms for each candidate. Verify consent and retention before any optional third-party upload. Prohibit external customer-photo submission by default.

## Existing architecture — don't duplicate it

```
Operator-supplied, license-vetted real product reference photographs
        |
        v
existing Jhadina Director 3D backend profiles (capability/licensing authority)
        |
        +-- Meshy cloud API [external cost + disclosure + rights approval]
        +-- microsoft/TRELLIS [operator-owned GPU + model/license audit]
        +-- microsoft/TRELLIS.2 [more demanding GPU + dependency audit]
        +-- existing Stable Fast 3D/Hugging Face experiment [not live-certified]
        |
        v
assets/needs-review/ <--- quarantine only, never assets/approved/
        |
        v
lib/product3d/candidate-intake.ts
  - verifies GLB header, JSON/BIN, SHA-256, no external fetch, one mesh/
    material for CURRENT single-mesh viewer, normals/UV, triangle/byte budget
  - checks proposal carries photo and generated-asset rights and consent evidence
  - always returns storefrontApproved=false, needsHumanReview=true
        |
        v
existing scripts/audit_glb.py technical audit + screenshot matrix
        |
        v
human references: physical silhouette, colors, views, geometry,
print area and production vendor template
        |
        v
explicit approved asset promotion / hash update under separate owner review
        |
        v
existing Product3DEngine + product3dModels + 2D print-master authority
```

**Generation is upstream of the product viewer**, never the 3D viewer's own runtime feature. Product data and Printify catalog authority stay separate. The existing `packages/director-core/src/world-3d-backend-profile.ts` evaluates general generative-model capabilities/licensing; PupsonStuff's candidate guard checks product-specific binary intake and **does not create a second execution provider router**.

## Evidence-based priority

1. First close model rendering/angle and front-only decal QA in [PR #1441](https://github.com/bookieandco/crispy-waddle/pull/1441), reconcile with [parent PR #1427](https://github.com/bookieandco/crispy-waddle/pull/1427) and failing full release checks. Do not activate generation to disguise material or camera bugs.
2. Candidate replacement priority: **tote**, then **hoodie** (blocky tote + paper-thin apparel side silhouette in synthetic browser screenshots); mug and bottle need vendor dimensions and front-graphic print zone verification before replacing geometry. Preserve every approved GLB byte-for-byte until certified replacement.
3. Run small *source-only* candidate evaluation against legally usable product reference images, no real customer pet photos. Prefer comparing a vetted candidate against approved original in front/side/rear screenshots before making any operator spend/compute decision.
4. Operator must explicitly authorize any Meshy API use, GPU creation/billing, model download or sensitive photo processing. `MESHY_API_KEY` is a credential, **not** spending approval. No service exists merely because this file lists it.
5. For each candidate, collect rights, hash, provenance, texture sizes, topology, normalized pivot/orientation, mobile GLB size and triangle count, GLB screenshot, product sample reference and exact approved print zone. Mark as `NEEDS_REVIEW` unless **both** technical and visual/print gates pass.
6. A future full-function preview needs a separate private host and owner-approved secrets/consent flow. The public Cloudflare view-only preview is not one.

## Explicit non-goals of this sequence

- No import of the misleading `Trellis-3d/Trellis-3D` repo as an inference runtime.
- No browser, iPhone, Cloudflare Worker, Next.js request thread or client-side running of TRELLIS CUDA models.
- No copy of Microsoft research code into production Next.js.
- No promotion merely because a binary technically loads, or because a marketing guide says a generated model is commercial/print ready.
- No assumed camera/framing fix for fundamentally wrong physical model geometry.

**Evidence status:** Quarantine guard and synthetic tests are source-level only until exact-head CI passes. A valid candidate guard does not establish any actual Meshy or TRELLIS execution or production asset approval.
