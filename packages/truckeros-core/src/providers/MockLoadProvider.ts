import type { LoadOffer } from "../interfaces/dispatcher.js";
import type { ILoadProvider, LoadSearchRequest } from "../interfaces/loads.js";

/** Deterministic offline load board used for development and acceptance tests. */
export class MockLoadProvider implements ILoadProvider {
  async search(request: LoadSearchRequest): Promise<LoadOffer[]> {
    const maxResults = Math.min(Math.max(request.maxResults ?? 10, 1), 25);
    const hint = request.destinationHint?.trim().toLowerCase();

    const loads: LoadOffer[] = [
      {
        id: "demo-houston-dallas",
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
      },
      {
        id: "demo-houston-austin",
        origin: "Houston, TX",
        destination: "Austin, TX",
        pickupAt: null,
        deliveryAt: null,
        revenueCents: 155_000,
        loadedMiles: 165,
        deadheadMiles: 25,
        fuelCostCents: 22_000,
        tollCostCents: 0,
        otherCostCents: 5_000,
        brokerName: "Example Broker",
      },
      {
        id: "demo-houston-sanantonio",
        origin: "Houston, TX",
        destination: "San Antonio, TX",
        pickupAt: null,
        deliveryAt: null,
        revenueCents: 120_000,
        loadedMiles: 200,
        deadheadMiles: 80,
        fuelCostCents: 26_000,
        tollCostCents: 0,
        otherCostCents: 6_000,
        brokerName: "Example Broker",
      },
    ];

    const filtered = hint
      ? loads.filter((load) => load.destination.toLowerCase().includes(hint))
      : loads;

    return filtered.slice(0, maxResults);
  }
}
