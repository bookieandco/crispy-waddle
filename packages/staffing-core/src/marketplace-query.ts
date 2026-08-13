import type { Job } from "./jobs.js";

export interface MarketplaceJobQuery {
  organizationId?: string;
  search?: string;
  location?: string;
  remote?: boolean;
  currency?: string;
  minPayRate?: number;
  maxPayRate?: number;
  limit?: number;
  cursor?: string;
}

export interface MarketplaceJobResult {
  jobs: Job[];
  nextCursor: string | null;
}

export interface MarketplaceJobReader {
  search(query: MarketplaceJobQuery): Promise<MarketplaceJobResult>;
  getById(id: string): Promise<Job | null>;
}

export class MarketplaceJobQueryService {
  constructor(private readonly reader: MarketplaceJobReader) {}

  search(query: MarketplaceJobQuery): Promise<MarketplaceJobResult> {
    const normalized = {
      ...query,
      search: query.search?.trim() || undefined,
      location: query.location?.trim() || undefined,
      currency: query.currency?.toUpperCase(),
      limit: Math.min(Math.max(query.limit ?? 25, 1), 100),
      minPayRate: query.minPayRate !== undefined ? Math.max(0, query.minPayRate) : undefined,
      maxPayRate: query.maxPayRate !== undefined ? Math.max(0, query.maxPayRate) : undefined,
    };
    if (normalized.minPayRate !== undefined && normalized.maxPayRate !== undefined && normalized.minPayRate > normalized.maxPayRate) {
      throw new Error("minPayRate cannot exceed maxPayRate");
    }
    return this.reader.search(normalized);
  }

  getById(id: string): Promise<Job | null> {
    if (!id.trim()) throw new Error("Job id is required");
    return this.reader.getById(id);
  }
}
