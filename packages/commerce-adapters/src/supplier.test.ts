import assert from "node:assert/strict";
import {
  Supplier1688SourcingAdapter,
  assertSupplierProcurementPreview,
  routeSupplierOffers,
  supplierProcurementIdempotencyKey,
  type SupplierOfferSnapshot,
} from "./index";

const base: SupplierOfferSnapshot = {
  provider: "fixture",
  connectionId: "conn-a",
  supplierId: "supplier-a",
  productId: "product-a",
  inventoryId: "inventory-a",
  title: "Fixture",
  externalProduct: { provider: "fixture", externalId: "offer-a" },
  unitAmountMinor: 500,
  shippingAmountMinor: 200,
  currency: "USD",
  availableQuantity: 10,
  estimatedDeliveryDays: 5,
  supplierRiskScore: 0.2,
  destinationCountries: ["*"],
  observedAt: "2026-09-21T00:00:00.000Z",
};

const routed = routeSupplierOffers(
  {
    quantity: 2,
    destinationCountry: "us",
    currency: "usd",
    candidates: [
      { ...base, supplierId: "supplier-slow", productId: "slow", inventoryId: "slow", estimatedDeliveryDays: 8, unitAmountMinor: 400 },
      { ...base, supplierId: "supplier-win", productId: "win", inventoryId: "win", unitAmountMinor: 450 },
    ],
  },
  { maxRiskScore: 0.5, maxDeliveryDays: 10 },
);
assert(routed);
assert.equal(routed.offer.supplierId, "supplier-win");
assert.equal(routed.landedCostMinor, 1100);

const excluded = routeSupplierOffers(
  {
    quantity: 1,
    destinationCountry: "US",
    currency: "USD",
    candidates: [{ ...base, excludedDestinationCountries: ["US"] }],
  },
  { maxRiskScore: 1, maxDeliveryDays: 30 },
);
assert.equal(excluded, null);

const deterministic = routeSupplierOffers(
  {
    quantity: 1,
    destinationCountry: "US",
    currency: "USD",
    candidates: [
      { ...base, supplierId: "supplier-b", connectionId: "conn-b" },
      { ...base, supplierId: "supplier-a", connectionId: "conn-a" },
    ],
  },
  { maxRiskScore: 1, maxDeliveryDays: 30 },
);
assert(deterministic);
assert.equal(deterministic.offer.supplierId, "supplier-a");

const client = {
  async search() {
    return [
      {
        offerId: "1688-offer-1",
        supplierId: "1688-supplier-1",
        title: "Observed product",
        availableQuantity: 12,
        unitAmountMinor: 325,
        shippingAmountMinor: 125,
        currency: "usd",
        estimatedDeliveryDays: 7,
        supplierRiskScore: 0.1,
        destinationCountries: ["us"],
        observedAt: "2026-09-21T12:00:00Z",
      },
      {
        offerId: "",
        supplierId: "broken",
        title: "invalid",
        availableQuantity: 1,
        unitAmountMinor: 1,
      },
    ];
  },
};

const adapter = new Supplier1688SourcingAdapter("conn-1688", client);
const offers = await adapter.search({
  query: "pet mug",
  destinationCountry: "us",
  currency: "usd",
});
assert.equal(offers.length, 1);
assert.equal(offers[0].provider, "1688");
assert.equal(offers[0].connectionId, "conn-1688");
assert.equal(offers[0].currency, "USD");
assert.deepEqual(offers[0].destinationCountries, ["US"]);
assert.equal(offers[0].externalProduct.externalId, "1688-offer-1");

const key = supplierProcurementIdempotencyKey("order-1", "item-1");
assert.equal(key, "supplier-procurement:order-1:item-1");

assert.doesNotThrow(() =>
  assertSupplierProcurementPreview({
    previewId: "preview-1",
    provider: "1688",
    connectionId: "conn-1688",
    supplierId: "supplier-1",
    productId: "product-1",
    inventoryId: "inventory-1",
    externalProduct: { provider: "1688", externalId: "offer-1" },
    opportunityId: "opportunity-1",
    researchCaseId: "research-1",
    evidenceRefs: ["evidence-1"],
    internalOrderId: "order-1",
    internalOrderItemId: "item-1",
    quantity: 2,
    unitAmountMinor: 500,
    shippingAmountMinor: 200,
    totalAmountMinor: 1200,
    currency: "USD",
    destinationCountry: "US",
    estimatedDeliveryDays: 5,
    idempotencyKey: key,
    preparedAt: "2026-09-21T12:00:00Z",
    expiresAt: "2026-09-21T12:05:00Z",
  }),
);

assert.throws(
  () =>
    assertSupplierProcurementPreview({
      previewId: "preview-1",
      provider: "1688",
      connectionId: "conn-1688",
      supplierId: "supplier-1",
      productId: "product-1",
      inventoryId: "inventory-1",
      externalProduct: { provider: "1688", externalId: "offer-1" },
      opportunityId: "opportunity-1",
      researchCaseId: "research-1",
      evidenceRefs: ["evidence-1"],
      internalOrderId: "order-1",
      internalOrderItemId: "item-1",
      quantity: 2,
      unitAmountMinor: 500,
      shippingAmountMinor: 200,
      totalAmountMinor: 999,
      currency: "USD",
      destinationCountry: "US",
      estimatedDeliveryDays: 5,
      idempotencyKey: key,
      preparedAt: "2026-09-21T12:00:00Z",
      expiresAt: "2026-09-21T12:05:00Z",
    }),
  /total/,
);
