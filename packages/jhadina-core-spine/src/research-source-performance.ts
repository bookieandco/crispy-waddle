import type { ResearchSourceProfile } from './research-source-registry.js';

export interface ResearchSourceOutcome {
  sourceId: string;
  usefulEvidence: number;
  corroboratedEvidence: number;
  verifiedEvidence: number;
  rejectedEvidence: number;
}

export interface ResearchSourcePerformance {
  sourceId: string;
  investigations: number;
  usefulEvidence: number;
  corroboratedEvidence: number;
  verifiedEvidence: number;
  rejectedEvidence: number;
  score: number;
  updatedAt: string;
}

/** Adaptive source feedback. It changes routing preference, never factual truth. */
export class ResearchSourcePerformanceStore {
  private readonly state = new Map<string, ResearchSourcePerformance>();

  record(outcome: ResearchSourceOutcome, now = new Date().toISOString()): ResearchSourcePerformance {
    const previous = this.state.get(outcome.sourceId) ?? {
      sourceId: outcome.sourceId, investigations: 0, usefulEvidence: 0,
      corroboratedEvidence: 0, verifiedEvidence: 0, rejectedEvidence: 0, score: 0, updatedAt: now,
    };
    const next: ResearchSourcePerformance = {
      ...previous,
      investigations: previous.investigations + 1,
      usefulEvidence: previous.usefulEvidence + outcome.usefulEvidence,
      corroboratedEvidence: previous.corroboratedEvidence + outcome.corroboratedEvidence,
      verifiedEvidence: previous.verifiedEvidence + outcome.verifiedEvidence,
      rejectedEvidence: previous.rejectedEvidence + outcome.rejectedEvidence,
      updatedAt: now,
      score: 0,
    };
    const total = next.usefulEvidence + next.rejectedEvidence;
    next.score = total === 0 ? 0 : ((next.verifiedEvidence * 2) + (next.corroboratedEvidence * 1.5) + next.usefulEvidence - next.rejectedEvidence) / total;
    this.state.set(next.sourceId, next);
    return next;
  }

  get(sourceId: string): ResearchSourcePerformance | undefined { return this.state.get(sourceId); }

  rank(profiles: readonly ResearchSourceProfile[]): ResearchSourceProfile[] {
    return [...profiles].sort((a, b) => (this.get(b.id)?.score ?? 0) - (this.get(a.id)?.score ?? 0));
  }
}
