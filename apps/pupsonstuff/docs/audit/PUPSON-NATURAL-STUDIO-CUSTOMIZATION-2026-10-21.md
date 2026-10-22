# Natural product studio and customization audit

Original work October 21, 2026. Reconstructed after the transient workspace was cleared before the blocked push. This replacement commit is not the missing ee3a72b496ee commit; checks are rerun before pushing. No deployment, provider call, order or payment is authorized by the push.

## Changes preserved

Existing hotspot-to-product registry, boutique photo and approved GLB bytes preserved. Local softbox environment, ACES, distinct material finishes, cloned materials, node transforms, mobile DPR cap, angled/front/back/detail views, drag/pinch and deliberate rotation controls. Pillow node carries 0.01 scale and an X/Z broad face; corrected runtime multiplier/orientation and decal position. Bottle inward winding corrected on a private runtime copy with smooth normals. Rounded thinner canvas. Black hoodie tint enabled without mutating shared cached materials.

Artwork aspect and clockwise rotation aligned with editor. Print-area aspect comes from the selected product profile. Magnetic bounds account for rectangular areas and rotated artwork. Touch drag keeps grab offset; keyboard placement supported. Browser-safe profile extracted from Sharp server module.

## Remaining customization and Printify work

- Profiles still use generic dimensions and labels. Certify exact blueprint/provider/variant dimensions, safe area, bleed and sides.
- Projected mug/bottle artwork is a visualization, not calibrated UV wrap or handle/seam certification.
- Cart references a creative output whose print_asset_id can change on reapproval. Freeze immutable approved asset/version/hash per line.
- Show the actual composed print-master PNG for final customer proof confirmation.
- Preserve owner, variant, quality and sample_verified live gates. No current live mapping/database/sample state revalidated.
- Stripe checkout needs destination shipping, margin checks and the chosen tax treatment.
- Verify provider approval, production and tracking transitions; submitted order ID alone does not establish fulfillment.

Prior turn: 140 tests and production build passed; seven model families fixture-rendered at 430x860. Browser inspection caught pillow/bottle defects and fixed versions were visually checked. Those historical screenshots were cleared with the workspace. Reconstruction validation is recorded in the completion response; do not treat historical browser evidence as a fresh render of this replacement commit. No physical iPhone or manufacturing certification granted.

Reconstruction checks: 140 tests across 28 files pass. Asset-integrity checker passes all original image/model pairs. Type-check occurs in the production build. Initial build compiled and generated all pages but hit an ENOTEMPTY cleanup error; a clean-cache build was run separately. No fresh browser/render or provider certification is claimed.

Clean-cache production build: PASS, including TypeScript, static generation and build traces.
