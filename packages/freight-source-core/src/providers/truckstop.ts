import type { FreightLoad, FreightSearchRequest, FreightSourceAdapter, FreightSourceHealth } from "../index";

export interface TruckstopClient {
  searchLoads(request: FreightSearchRequest): Promise<unknown[]>;
  health(): Promise<void>;
}

export class TruckstopFreightSourceAdapter implements FreightSourceAdapter {
  readonly source = "truckstop";
  constructor(private readonly client: TruckstopClient) {}

  async search(request: FreightSearchRequest): Promise<FreightLoad[]> {
    const records = await this.client.searchLoads(request);
    return records.map((record: any) => ({
      source: this.source,
      sourceLoadId: String(record.id ?? record.loadId),
      origin: String(record.origin),
      destination: String(record.destination),
      pickupAt: record.pickupAt,
      deliveryAt: record.deliveryAt,
      equipment: record.equipment,
      rateMinor: typeof record.rateMinor === "number" ? record.rateMinor : undefined,
      currency: record.currency,
      weightLbs: typeof record.weightLbs === "number" ? record.weightLbs : undefined,
      distanceMiles: typeof record.distanceMiles === "number" ? record.distanceMiles : undefined,
      raw: record,
    }));
  }

  async health(now: string): Promise<FreightSourceHealth> {
    const started = Date.now();
    try {
      await this.client.health();
      return { source: this.source, healthy: true, checkedAt: now, latencyMs: Date.now() - started };
    } catch {
      return { source: this.source, healthy: false, checkedAt: now, latencyMs: Date.now() - started, errorCode: "PROVIDER_UNAVAILABLE" };
    }
  }
}
