import { describe, expect, it } from "vitest";
import { estimateDriveMinutes, haversineDistanceMeters, metersToMiles } from "./geo.js";

describe("geo", () => {
  it("computes zero distance for identical points", () => {
    const p = { latitude: 32.7767, longitude: -96.797 };
    expect(haversineDistanceMeters(p, p)).toBe(0);
  });

  it("computes a known distance (Dallas to Fort Worth, ~30mi) within tolerance", () => {
    const dallas = { latitude: 32.7767, longitude: -96.797 };
    const fortWorth = { latitude: 32.7555, longitude: -97.3308 };
    const miles = metersToMiles(haversineDistanceMeters(dallas, fortWorth));
    expect(miles).toBeGreaterThan(25);
    expect(miles).toBeLessThan(35);
  });

  it("never estimates less than 1 minute of drive time", () => {
    expect(estimateDriveMinutes(1)).toBe(1);
  });

  it("scales drive time down as assumed speed increases", () => {
    const distanceMeters = 40233; // ~25 miles
    const slow = estimateDriveMinutes(distanceMeters, 25);
    const fast = estimateDriveMinutes(distanceMeters, 65);
    expect(fast).toBeLessThan(slow);
  });
});
