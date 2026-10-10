import { beforeEach, describe, expect, it } from "vitest";
import { MemoryService } from "./MemoryService.js";
import { AuditService } from "./AuditService.js";
import { InMemoryMemoryRepository } from "../repositories/MemoryRepository.js";
import { InMemoryPreferenceRepository } from "../repositories/PreferenceRepository.js";
import { InMemoryAuditRepository } from "../repositories/AuditRepository.js";
import { InMemoryStore } from "../storage/InMemoryStore.js";
import { emptyTruckAttributes, type Place } from "../types.js";

function makePlace(overrides: Partial<Place> = {}): Place {
  return {
    id: "place_1",
    providerId: "mock_1",
    providerName: "mock_offline",
    name: "Smokehouse Pullout BBQ",
    category: "bbq",
    latitude: 32.78,
    longitude: -96.8,
    address: "123 Highway Frontage Rd",
    phone: null,
    rating: 4.5,
    isOpenNow: true,
    truckAttributes: emptyTruckAttributes(),
    metadata: {},
    ...overrides,
  };
}

describe("MemoryService", () => {
  let store: InMemoryStore;
  let memoryService: MemoryService;
  let preferenceRepo: InMemoryPreferenceRepository;
  const driverId = "driver_demo";

  beforeEach(() => {
    store = new InMemoryStore();
    const memoryRepo = new InMemoryMemoryRepository(store);
    preferenceRepo = new InMemoryPreferenceRepository(store);
    const auditService = new AuditService(new InMemoryAuditRepository(store));
    memoryService = new MemoryService(memoryRepo, preferenceRepo, auditService);
  });

  it("does not propose a candidate for a passive 'viewed' interaction", async () => {
    const candidate = await memoryService.proposeFromInteraction({
      driverId,
      place: makePlace(),
      eventType: "viewed",
    });
    expect(candidate).toBeNull();
  });

  it("proposes a parking-aware candidate when the saved place has inferred truck parking", async () => {
    const place = makePlace();
    place.truckAttributes.inferred.large_vehicle_parking = true;

    const candidate = await memoryService.proposeFromInteraction({
      driverId,
      place,
      eventType: "saved",
    });

    expect(candidate).not.toBeNull();
    expect(candidate?.status).toBe("pending");
    expect(candidate?.proposedPreference).toEqual({
      key: "preferred_category_with_parking",
      value: "bbq",
      weight: 5,
    });

    const pending = await memoryService.listPendingCandidates(driverId);
    expect(pending).toHaveLength(1);
  });

  it("does nothing to preferences until the driver explicitly approves", async () => {
    const place = makePlace();
    place.truckAttributes.inferred.truck_accessible = true;
    const candidate = await memoryService.proposeFromInteraction({ driverId, place, eventType: "saved" });

    expect(await preferenceRepo.listByDriver(driverId)).toHaveLength(0);

    const memory = await memoryService.approve(driverId, candidate!.id);

    expect(memory.compiledPreferenceRule.value).toBe("bbq");
    const prefs = await preferenceRepo.listByDriver(driverId);
    expect(prefs).toHaveLength(1);
    expect(prefs[0].key).toBe("preferred_category_with_parking");

    const stillPending = await memoryService.listPendingCandidates(driverId);
    expect(stillPending).toHaveLength(0);
  });

  it("rejecting a candidate leaves no preference behind", async () => {
    const candidate = await memoryService.proposeFromInteraction({
      driverId,
      place: makePlace(),
      eventType: "liked",
    });
    await memoryService.reject(driverId, candidate!.id);

    expect(await preferenceRepo.listByDriver(driverId)).toHaveLength(0);
    expect(await memoryService.listPendingCandidates(driverId)).toHaveLength(0);
  });

  it("refuses to approve a candidate belonging to a different driver", async () => {
    const candidate = await memoryService.proposeFromInteraction({
      driverId,
      place: makePlace(),
      eventType: "saved",
    });
    await expect(memoryService.approve("someone_else", candidate!.id)).rejects.toThrow(/not authorized/);
  });

  it("refuses to approve an already-resolved candidate twice", async () => {
    const candidate = await memoryService.proposeFromInteraction({
      driverId,
      place: makePlace(),
      eventType: "saved",
    });
    await memoryService.approve(driverId, candidate!.id);
    await expect(memoryService.approve(driverId, candidate!.id)).rejects.toThrow(/not pending/);
  });
});
