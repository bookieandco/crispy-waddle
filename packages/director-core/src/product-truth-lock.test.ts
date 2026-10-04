import { describe, expect, it } from "vitest";
import {
  compileProductTruthDirective,
  evaluateProductCreativeRepresentation,
  type ProductTruthLock,
} from "./product-truth-lock.js";

function lock(): ProductTruthLock {
  return {
    id: "truth:sku-1:v1",
    productId: "sku-1",
    version: 1,
    assertions: [
      {
        field: "color",
        key: "primary color",
        value: "Black",
        sourceRef: "pdp:sku-1",
        evidenceIds: ["evidence:pdp"],
      },
      {
        field: "quantity",
        key: "units included",
        value: "1",
        sourceRef: "pdp:sku-1",
        evidenceIds: ["evidence:pdp"],
      },
      {
        field: "included_accessories",
        key: "charging cable",
        value: "USB-C cable included",
        sourceRef: "manual:sku-1",
        evidenceIds: ["evidence:manual"],
      },
      {
        field: "performance",
        key: "battery runtime",
        value: "Up to 8 hours",
        sourceRef: "manual:sku-1",
        evidenceIds: ["evidence:manual"],
      },
    ],
    referenceAssetIds: ["asset:sku-1-front", "asset:sku-1-back"],
    evidenceIds: ["evidence:pdp", "evidence:manual"],
    lockedAt: "2026-10-03T23:00:00Z",
    authority: "DIRECTOR_PRODUCT_TRUTH_LOCK",
  };
}

describe("Product Truth Lock", () => {
  it("admits representations that exactly preserve locked product facts", () => {
    const decision = evaluateProductCreativeRepresentation({
      lock: lock(),
      representations: [
        { field: "color", key: "primary color", value: "black" },
        { field: "performance", key: "battery runtime", value: "Up to 8 hours" },
      ],
    });
    expect(decision.admissible).toBe(true);
  });

  it("rejects generated product exaggeration or invented bundle contents", () => {
    const decision = evaluateProductCreativeRepresentation({
      lock: lock(),
      representations: [
        { field: "performance", key: "battery runtime", value: "24 hours" },
        { field: "included_accessories", key: "wall charger", value: "included" },
      ],
    });
    expect(decision.admissible).toBe(false);
    expect(decision.reasons).toEqual(expect.arrayContaining([
      "DIRECTOR_PRODUCT_TRUTH_MISMATCH:performance:battery runtime",
      "DIRECTOR_PRODUCT_TRUTH_UNSUPPORTED_FIELD:included_accessories:wall charger",
    ]));
  });

  it("compiles a generation directive from evidence-backed assertions", () => {
    const directive = compileProductTruthDirective(lock());
    expect(directive).toContain("must not invent unsupported product attributes");
    expect(directive).toContain("performance / battery runtime: Up to 8 hours");
  });
});
