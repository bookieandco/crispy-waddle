# PupsonStuff POD Core

Pipeline:

1. Customer uploads pet photo.
2. AI generates customized artwork.
3. Artwork receives a server-side quality report.
4. Product-specific print profile determines DPI and print-area requirements.
5. Product mockup/3D preview uses the same creation.
6. Production artwork is kept separate from the visual preview.
7. Only a `productionReady` asset should proceed to provider fulfillment.
8. Printify is behind a provider adapter so the storefront does not depend on provider-specific APIs.

The current quality gate is deterministic and intentionally conservative. AI-based blur, pet detection, artifact detection, transparency, and color checks can be added as separate analyzers without changing the gate contract.
