export interface FreightSearchRequest {
  carrierId: string;
  origin?: string;
  destination?: string;
  pickupFrom?: string;
  pickupTo?: string;
  equipment?: string;
  maxResults?: number;
}

export interface FreightLoad {
  source: string;
  sourceLoadId: string;
  origin: string;
  destination: string;
  pickupAt?: string;
  deliveryAt?: string;
  equipment?: string;
  rateMinor?: number;
  currency?: string;
  weightLbs?: number;
  distanceMiles?: number;
  raw?: unknown;
}

export interface FreightSourceHealth {
  source: string;
  healthy: boolean;
  checkedAt: string;
  latencyMs?: number;
  errorCode?: string;
}

export interface FreightSourceAdapter {
  readonly source: string;
  search(request: FreightSearchRequest): Promise<FreightLoad[]>;
  health(now: string): Promise<FreightSourceHealth>;
}

export class FreightSourceRegistry {
  private readonly adapters = new Map<string, FreightSourceAdapter>();

  register(adapter: FreightSourceAdapter): void {
    if (!adapter.source.trim()) throw new Error("Freight source name is required");
    if (this.adapters.has(adapter.source)) throw new Error(`Freight source already registered: ${adapter.source}`);
    this.adapters.set(adapter.source, adapter);
  }

  get(source: string): FreightSourceAdapter | undefined {
    return this.adapters.get(source);
  }

  list(): readonly string[] {
    return [...this.adapters.keys()].sort();
  }

  async search(request: FreightSearchRequest): Promise<FreightLoad[]> {
    const results = await Promise.all([...this.adapters.values()].map((adapter) => adapter.search(request)));
    return results.flat();
  }
}
