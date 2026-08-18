import { describe, expect, it } from "vitest";
import { DispatcherService } from "./DispatcherService.js";
import type { DispatcherContext, LoadOffer } from "../interfaces/dispatcher.js";

const load = (overrides: Partial<LoadOffer> = {}): LoadOffer => ({
  id: "load-1",
  origin: "Houston, TX",
  destination: "Dallas, TX",
  pickupAt: null,
  deliveryAt: null,
  revenueCents: 210_000,
  loadedMiles: 240,
  deadheadMiles: 40,
  fuelCostCents: 31_000,
  tollCostCents: 4_800,
  otherCostCents: 7_500,
  brokerName: "Example Broker",
  ...overrides,
});

const context = (loads: LoadOffer[]): DispatcherContext => ({
  driver: {
    id: "driver-1",
    name: "Driver",
    truckType: "tractor-trailer",
    homeBaseLocation: null,
    currentLocation: null,
    preferredRadiusMeters: 16_000,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  currentLocation: null,
  loads,
  minimumNetCentsPerMile: 400,
  targetNetCentsPerMile: 500,
});

describe("DispatcherService", () => {
  const service = new DispatcherService();

  it("calculates all-in net economics", () => {
    const economics = service.calculateEconomics(load());
    expect(economics.totalMiles).toBe(280);
    expect(economics.totalCostsCents).toBe(43_300);
    expect(economics.netProfitCents).toBe(166_700);
    expect(economics.netCentsPerMile).toBeCloseTo(595.357, 2);
  });

  it("accepts a load above the target net per mile", () => {
    const brief = service.brief(context([load()]));
    expect(brief.recommendation).toBe("accept");
    expect(brief.headline).toContain("$1667.00");
    expect(brief.headline).toContain("$5.95/mile");
  });

  it("counters when a load clears the minimum but misses the target", () => {
    const brief = service.brief(context([load({ revenueCents: 150_000 })]));
    expect(brief.recommendation).toBe("counter");
  });

  it("declines a load below the driver's minimum", () => {
    const brief = service.brief(context([load({ revenueCents: 80_000 })]));
    expect(brief.recommendation).toBe("decline");
    expect(brief.candidates[0]?.reasons.join(" ")).toContain("minimum");
  });

  it("ranks economically stronger loads first", () => {
    const weaker = load({ id: "weak", revenueCents: 130_000 });
    const stronger = load({ id: "strong", revenueCents: 220_000 });
    const ranked = service.rankLoads(context([weaker, stronger]));
    expect(ranked.map((candidate) => candidate.load.id)).toEqual(["strong", "weak"]);
  });

  it("does not allow negative cost inputs to improve the economics", () => {
    const economics = service.calculateEconomics(
      load({ fuelCostCents: -100_000, tollCostCents: -1, otherCostCents: -1 })
    );
    expect(economics.totalCostsCents).toBe(0);
    expect(economics.netProfitCents).toBe(load().revenueCents);
  });
});
