# AI POD Store

Independent general-purpose AI merchandise storefront.

## Boundary

- This app consumes shared AI-generated artwork.
- PupsonStuff remains a separate pet-focused store.
- This app does not inherit PupsonStuff branding, domain logic, or catalog.
- The shared generation capability is the only AI-art dependency between the stores.

## Store-owned capabilities

- product discovery and merchandising
- AI artwork composition into products
- interactive 3D product preview
- product variants and print-area selection
- cart and checkout UX
- fulfillment orchestration

## 3D product engine boundary

Product definitions should expose a renderer-neutral contract containing:

- product type
- model/geometry reference
- materials
- printable surfaces
- print transforms
- dimensions
- variant options
- camera presets

The storefront can use React Three Fiber/Three.js, but product definitions should not be coupled to a particular renderer.

## Printify boundary

Printify should be implemented behind a catalog/fulfillment adapter rather than embedded throughout the UI.

The adapter will eventually normalize:

- shops
- products
- blueprints
- print providers
- variants
- pricing
- shipping
- availability
- production estimates
- order creation
- order status

The storefront consumes normalized commerce data and does not depend on Printify-specific payload shapes.

## Target flow

`idea/photo -> shared AI art -> creative asset -> product selection -> 3D composition -> variant/provider selection -> cart -> checkout -> fulfillment`

This pass defines the boundaries only. It does not fake Printify credentials, live catalog data, checkout, or fulfillment.
