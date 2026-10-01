import { describe, expect, it } from "vitest";
import { DeterministicSupplierRoutingEngine } from "./index";

const candidate = (overrides: Record<string, unknown> = {}) => ({
  supplierId: "supplier-a",
  connectionId: "connection-a",
  inventory: {
    inventoryId: "inventory-a",
    availableQuantity: 10,
    availability: "available" as const,
    unitPrice: { amountMinor: 1000, currency: "USD" },
  },
  supplierRiskScore: 10,
  estimatedLandedCostMinor: 1200,
  estimatedDeliveryDays: 5,
  fulfillment: {
    destinationCountries: ["US"],
  },
  ...overrides,
});

describe("DeterministicSupplierRoutingEngine", () => {
  const engine = new DeterministicSupplierRoutingEngine({ maxRiskScore: 50, maxDeliveryDays: 10 });

  it("selects the lowest landed cost", () => {
    const decision = engine.route({
      productId: "p1", quantity: 2, currency: "USD", destinationCountry: "US",
      candidates: [candidate(), candidate({ supplierId: "supplier-b", connectionId: "connection-b", estimatedLandedCostMinor: 1100 })],
    });
    expect(decision?.supplierId).toBe("supplier-b");
  });

  it("rejects insufficient inventory and unavailable inventory", () => {
    expect(engine.route({ productId: "p1", quantity: 11, currency: "USD", destinationCountry: "US", candidates: [candidate()] })).toBeNull();
    expect(engine.route({ productId: "p1", quantity: 1, currency: "USD", destinationCountry: "US", candidates: [candidate({ inventory: { ...candidate().inventory, availability: "unavailable" } })] })).toBeNull();
  });

  it("enforces risk, delivery, and currency constraints", () => {
    const risky = candidate({ supplierRiskScore: 51 });
    const slow = candidate({ estimatedDeliveryDays: 11 });
    const eur = candidate({ inventory: { ...candidate().inventory, unitPrice: { amountMinor: 1000, currency: "EUR" } } });
    expect(engine.route({ productId: "p1", quantity: 1, currency: "USD", destinationCountry: "US", candidates: [risky, slow, eur] })).toBeNull();
  });

  it("rejects a supplier that does not serve the destination", () => {
    expect(engine.route({
      productId: "p1", quantity: 1, currency: "USD", destinationCountry: "CA",
      candidates: [candidate()],
    })).toBeNull();
  });

  it("supports wildcard destinations", () => {
    const decision = engine.route({
      productId: "p1", quantity: 1, currency: "USD", destinationCountry: "CA",
      candidates: [candidate({ fulfillment: { destinationCountries: ["*"] } })],
    });
    expect(decision?.supplierId).toBe("supplier-a");
  });

  it("honors explicitly excluded destinations even with a wildcard", () => {
    expect(engine.route({
      productId: "p1", quantity: 1, currency: "USD", destinationCountry: "CA",
      candidates: [candidate({ fulfillment: { destinationCountries: ["*"], excludedDestinationCountries: ["CA"] } })],
    })).toBeNull();
  });

  it("enforces supplier-specific maximum delivery days", () => {
    expect(engine.route({
      productId: "p1", quantity: 1, currency: "USD", destinationCountry: "US",
      candidates: [candidate({ estimatedDeliveryDays: 6, fulfillment: { destinationCountries: ["US"], maxDeliveryDays: 5 } })],
    })).toBeNull();
  });

  it("breaks equal-cost ties deterministically", () => {
    const decision = engine.route({
      productId: "p1", quantity: 1, currency: "USD", destinationCountry: "US",
      candidates: [candidate({ supplierId: "supplier-z" }), candidate({ supplierId: "supplier-a", connectionId: "connection-b" })],
    });
    expect(decision?.supplierId).toBe("supplier-a");
  });

  it("returns null when there are no candidates", () => {
    expect(engine.route({ productId: "p1", quantity: 1, currency: "USD", destinationCountry: "US", candidates: [] })).toBeNull();
  });
});
