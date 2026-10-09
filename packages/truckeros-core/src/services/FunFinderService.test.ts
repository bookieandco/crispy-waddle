import { beforeEach, describe, expect, it } from "vitest";
import { FunFinderService } from "./FunFinderService.js";
import { AuditService } from "./AuditService.js";
import { InMemoryPlaceRepository } from "../repositories/PlaceRepository.js";
import { InMemoryPreferenceRepository } from "../repositories/PreferenceRepository.js";
import { InMemoryRecommendationRepository } from "../repositories/RecommendationRepository.js";
import { InMemoryAuditRepository } from "../repositories/AuditRepository.js";
import { InMemoryStore } from "../storage/InMemoryStore.js";
import { HaversineRoutingProvider } from "../providers/HaversineRoutingProvider.js";
import type { IPlacesProvider, PlaceSearchParams, PlaceSearchResult } from "../interfaces/places.js";
import { emptyTruckAttributes } from "../types.js";

const ORIGIN = { latitude: 32.7767, longitude: -96.797 };

class FakePlacesProvider implements IPlacesProvider {
  readonly providerName = "fake_test_provider";

  async searchNearby(params: PlaceSearchParams): Promise<PlaceSearchResult[]> {
    if (params.category !== "bbq") return [];

    const withParking = emptyTruckAttributes();
    withParking.inferred.large_vehicle_parking = true;

    return [
      {
        providerId: "near_no_parking",
        providerName: this.providerName,
        name: "Close BBQ, No Parking Data",
        category: "bbq",
        latitude: ORIGIN.latitude + 0.01,
        longitude: ORIGIN.longitude + 0.01,
        address: "near",
        phone: null,
        rating: 4.0,
        isOpenNow: true,
        truckAttributes: emptyTruckAttributes(),
      },
      {
        providerId: "far_with_parking",
        providerName: this.providerName,
        name: "Far BBQ, Truck Parking",
        category: "bbq",
        latitude: ORIGIN.latitude + 0.2,
        longitude: ORIGIN.longitude + 0.2,
        address: "far",
        phone: null,
        rating: 4.2,
        isOpenNow: true,
        truckAttributes: withParking,
      },
    ];
  }
}

/**
 * Simulates a real places provider where the same physical place matches
 * more than one of the "all" mix's category queries (a diner that's both
 * "food" and an "attraction", say) and comes back with the same
 * providerId both times — the way Google Places actually behaves, unlike
 * MockPlacesProvider's category-namespaced ids.
 */
class OverlappingCategoryProvider implements IPlacesProvider {
  readonly providerName = "overlap_test_provider";

  async searchNearby(params: PlaceSearchParams): Promise<PlaceSearchResult[]> {
    if (params.category !== "food" && params.category !== "attractions") return [];

    return [
      {
        providerId: "shared_place",
        providerName: this.providerName,
        name: "Roadside Diner & Curiosity Shop",
        category: params.category,
        latitude: ORIGIN.latitude + 0.01,
        longitude: ORIGIN.longitude + 0.01,
        address: "shared",
        phone: null,
        rating: 4.0,
        isOpenNow: true,
        truckAttributes: emptyTruckAttributes(),
      },
    ];
  }
}

describe("FunFinderService", () => {
  let store: InMemoryStore;
  let service: FunFinderService;
  let preferenceRepo: InMemoryPreferenceRepository;
  const driverId = "driver_demo";

  beforeEach(() => {
    store = new InMemoryStore();
    preferenceRepo = new InMemoryPreferenceRepository(store);
    service = new FunFinderService(
      new FakePlacesProvider(),
      new HaversineRoutingProvider(),
      new InMemoryPlaceRepository(store),
      preferenceRepo,
      new InMemoryRecommendationRepository(store),
      new AuditService(new InMemoryAuditRepository(store))
    );
  });

  it("sorts results and records a recommendation per result", async () => {
    const results = await service.search({
      driverId,
      latitude: ORIGIN.latitude,
      longitude: ORIGIN.longitude,
      radiusMeters: 16093,
      category: "bbq",
    });

    expect(results).toHaveLength(2);
    // Closer place should win on proximity even without a parking preference.
    expect(results[0].name).toBe("Close BBQ, No Parking Data");
    expect(store.recommendations.size).toBe(2);
  });

  it("hard-filters to truck-parking places when explicitly required", async () => {
    const results = await service.search({
      driverId,
      latitude: ORIGIN.latitude,
      longitude: ORIGIN.longitude,
      radiusMeters: 16093,
      category: "bbq",
      requireTruckParking: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Far BBQ, Truck Parking");
  });

  it("lets an approved preference change ranking on a later search", async () => {
    const before = await service.search({
      driverId,
      latitude: ORIGIN.latitude,
      longitude: ORIGIN.longitude,
      radiusMeters: 16093,
      category: "bbq",
    });
    expect(before[0].name).toBe("Close BBQ, No Parking Data");

    // Simulate an approved memory: "Driver likes BBQ places with truck parking."
    await preferenceRepo.upsert({
      driverId,
      key: "preferred_category_with_parking",
      value: "bbq",
      weight: 5,
      sourceMemoryId: "mem_1",
    });

    const after = await service.search({
      driverId,
      latitude: ORIGIN.latitude,
      longitude: ORIGIN.longitude,
      radiusMeters: 16093,
      category: "bbq",
    });

    const farPlace = after.find((p) => p.name === "Far BBQ, Truck Parking")!;
    expect(farPlace.rankReasons.some((r) => r.includes("confirmed truck parking"))).toBe(true);
    // The preference now outweighs the proximity gap and wins the ranking.
    expect(after[0].name).toBe("Far BBQ, Truck Parking");
  });

  it("dedupes a place returned by more than one category query in the 'all' mix", async () => {
    const overlapService = new FunFinderService(
      new OverlappingCategoryProvider(),
      new HaversineRoutingProvider(),
      new InMemoryPlaceRepository(store),
      preferenceRepo,
      new InMemoryRecommendationRepository(store),
      new AuditService(new InMemoryAuditRepository(store))
    );

    const results = await overlapService.search({
      driverId,
      latitude: ORIGIN.latitude,
      longitude: ORIGIN.longitude,
      radiusMeters: 16093,
      category: "all",
    });

    const matches = results.filter((p) => p.name === "Roadside Diner & Curiosity Shop");
    expect(matches).toHaveLength(1);
  });
});
