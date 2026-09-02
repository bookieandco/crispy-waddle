import type { ResearchSourceOutcome, ResearchSourcePerformance } from './research-source-performance.js';
import { ResearchSourcePerformanceStore } from './research-source-performance.js';

export interface ResearchSourcePerformanceRepository {
  list(): Promise<ResearchSourcePerformance[]>;
  save(performance: ResearchSourcePerformance): Promise<void>;
}

/** Durable adapter: Postgres/Supabase is authoritative; this store is the hot planner cache. */
export class PersistentResearchSourcePerformanceStore extends ResearchSourcePerformanceStore {
  constructor(private readonly repository: ResearchSourcePerformanceRepository) { super(); }

  async initialize(): Promise<void> {
    const persisted = await this.repository.list();
    for (const value of persisted) this.set(value);
  }

  async recordPersistent(outcome: ResearchSourceOutcome, now = new Date().toISOString()): Promise<ResearchSourcePerformance> {
    const next = this.record(outcome, now);
    await this.repository.save(next);
    return next;
  }
}
