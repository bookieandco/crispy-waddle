import type { CulturalService } from './culture-service.js';
import type { ResearchSignal } from './cultural-ingestion.js';

export interface CultureSource { id: string; poll(): Promise<ResearchSignal[]>; enabled?: boolean; }
export interface CultureRefreshResult { sourceId: string; discovered: number; ingested: number; refreshedAt: string; error?: string; }

export class CultureRefreshScheduler {
  constructor(private readonly culture: CulturalService, private readonly sources: CultureSource[]) {}
  async refreshAll(now = new Date().toISOString()): Promise<CultureRefreshResult[]> {
    const results: CultureRefreshResult[] = [];
    for (const source of this.sources.filter((item) => item.enabled !== false)) {
      try {
        const signals = await source.poll();
        let ingested = 0;
        for (const signal of signals) if (this.culture.ingest(signal, now)) ingested += 1;
        results.push({ sourceId: source.id, discovered: signals.length, ingested, refreshedAt: now });
      } catch (error) {
        results.push({ sourceId: source.id, discovered: 0, ingested: 0, refreshedAt: now, error: error instanceof Error ? error.message : String(error) });
      }
    }
    this.culture.refresh(now);
    return results;
  }
}

export interface CultureEventBus {
  publish<T>(event: { id: string; type: string; occurredAt: string; payload: T }): Promise<void>;
  subscribe<T>(type: string, handler: (event: { id: string; type: string; occurredAt: string; payload: T }) => void | Promise<void>): () => void;
}

export const CULTURE_REFRESH_REQUESTED = 'jhadina.culture.refresh.requested';
export const CULTURE_REFRESH_COMPLETED = 'jhadina.culture.refresh.completed';
export interface CultureRefreshRequested { jobId: string; sourceIds?: string[]; }
export interface CultureRefreshCompleted { jobId: string; results: CultureRefreshResult[]; completedAt: string; }

export class CultureRefreshEventBridge {
  private unsubscribe?: () => void;
  constructor(private readonly bus: CultureEventBus, private readonly scheduler: CultureRefreshScheduler) {}
  start(): () => void {
    this.unsubscribe?.();
    this.unsubscribe = this.bus.subscribe<CultureRefreshRequested>(CULTURE_REFRESH_REQUESTED, async (event) => {
      const results = await this.scheduler.refreshAll(event.occurredAt);
      const completedAt = new Date().toISOString();
      await this.bus.publish<CultureRefreshCompleted>({ id: `${event.payload.jobId}:completed`, type: CULTURE_REFRESH_COMPLETED, occurredAt: completedAt, payload: { jobId: event.payload.jobId, results, completedAt } });
    });
    return () => this.stop();
  }
  stop(): void { this.unsubscribe?.(); this.unsubscribe = undefined; }
}
