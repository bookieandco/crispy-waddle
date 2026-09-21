# SH supplier / storefront / fulfillment reference audit

Date: 2026-09-21
Branch: feat/sh-recon-dropshipping-certification

References:
- wfgsss/dhgate-scraper-example
- wfgsss/pinduoduo-scraper-example
- RyanAwex/DropshippingStore
- qq773901406-cmd/shop-dropshipping-automation
- Supliful
- ShipEngine

## Executive disposition

These references strengthen the existing SH architecture, but they belong in different layers.

- DHgate: HIGH VALUE read-only supplier discovery / price-monitoring reference.
- Pinduoduo: REFERENCE ONLY; current repo evidence says login is mandatory and robots.txt disallows automated access.
- RyanAwex/DropshippingStore: STOREFRONT/UI REFERENCE ONLY; useful React/Supabase cart/product/order/dashboard patterns, not a new Commerce authority.
- shop-dropshipping-automation: WORKFLOW REFERENCE; useful daily product-research -> creative -> publishing pipeline, but cookie/profile browser automation must not become Jhadina's canonical Social connector.
- Supliful: HIGH VALUE live-provider candidate for private-label branded wellness/pet/beauty products.
- ShipEngine: HIGH VALUE fulfillment/logistics candidate, but it is parcel-shipping infrastructure, not a supplier or local courier fleet.

## 1. DHgate scraper

Observed useful fields:
- keyword search + pagination
- product title / item code
- price range
- minimum order
- seller identity/store
- seller level
- positive feedback percentage
- free-shipping flag
- sponsored/ad flag
- product/store URLs
- ship-to-country filter
- sort by price/orders/newest

Correct placement:
Supplier discovery / Competitive Intelligence -> observed facts -> Opportunity research.

Important limitation:
The scraper does not prove routable inventory quantity, reliable shipping cost, delivery SLA, or supplier-risk truth sufficient for governed procurement. Therefore raw DHgate search rows should not be promoted directly into SupplierOfferSnapshot unless a later enrichment step verifies the routing-required facts.

Recommended future boundary:
DhgateSupplierDiscoveryAdapter
-> observed supplier/product evidence
-> enrichment
-> SupplierOfferSnapshot only after inventory/delivery/cost facts are verified.

No purchasing or account mutation should be copied from a scraper.

## 2. Pinduoduo scraper

The repository's own test results say:
- search/detail/share pages redirect to login;
- mobile H5 requires phone/SMS or app login;
- no guest browsing;
- internal endpoints require signatures;
- robots.txt disallows automated access.

Disposition:
Do not build a Jhadina Pinduoduo scraper or anti-bot bypass from this reference.

Useful only as:
- market taxonomy reference;
- Chinese keyword / product trend research concept;
- candidate for future authorized/public-data integration if a legitimate supported surface exists.

Do not adopt:
- residential-proxy evasion;
- session/cookie circumvention;
- API reverse engineering to bypass access controls.

## 3. RyanAwex/DropshippingStore

The repo is a React/Vite/Supabase storefront with:
- Home
- Shop
- Product
- Cart
- Checkout
- Auth/Profile
- Dashboard
- product/cart/order Zustand stores

Useful:
- UI flow reference;
- dashboard information architecture;
- catalog/cart/checkout UX ideas.

Do not import wholesale:
Jhadina already has Commerce, checkout/payment, identity, durable order, and PupsonStuff/product-store work. This repo must not become a second cart/order/auth authority.

Potential use:
Compare its storefront UX against General AI POD/PupsonStuff and harvest isolated UI ideas only.

## 4. shop-dropshipping-automation

Strong reusable workflow idea:

scheduled trigger
-> product-selection analysis
-> supplier comparison
-> pricing/profit sheet
-> creative/video script
-> bilingual publishing copy
-> asset collection
-> product-card generation
-> multi-channel publishing
-> daily report

This maps cleanly to:

Opportunity / Competitive Intelligence
-> Supplier research
-> Money economics
-> DirectorOS / Creative
-> Growth / Social
-> governed publish actions
-> Attribution
-> Opportunity learning.

Useful concepts:
- daily product research batches;
- per-product evidence packet;
- supplier comparison artifact;
- pricing sheet;
- video scripts;
- multilingual copy;
- product cards;
- aggregated daily report;
- multi-platform publishing plan.

Reject as canonical execution:
- CloakBrowser/anti-detection as a Jhadina platform strategy;
- persistent browser fingerprints;
- saved-cookie automation as the primary social integration;
- automatic publication without Action Core policy/approval;
- claimed profit/sales figures without evidence.

Jhadina should prefer official APIs/connectors and use Computer/Browser automation only when allowed and necessary.

## 5. Supliful

Current official material describes Supliful as private-label/white-label brand infrastructure for wellness, beauty and pet-care products, with fulfillment handled behind the brand.

Important current integration finding:
Supliful documents a custom-app route through Shopify Admin API:
custom/proprietary storefront
-> server-side Shopify Admin API
-> Shopify order/product mapping
-> Supliful fulfillment service
-> fulfillment/order webhooks.

That is highly compatible with Jhadina's architecture.

Correct placement:

Opportunity
-> private-label product research
-> Commerce catalog/product identity
-> brand/label asset workflow
-> Shopify channel adapter
-> governed customer order
-> Supliful fulfillment
-> shipment/tracking events
-> Money actuals
-> Brand Exit Readiness.

Why it is strategically valuable:
It directly supports the build-to-exit strategy:
- branded labels rather than generic packaging;
- supplier/fulfillment abstraction;
- repeat-purchase consumables;
- lower founder workload;
- transferable operating system;
- product mockups and brand assets.

Important boundaries:
- do not hard-code Supliful marketing margin or valuation claims;
- health/supplement claims need their own compliance/policy controls;
- product, variant and Shopify IDs need canonical internal mapping;
- automatic fulfillment still needs durable order/reconciliation truth;
- live credentials and empirical order testing are required before live certification.

Recommended provider status:
LIVE_PROVIDER_CANDIDATE, not live yet.

## 6. ShipEngine

ShipEngine currently supports:
- carrier rate shopping;
- label purchasing;
- tracking;
- webhooks;
- carrier connections;
- manifests/batches;
- international shipping data;
- shipping rules.

Architecture finding:
ShipEngine is NOT a SupplierProcurementAdapter.
ShipEngine is NOT a CourierFleetAdapter.

The existing CourierFleetAdapter models local driver dispatch/custody:
merchant -> assigned courier -> handoff -> local delivery.

ShipEngine models parcel shipping:
shipment/package
-> rate quote
-> carrier/service selection
-> label purchase
-> tracking events
-> optional void/refund.

Therefore Jhadina has a real missing abstraction:

ParcelShippingAdapter

Suggested future contract:
- getRates()
- purchaseLabel()
- voidLabel()
- track()
- registerTracking()
- normalizeWebhook()
- optional createManifest()

Canonical owner:
Commerce / Order Fulfillment.

Action governance:
- rate reads: read-only
- label purchase: financial/consequential action
- void label: consequential/refund-like action
- carrier-rule updates: governed configuration mutation

Money:
actual postage/adjustment/insurance costs feed Money Core.

Fulfillment:
tracking webhooks update durable shipment state.

## Combined supplier / fulfillment topology

Supplier discovery:
1688
DHgate
future authorized sources
       |
       v
Opportunity evidence / Competitive Intelligence
       |
       v
verified SupplierOfferSnapshot
       |
       v
deterministic routing
       |
       v
Commerce procurement preview
       |
       v
Action Core approval
       |
       v
SupplierProcurementAdapter
       |
       +--> conventional supplier / marketplace
       |
       +--> Supliful via Shopify fulfillment path
       |
       v
Order Fulfillment
       |
       +--> provider-managed shipping/tracking
       |
       +--> ParcelShippingAdapter -> ShipEngine/carriers
       |
       +--> CourierFleetAdapter -> local courier fleet
       |
       v
tracking / delivered / exceptions
       |
       v
Money + Attribution + Opportunity outcome learning

## Priority

HIGH
1. Supliful provider feasibility / Shopify mapping audit.
2. ParcelShippingAdapter contract, with ShipEngine as the first reference provider.
3. DHgate read-only discovery/evidence adapter.
4. Daily product-research packet + Growth/Director handoff inspired by shop-dropshipping-automation.

MEDIUM
5. Storefront UX comparison against RyanAwex/DropshippingStore.

REFERENCE ONLY
6. Pinduoduo until an authorized supported data surface exists.
7. Browser/cookie anti-detection publishing implementation.
