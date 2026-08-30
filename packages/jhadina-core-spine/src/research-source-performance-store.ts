import type { ResearchSourceOutcome, ResearchSourcePerformance } from './research-source-performance.js';
import { ResearchSourcePerformanceStore } from './research-source-performance.js';

export interface ResearchSourcePerformanceRepository {
  load(sourceId: string): Promise<ResearchSourcePerformance | undefined>;
  save(performance: ResearchSourcePerformance): Promise<void>;
}

/** Durable decorator: DB is authoritative; the in-memory store remains the hot read cache. */
export class PersistentResearchSourcePerformanceStore extends ResearchSourcePerformanceStore {
  constructor(private readonly repository: ResearchSourcePerformanceRepository) { super(); }

  async load(sourceId: string): Promise<ResearchSourcePerformance | undefined> {
    const persisted = await this.repository.load(sourceId);
    if (!persisted) return undefined;
    this.hydrate(persisted);
    return persisted;
  }

  async recordPersistent(outcome: ResearchSourceOutcome, now = new Date().toISOString()): Promise<ResearchSourcePerformance> {
    const current = await this.repository.load(outcome.sourceId);
    if (current) this.hydrate(current);
    const next = this.record(outcome, now);
    await this.repository.save(next);
    return next;
  }

  private hydrate(value: ResearchSourcePerformance): void {
    // Seed the parent cache without exposing mutable internals.
    const seed = this.record({
      sourceId: value.sourceId,
      usefulEvidence: value.usefulEvidence,
      corroboratedEvidence: value.corroboratedEvidence,
      verifiedEvidence: value.verifiedEvidence,
      rejectedEvidence: value.rejectedEvidence,
    }, value.updatedAt);
    // record() increments investigations; restore the persisted count by replaying no-op records.
    for (let i = 1; i < value.investigations; i++) super.record({ sourceId: value.sourceId, usefulEvidence: 0, corroboratedEvidence: 0, verifiedEvidence: 0, rejectedEvidence: 0 }, value.updatedAt);
    void seed;
  }
}
