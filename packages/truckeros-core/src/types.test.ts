import { describe, expect, it } from "vitest";
import { emptyTruckAttributes, resolveTruckAttribute } from "./types.js";

describe("resolveTruckAttribute", () => {
  it("returns unknown when no tier has a value", () => {
    expect(resolveTruckAttribute(emptyTruckAttributes(), "showers")).toEqual({
      value: null,
      source: "unknown",
    });
  });

  it("prefers provider-verified over user-reported and inferred", () => {
    const attrs = emptyTruckAttributes();
    attrs.inferred.large_vehicle_parking = true;
    attrs.userReported.large_vehicle_parking = false;
    attrs.verified.large_vehicle_parking = true;

    expect(resolveTruckAttribute(attrs, "large_vehicle_parking")).toEqual({
      value: true,
      source: "provider_verified",
    });
  });

  it("falls back to user-reported when nothing is verified", () => {
    const attrs = emptyTruckAttributes();
    attrs.inferred.showers = false;
    attrs.userReported.showers = true;

    expect(resolveTruckAttribute(attrs, "showers")).toEqual({
      value: true,
      source: "user_reported",
    });
  });

  it("falls back to inferred as the lowest-trust tier", () => {
    const attrs = emptyTruckAttributes();
    attrs.inferred.truck_accessible = true;

    expect(resolveTruckAttribute(attrs, "truck_accessible")).toEqual({
      value: true,
      source: "inferred",
    });
  });
});
