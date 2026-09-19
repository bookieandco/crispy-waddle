import { describe, expect, it } from "vitest";
import { buildSupplierProcurementIntent } from "./procurement-intent";

const routing = {
  supplierId: "supplier-1",
  connectionId: "connection-1",
  inventoryId: "inventory-1",
  quantity: 3,
  rationale: ["eligible inventory available", "landed cost: 1200"],
};

describe("buildSupplierProcurementIntent", () => {
  it("maps a routing decision to a financial commerce intent", () => {
    const intent = buildSupplierProcurementIntent({
      actorId: "user-1",
      intentId: "intent-1",
      opportunityId: "opp-1",
      orderId: "order-1",
      orderItemId: "item-1",
      productId: "product-1",
      destinationCountry: " mx ",
      currency: "USD",
      landedCostMinor: 1200,
      supplier: routing,
      requestedAt: "2026-09-01T12:00:00Z",
    });

    expect(intent).toMatchObject({
      intentId: "intent-1",
      kind: "financial_commitment",
      actorId: "user-1",
      resourceType: "supplier_procurement",
      resourceId: "order-1:item-1",
      opportunityId: "opp-1",
      risk: "financial",
      idempotencyKey: "supplier-procurement:order-1:item-1",
    });
    expect(intent.metadata).toMatchObject({
      supplierId: "supplier-1",
      connectionId: "connection-1",
      inventoryId: "inventory-1",
      quantity: "3",
      destinationCountry: "MX",
      landedCostMinor: "1200",
    });
  });

  it("does not allow invalid routing quantities", () => {
    expect(() =>
      buildSupplierProcurementIntent({
        actorId: "user-1",
        intentId: "intent-1",
        orderId: "order-1",
        orderItemId: "item-1",
        productId: "product-1",
        destinationCountry: "MX",
        currency: "USD",
        landedCostMinor: 1200,
        supplier: { ...routing, quantity: 0 },
        requestedAt: "2026-09-01T12:00:00Z",
      }),
    ).toThrow("supplier quantity must be a positive integer");
  });

  it("is side-effect free and uses stable procurement idempotency", () => {
    const input = {
      actorId: "user-1",
      intentId: "intent-1",
      orderId: "order-1",
      orderItemId: "item-1",
      productId: "product-1",
      destinationCountry: "MX",
      currency: "USD",
      landedCostMinor: 1200,
      supplier: routing,
      requestedAt: "2026-09-01T12:00:00Z",
    };

    expect(buildSupplierProcurementIntent(input)).toEqual(
      buildSupplierProcurementIntent(input),
    );
  });
});
