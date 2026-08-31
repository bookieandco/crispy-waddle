# AI POD Store

Independent general-purpose print-on-demand storefront powered by the same AI-generated-art capability used by PupsonStuff.

## Boundary

- This app owns the general POD customer experience, catalog, product composition, cart, checkout, and fulfillment.
- PupsonStuff remains a separate pet-focused store.
- Neither store owns the shared generation provider implementation.
- Generated artwork is the shared infrastructure boundary; store-specific product/domain behavior stays local to each app.

## Current slice

The first UI slice establishes the PupsonStuff-inspired visual language and the core journey:

`idea/photo -> style -> product -> generate -> preview`

Generation and fulfillment are deliberately not faked in this foundation pass. The next pass will connect the creation controls to the shared art-generation adapter and then add real product/mockup composition.

## Working name

`ai-pod` is an internal app/package name only. The public brand/name has not been chosen yet.
