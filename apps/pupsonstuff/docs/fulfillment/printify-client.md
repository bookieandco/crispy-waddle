# Printify Fulfillment Client

`lib/printify.ts` — a second fulfillment-provider client, alongside the
Printful account this project actually ships against today. Not a
redesign of the existing fulfillment schema: `data/hotspots.ts` already
typed `FulfillmentProvider` as `"printful" | "printify"` and said
outright that this would come "later, without touching any component" —
this is that later.

## Source of truth

Built directly from Printify's own OpenAPI 3.0.3 spec (user-supplied
file, not the public docs site paraphrased from memory) — every
endpoint path, the `Bearer` auth scheme, query param names (`limit`,
`page`, `status`, `sku`, `show-out-of-stock`), and request/response
shapes in `lib/printify.ts` are transcribed from it directly.

## What's implemented

| Area | Functions |
|---|---|
| Shops | `listShops`, `disconnectShop` |
| Catalog | `listBlueprints`, `getBlueprint`, `listPrintProviders`, `getPrintProvider`, `listPrintProvidersForBlueprint`, `listVariants`, `getBlueprintShipping` |
| Uploads | `listUploads`, `getUpload`, `uploadImage`, `archiveUpload` |
| Products | `listProducts`, `getProduct`, `createProduct`, `updateProduct`, `deleteProduct`, `publishProduct` |
| Orders | `listOrders`, `getOrder`, `submitOrder`, `cancelOrder`, `sendOrderToProduction`, `calculateShipping` |

**Not implemented**: Webhooks (create/modify/delete/simulate) and the V2
per-variant shipping endpoints from the spec — nothing in this app
subscribes to Printify webhooks or needs per-variant V2 shipping yet.
Add them the same way (spec → typed function) if that changes.

## Auth

`Authorization: Bearer <PRINTIFY_API_KEY>` on every request — confirmed
from the spec's `bearerAuth` security scheme. This is a genuinely
different convention from Muapi.ai's client (`lib/muapi.ts`), which uses
a custom `x-api-key` header — don't assume providers share a pattern.

Every products/orders/uploads endpoint is scoped to one shop
(`/v1/shops/{shop_id}/...`) — there's no "current shop" concept in the
API itself, so `lib/printify.ts` takes `shopId` as a parameter on every
shop-scoped function rather than reading an env var internally. Find a
real shop ID via `listShops()`.

## Real gap: not wired into any route yet

This is a standalone client — same starting point `lib/ai.ts`,
`lib/animation.ts`, and `lib/muapi.ts` all had before their own
`app/api/*` routes existed. There is no `app/api/fulfillment/*` route
calling this yet, and there's a real reason beyond "not built yet":
PupsonStuff has no cart/checkout system (see `data/mockOrders.ts`'s own
header and the README roadmap's Milestones 5–6) — there's no real order
object anywhere in this app to hand to `submitOrder()`. Wiring this in
for real is downstream of that work, not a parallel task that can be
finished independently.

**Update**: that catalog-browsing next step is now built —
`scripts/printify-catalog-sync.ts` (`npm run printify:sync`) does the
blueprint/provider/variant discovery and produces a dry-run mapping
report (`docs/fulfillment/catalog-mapping-report.{md,json}`). It still
doesn't write to `data/hotspots.ts` — applying its findings to real
`blueprintId`/`printProviderId`/variant values in that file is a
deliberate separate step, done by a human after reviewing the report,
not automated here. See that report and the Milestone 8.1 README entry
for what it actually found (currently: nothing, since this environment
has no `PRINTIFY_API_KEY` — see the report's own header for why).

## Untested against a live key

No network access to `api.printify.com` from the sandbox that wrote
this — same honest caveat as every other external API integration in
this project. Treat the first real call as a test: confirm the response
shapes in `lib/printify.ts` still match Printify's current API (external
APIs do change) before trusting this in production.

## One spec detail worth flagging, not silently "fixed"

The spec's `show-out-of-stock` query parameter is defined with a
trailing space in its literal `name` field (`"show-out-of-stock "`),
which reads like a typo in Printify's own spec. `listVariants()` sends
the trimmed, sane key (`show-out-of-stock`). If a live call ever proves
the literal trailing-space key is actually required by the real API,
that's a genuinely surprising finding worth confirming rather than
assuming this guess was right.
