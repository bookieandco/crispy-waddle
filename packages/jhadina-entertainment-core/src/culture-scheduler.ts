import type { CulturalIngestion, ResearchSignal } from './cultural-ingestion.js';

export interface CultureSource {
  id: string;
  poll(): Promise<ResearchSignal[]>;
  enabled?: boolean;
}

export interface CultureRefreshResult {
  sourceId: string;
  discovered: number;
  ingested: number;
  refreshedAt: string;
  error?: string;
}

/** Scheduler adapter: connectors discover; CulturalIngestion verifies/scorers; CulturalContext stores lifecycle state. */
export class CultureRefreshScheduler {
  constructor(private readonly ingestion: CulturalIngestion, private readonly sources: CultureSource[]) {}

  async refreshAll(now = new Date().toISOString()): Promise<CultureRefreshResult[]> {
    const results: CultureRefreshResult[] = [];
    for (const source of this.sources.filter((item) => item.enabled !== false)) {
      try {
        const signals = await source.poll();
        let ingested = 0;
        for (const signal of signals) {
          this.ingestion.ingest(signal, now);
          ingested += 1;
        }
        results.push({ sourceId: source.id, discovered: signals.length, ingested, refreshedAt: now });
      } catch (error) {
        results.push({ sourceId: source.id, discovered: 0, ingested: 0, refreshedAt: now, error: error instanceof Error ? error.message : String(error) });
      }
    }
    this.ingestion.refresh(now);
    return results;
  }
}
