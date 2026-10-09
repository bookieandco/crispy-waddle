import assert from "node:assert/strict";
import test from "node:test";
import {
  createInMemoryStopRegistry,
  normalizeStop,
  qualifyStop,
  rankDriverStops,
  type Route,
  type StopDataSource,
  type StopSourceRecord,
} from "./index.ts";

const observedAt = "2026-08-27T18:00:00.000Z";

function sourceRecord(overrides: Partial<StopSourceRecord> = {}): StopSourceRecord {
  return {
    providerId: "test-parking",
    providerName: "Test Parking",
    sourceRecordId: "stop-1",
    name: "I-35 Verified Travel Plaza",
    location: { latitude: 34.4707, longitude: -97.1312 },
    corridorIds: ["I-35"],
    parking: {
      modes: ["full_rig", "bobtail"],
      spacesTotal: 120,
      maximumTrailerLengthFeet: 53,
      maximumWeightLbs: 80000,
      maximumClearanceInches: 162,
      securityLevel: "high",
    },
    parkingStatus: {
      status: "open",
      spacesAvailable: 20,
      observedAt,
      sourceConfidence: "verified",
    },
    accessConstraints: [],
    amenities: [{ id: "laundry", name: "Laundry", category: "laundry" }],
    transit: {
      ridesharePickup: true,
      publicTransitNearby: false,
      pedestrianAccess: true,
    },
    lifestyleVenues: [],
    observedAt,
    confidence: "verified",
    ...overrides,
  };
}

const driver = {
  driverId: "driver-1",
  truckId: "truck-1",
  equipment: { mode: "full_rig" as const, trailerType: "dry_van" as const, trailerLengthFeet: 53, weightLbs: 70000 },
  availableDowntimeMinutes: 600,
  mobilityModes: ["rideshare" as const, "walk_out" as const],
  preferredAmenities: ["Laundry"],
  preferredCorridors: ["I-35"],
};

const route: Route = {
  routeId: "route-1",
  origin: { latitude: 33.0, longitude: -97.0 },
  destination: { latitude: 39.0, longitude: -94.0 },
  corridorIds: ["I-35"],
  segments: [{
    segmentId: "segment-1",
    corridorId: "I-35",
    origin: { latitude: 33.0, longitude: -97.0 },
    destination: { latitude: 35.0, longitude: -97.0 },
    distanceMiles: 200,
    etaMinutes: 180,
  }],
  totalDistanceMiles: 600,
  estimatedMinutes: 540,
  observedAt,
};

test("normalizes a provider record without leaking provider-specific shape", () => {
  const stop = normalizeStop(sourceRecord());
  assert.equal(stop.stopId, "test-parking:stop-1");
  assert.equal(stop.canonicalKey, "i-35-verified-travel-plaza:34.4707:-97.1312");
  assert.equal(stop.source.providerId, "test-parking");
});

test("registry deduplicates the same physical stop across providers", async () => {
  const sourceA: StopDataSource = {
    providerId: "a",
    providerName: "A",
    searchStops: async () => [sourceRecord({ providerId: "a", providerName: "A", sourceRecordId: "a-1" })],
    healthCheck: async () => ({ providerId: "a", healthy: true, checkedAt: observedAt }),
  };
  const sourceB: StopDataSource = {
    providerId: "b",
    providerName: "B",
    searchStops: async () => [sourceRecord({ providerId: "b", providerName: "B", sourceRecordId: "b-1", observedAt: "2026-08-27T18:01:00.000Z" })],
    healthCheck: async () => ({ providerId: "b", healthy: true, checkedAt: observedAt }),
  };

  const registry = createInMemoryStopRegistry([sourceA, sourceB]);
  const stops = await registry.search({ near: route.origin, radiusMiles: 500 });
  assert.equal(stops.length, 1);
  assert.equal(stops[0]?.source.providerId, "b");
});

test("qualification rejects an incompatible full-rig stop before lifestyle ranking", () => {
  const stop = normalizeStop(sourceRecord({ parking: { modes: ["bobtail"], maximumTrailerLengthFeet: 53 } }));
  const result = qualifyStop(driver, stop, new Date(observedAt));
  assert.equal(result.status, "rejected");
  assert.match(result.reasons[0] ?? "", /equipment configuration/i);
});

test("stale infrastructure never becomes a clean recommendation", () => {
  const stop = normalizeStop(sourceRecord({ observedAt: "2026-08-27T10:00:00.000Z" }));
  const result = qualifyStop(driver, stop, new Date("2026-08-27T13:00:00.000Z"));
  assert.equal(result.status, "conditional");
  assert.match(result.warnings.join(" "), /stale/i);
});

test("ranking favors a verified, open, secure stop and carries route context", () => {
  const stop = normalizeStop(sourceRecord());
  const recommendations = rankDriverStops(route, driver, [stop], new Date(observedAt));
  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0]?.status, "recommended");
  assert.ok((recommendations[0]?.score ?? 0) > 0);
  assert.equal(recommendations[0]?.routeContext.corridorId, "I-35");
  assert.ok(recommendations[0]?.reasons.some((reason) => /security|open|amenity|corridor/i.test(reason)));
});
