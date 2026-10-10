import { describe, expect, it } from "vitest";
import { MockPlacesProvider } from "./MockPlacesProvider.js";
import { haversineDistanceMeters } from "../geo.js";

const ORIGIN = { latitude: 32.7767, longitude: -96.797 };

describe("MockPlacesProvider", () => {
  it("keeps generated results within the requested radius", async () => {
    const provider = new MockPlacesProvider();
    const radiusMeters = 8046; // ~5mi

    const results = await provider.searchNearby({
      ...ORIGIN,
      radiusMeters,
      category: "bbq",
    });

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      const distance = haversineDistanceMeters(ORIGIN, result);
      expect(distance).toBeLessThanOrEqual(radiusMeters);
    }
  });

  it("scales results down for a tighter radius instead of ignoring it", async () => {
    const provider = new MockPlacesProvider();

    const tight = await provider.searchNearby({ ...ORIGIN, radiusMeters: 1609, category: "bbq" }); // 1mi
    const wide = await provider.searchNearby({ ...ORIGIN, radiusMeters: 40234, category: "bbq" }); // 25mi

    const tightMaxDistance = Math.max(...tight.map((r) => haversineDistanceMeters(ORIGIN, r)));
    const wideMaxDistance = Math.max(...wide.map((r) => haversineDistanceMeters(ORIGIN, r)));

    expect(tightMaxDistance).toBeLessThan(wideMaxDistance);
    expect(tightMaxDistance).toBeLessThanOrEqual(1609);
  });
});
