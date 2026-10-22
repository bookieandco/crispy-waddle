# PUPSON-3D.FACTORY.REAL-PACK.CERTIFICATION.DEPLOY — audited handoff
**2026-10-22 — supplier selection and real-world certification remain blocked.**

## 1. What is newly grounded

Official public Printify candidate:
- [Natural Tote Bag — S&S Bags 42795 (Printify)](https://printify.com/app/products/1090/s-and-s-bags/natural-tote-bag). Listed supplier is S&S Bags; listed print provider is Duplium (CA) with front and back printing. This is **a public catalog listing**, not proof of the exact product/variant in the owner's Printify shop.
- Manufacturer size guide: **15.00 in body width; 15.98 in body height; 0.39 in listed flat bag thickness; 9.50 in handle drop; 20.50 in handle length; 1.26 in handle width**.
- Converted reference dimensions are **381.0 mm body width**, **405.892 mm body height**, **9.906 mm listed flat bag thickness**, **241.3 mm handle drop**, **520.7 mm handle length**, **32.004 mm handle width**, and **647.192 mm derived body + drop height**. *Derived, not a Printify measured overall-height field.* Printify's 'bag thickness' must not be substituted for **strap thickness**.
- Durable public dimension/source facts, plus explicit unknowns, are stored in `source-packs/tote.SS42795.public-reference.json`. `tote.manifest.template.json` cross-references the public facts but intentionally leaves actual shop SKU/IDs and execution-critical dimensions empty. No remote supplier pictures or secrets were committed.

## 2. What must exist to complete the REAL offline pack

- Exact shop catalog `blueprintId`, `printProviderId`, `variantId` and actual `supplierSku`, returned by the **authenticated, typed read-only** Printify catalog commands. Page URL segment `1090` must **not** be relabeled as an authenticated API blueprint ID.
- Local `printify-catalog.json` SHA-256 receipt with printed positions/pixel placeholders associated with the selected SKU.
- A rights-cleared, supplier/model-consistent three-angle **blank** reference image pack (front, side, back) with SHA-256s. Public Printify gallery visibility does not itself grant external model-generation or redistribution rights. Do not include those photos/customer images in public GitHub.
- Supplier confirmed handle anchor spacing and strap thickness, print-zone **physical** location/proportions, body/handle measurement interpretation, sample and rights evidence. Supplier's flat-bag-thickness value does not necessarily describe the loaded bag's gusset depth.
- Operator-completed `manifest.json` in a **private** folder that actually passes `factory_source_pack.py --for-execution`. This public branch contains no such complete pack and must **not** claim `prepared:true`.

## 3. Six-view QA: technical vs manufacturing

The existing `render_candidate_comparison.py` remains the canonical **Blender** six-shot comparison (approved front/side/back + candidate front/side/back). Real certification requires a quarantined real-SKU model, a locally available Blender runtime, comparison images and review/signoff.

The local CI browser workflow now additionally captures **six Linux WebKit iPhone-viewport screenshots** (three of the synthetic CPU candidate plus three of the unchanged approved baseline) and writes `pilot-tote-six-view-UNCERTIFIED.receipt.json` with hashes and explicit non-certification fields. Those automated WebKit screenshots do not substitute for a real Blender-rendered physical-variant comparison, actual iPhone touch test, photo license, print zone or printed sample. The images and JSON exist only in a temporary CI artifact, not in the deployed app.

`pilot_tote_acceptance.py` always returns `NOT_APPROVED` when the private source pack, physical sample, screenshot evidence or owner-signed approvals are missing. No auto-promotion.

## 4. Private iPhone deployment authorization and account proof

The connected Vercel account was **inspected read-only** on 2026-10-22:
- Team `bookieandcos-projects` plan hobby, existing Git-connected project `crispy-waddle-jhadina-web` (ID `prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco`).
- Searching the current Vercel account for project name `pupson` returned **zero** matching projects.
- Some Vercel previews of the Pupson source branch were automatically initiated under the *Jhadina web* project, but the observed ones were canceled. Those are **not** a standalone protected PupsonStuff website or evidence of the real 3D product being privately visible.
- Do not repurpose the Jhadina project or assume a generated `.vercel.app` URL is access-protected. A separate Pupson project, explicit Authentication/Deployment Protection, anonymous-denied test, read-only checkout lock, exact commit SHA and a physical iPhone signoff are mandatory.
- **No approval to create a new external Vercel project, deploy the Pupson branch, incur fees, buy samples, replace storefront assets or sign into the owner's supplier account has been exercised here.** Future private deployment requires the owner to separately authorize the dedicated target and access protection after acceptance.

## 5. Operator-only sequence after external inputs exist

```bash
# Never commit a Printify token or real supplier photo pack into public GitHub.
cd apps/pupsonstuff
pnpm printify:sku3d --product tote --blueprint REAL_ID --provider REAL_ID --variant REAL_ID \
  > /private/source-packs/tote/printify-catalog.json
sha256sum /private/source-packs/tote/printify-catalog.json
python3 scripts/factory_source_pack.py --pack /private/source-packs/tote --for-execution
# The next command is only permitted with an independent exact-manifest
# approval receipt and after all source packs and rights passed:
python3 scripts/pilot_tote_glb.py --pack /private/source-packs/tote \
  --output /private/quarantine/tote-measured-01.glb \
  --approval-file /private/approvals/tote-cpu.json --write-quarantine
# Local Blender required; this step is intentionally NOT executed without
# a real model and correct references.
blender -b --python scripts/render_candidate_comparison.py -- \
  --candidate /private/quarantine/tote-measured-01.glb \
  --approved public/models/tote.glb \
  --out /private/quarantine/tote-measured-01-qa --render
python3 scripts/pilot_tote_acceptance.py \
  --pack /private/source-packs/tote \
  --candidate /private/quarantine/tote-measured-01.glb \
  --comparison /private/quarantine/tote-measured-01-qa
```

These CLI arguments `REAL_ID` are not working IDs; they need the exact verified catalog result before invocation. Do not fill approval JSON from automatic scripts or synthetic test fixtures.

## 6. State and next dependency

- Source infrastructure and **synthetic six-view browser QA**: implemented, CI evidence required at exact new branch head.
- Public product specifications: sourced and preserved, not enough to attest merchant SKU/full geometry.
- Real-SKU `manifest.json`: **incomplete / blocked**.
- Real generated tote, Blender six-view renders, physical sample: **not done**.
- Private dedicated Pupson deployment on iPhone: **not done / separate owner approval required**.
- Preserve draft PR [#1468](https://github.com/bookieandco/crispy-waddle/pull/1468) stacked on [#1465](https://github.com/bookieandco/crispy-waddle/pull/1465), original boutique image, original product GLBs, canonical print master, commerce and privacy gates.
