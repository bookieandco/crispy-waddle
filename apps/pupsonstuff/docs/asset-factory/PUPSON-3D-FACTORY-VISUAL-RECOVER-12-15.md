# PUPSON-3D.FACTORY.VISUAL-RECOVER.12–.15
**2026-10-22 — draft factory branch only. No real manufacturer model, merchant SKU, rendered/signed sample or hosted private preview commissioned.**

## Why this pass exists

The successful synthetic WebKit QA on commit `80ff7110424b8a87ea3612330e9432cd684a7d83` proved that the existing `Product3DEngine` can load and rotate a separate CPU-generated tote GLB. It **did not prove photorealism or physical fidelity**. Manual review showed a flattened-looking body, minimal hem definition and coarse-looking doubled straps.

The subsequent `fa24a8ebb345f3d804053a0e5a736f527e5ccb08` commit reported 4 green workflows; Mobile Browser QA was **cancelled**, not passed. That head must not be called 5/5.

## .12 — Physical size and supplier scope

Keep [issue #1476](https://github.com/bookieandco/crispy-waddle/issues/1476) open: the connected PupsonStuff catalog currently has no exact tote variant. The Printify public S&S 42795 dimensions are one reference, **not** selected API blueprint/provider/variant IDs or a complete physical gusset/handle description. The `assemble_tote_source_pack.py` fail-closed tool remains the sole path for source package preparation, requiring matching IDs, 3D depth evidence, licensed views, and measurement/rights hashes.

## .13 — Fix preview geometry, not measured product data

`scripts/procedural_tote_geometry.py` now constructs a lightly tapered, softly draped canvas body with a **folded inner hem**, two inset straps anchored below the top rim, and four reinforcement overlays. The fabric-wave heights are stylized until reviewed against the actual supplier blank. Strap placement is constrained to the supplier depth envelope rather than silently adding bulk. These enhancements do **not** constitute real seam stitching, watertight manifold topology or an approved physical pattern.

The previously mismatched Blender output material name is standardized to `tote_material` so the GLB audit and the existing viewer both recognize it. No shader/textures are invented or copied from a supplier.

## .14 — Protect the generated-asset contract

The new deterministic CPU tests enforce:
- One candidate geometry with folded rim, 2 straps, 4 reinforcing panels.
- Finished geometry stays close to recorded physical size, including a thin-tote fixture.
- Finite 0–1 UV arrays, GLB browser compatibility and unchanged false approval indicators.
- Blender exporter material name `tote_material` matching the standard-library GLB serializer.
- Original approved GLBs and boutique are not written, and candidate stays in CI-only synthetic path or private quarantine.

Current tests are **contract tests, not real photo comparisons**. The six-angle mobile WebKit comparison is for browser functionality. Real Blender front/side/back against a manufacturer blank, true print-zone alignment, licensed source rights, physical printed sample, and real iPhone Safari remain independent manual gates.

## .15 — Actual release sequence

1. Reconcile latest `#1468` head GitHub CI and check any cancelled/failed job against its exact source SHA; do not reuse green checks from another head.
2. Once genuine Printify manufacturer/source paperwork and the matching selected variant exist, complete private source-pack assembly. Generate a **new**, never-overwriting quarantined candidate under manifest-SHA operator approval.
3. Render six real Blender views and compare photorealism, handle attachment, bag fold, front and back print UVs and product scale. Record all missing acceptance fields as BLOCKED until an owner certifies a printed sample.
4. Only with independent explicit approval, arrange a **dedicated protected PupsonStuff deployment** (not the current Jhadina Vercel project). Prove anonymous access denied, no paid API/checkout/Printify mutations, and touch-test a real iPhone before any storefront swap or live release.

**Code committed into existing PR #1468; no main merge, checkout change, sample order, paid model processing or preview deployment.**
