# PUPSON-3D.FACTORY.PILOT.09–.11 — working prototype / acceptance handoff
**2026-10-22.** Reuses existing boutique `Product3DEngine`, source pack, SKU intake and QA. No storefront model replacement, actual Printify order, paid GPU, remote image provider, production deployment, or externally exposed test site.

## Truth table

| Item | Source completion | Real operational proof |
| --- | --- | --- |
| **.09 — first tote model** | Original CPU GLB exporter `scripts/pilot_tote_glb.py` serializes `procedural_tote_geometry.py` directly into GLB2 with one mesh/material, UV, normals, meter-scale Y-up positions, SHA receipt and no GPU. Runs inspect-only by default; `--write-quarantine` also requires successful source-pack validation and a manifest-bound separate export approval. | Synthetic reference dimensions **only** for isolated CI. No authenticated real Printify blueprint/provider/variant, manufacturer width/height/depth, licensed front/side/back photo pack or physical handle dimensions in this session. A vendor-ready GLB **cannot** be truthfully generated yet. |
| **.10 — visual/Printify comparison** | `scripts/pilot_tote_acceptance.py` inspects actual GLB bytes, one-mesh material and UV/normal presence, triangle/size limits, measured SKU error tolerance, six separately hashed local Blender screenshots, candidate SHA and manual signed checks for silhouette, print-area alignment, reference photos, physical sample and genuine Safari-on-iPhone. | Technical GLB tests can run; **no real candidate screenshots, print sample, licensed photos, or operator signoffs exist**. Status remains `NOT_APPROVED` until verified. |
| **.11 — private iPhone preview** | `scripts/prepare-3d-qa.mjs` only within guarded `CI=true` + `PUPSON_3D_QA_FIXTURE=yes` + preview-only mode creates `/qa-tote-pilot/` route and `/qa-pilot-tote.glb` fixture **in a temporary local CI build**. `qa-pilot-tote-iphone.mjs` loads the candidate and unchanged `/models/tote.glb` via existing `Product3DEngine` in iPhone WebKit viewport, takes front/side/back captures, checks canvas and tap controls, requires read-only API policy, and confirms candidate≠approved hash. | **Not** a deployable/public/remote preview link, physical-device signoff or proof on actual iOS Safari. No durable preview route or synthetic model is committed to the app bundle. Deployment and external exposure still require separate owner approval. |

## Exact commands / safety

Real product path, only after a vendor-backed physical specification pack and separate export consent:

```bash
cd apps/pupsonstuff
python3 scripts/pilot_tote_glb.py \
 --pack /private/source-packs/tote \
 --output /private/quarantine/tote-measured-01.glb

# If source evidence is complete, a separate approval JSON matching the
# exact manifest SHA may authorize a quarantined export:
python3 scripts/pilot_tote_glb.py --pack /private/source-packs/tote \
 --output /private/quarantine/tote-measured-01.glb \
 --approval-file /private/approvals/tote-cpu.json --write-quarantine

blender -b --python scripts/render_candidate_comparison.py -- \
 --candidate /private/quarantine/tote-measured-01.glb \
 --approved public/models/tote.glb \
 --out /private/quarantine/tote-measured-01-screenshots --render

python3 scripts/pilot_tote_acceptance.py \
 --pack /private/source-packs/tote \
 --candidate /private/quarantine/tote-measured-01.glb \
 --comparison /private/quarantine/tote-measured-01-screenshots
```

GLB export cannot be unlocked merely by running it with fixture data. A pretend `printify-catalog.json` is not authoritative proof of Printify live data. Production model promotion is a **separate** human release workflow not implemented here.

CI-only integration, never outside isolated temporary checkout:

```bash
python3 -m unittest discover -s apps/pupsonstuff/scripts -p test_pilot_tote_glb.py -v
python3 -m unittest discover -s apps/pupsonstuff/scripts -p test_pilot_tote_acceptance.py -v
# GitHub Actions pupsonstuff-mobile-browser-qa runs guarded preparation,
# local Next build, Linux WebKit iPhone viewport + product screenshot suite.
```

The visible pilot route is explicitly watermarked *SYNTHETIC CI-ONLY GEOMETRY — NOT A REAL PRINTIFY SKU*. Candidate resides at `public/qa-pilot-tote.glb` **only while the temporary CI checkout exists**. The file and route are never committed and are not present in an ordinary app build. The code does not create any public website, private host, Cloudflare deployment or live purchase endpoint.

## Mandatory next external steps

1. Authenticate the intended Printify catalog API on a trusted operator host; identify exactly which blank tote product + provider + variant will actually be sold, without guessed IDs.
2. Obtain manufacturer's 3D physical W/H/D, body height, handle drop, strap width/thickness and stitch/handle placement; licensed front/side/back references. Sign off on model/commercial source rights.
3. Complete original source-pack manifest and QA receipt; run the fully evidence-gated offline GLB export in quarantine.
4. Render the actual candidate six angles versus current verified GLB. Assess material fidelity, handle topology, UV / front-only print placement against real supplier print area, manufacturer sample, and manually signed visual/physical quality.
5. Confirm protected preview auth/session gates; **separately approve** a private hosted iPhone rollout, only then gather physical device screenshots/tap feedback. This source-only CI WebKit proxy does not replace actual Safari device QA.
6. Merge reviewed parent [#1465](https://github.com/bookieandco/crispy-waddle/pull/1465) before stacked [#1468](https://github.com/bookieandco/crispy-waddle/pull/1468) after exact-head green CI and separate review. Merge does not authorize live site deployment, Printify mutations or payment.

## Release policy

**Source implementation status:** the coding path exists. **Physical SKU readiness:** BLOCKED. **Actual product quality certification:** NOT APPROVED. **Private hosted iPhone deployment:** NOT EXECUTED. Preserve original photo `public/boutique.png`, showroom positions, GLBs, model registry and canonical print master until deliberate product-level signoff. Keep drafts unmerged until review.
