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
  decayedScore: number;
  updatedAt: string;
}

export interface ResearchSourceDecayPolicy {
  halfLifeDays: number;
  minimumScore: number;
}

const DEFAULT_DECAY: ResearchSourceDecayPolicy = { halfLifeDays: 30, minimumScore: -1 };

/** Adaptive routing memory. Decay affects preference only, never factual truth. */
export class ResearchSourcePerformanceStore {
  protected readonly state = new Map<string, ResearchSourcePerformance>();
  constructor(private readonly decay: ResearchSourceDecayPolicy = DEFAULT_DECAY) {}

  protected set(value: ResearchSourcePerformance): void { this.state.set(value.sourceId, value); }

  record(outcome: ResearchSourceOutcome, now = new Date().toISOString()): ResearchSourcePerformance {
    const previous = this.state.get(outcome.sourceId);
    const prior = previous ? this.applyDecay(previous, now) : undefined;
    const base = prior ?? { sourceId: outcome.sourceId, investigations: 0, usefulEvidence: 0, corroboratedEvidence: 0, verifiedEvidence: 0, rejectedEvidence: 0, score: 0, decayedScore: 0, updatedAt: now };
    const next = { ...base,
      investigations: base.investigations + 1,
      usefulEvidence: base.usefulEvidence + outcome.usefulEvidence,
      corroboratedEvidence: base.corroboratedEvidence + outcome.corroboratedEvidence,
      verifiedEvidence: base.verifiedEvidence + outcome.verifiedEvidence,
      rejectedEvidence: base.rejectedEvidence + outcome.rejectedEvidence,
      updatedAt: now,
    };
    const total = next.usefulEvidence + next.rejectedEvidence;
    next.score = total === 0 ? next.decayedScore : ((next.verifiedEvidence * 2) + (next.corroboratedEvidence * 1.5) + next.usefulEvidence - next.rejectedEvidence) / total;
    next.decayedScore = this.decayScore(next.score, next.updatedAt, now);
    this.set(next);
    return next;
  }

  get(sourceId: string, now = new Date().toISOString()): ResearchSourcePerformance | undefined {
    const value = this.state.get(sourceId);
    return value ? this.applyDecay(value, now) : undefined;
  }

  rank(profiles: readonly ResearchSourceProfile[], now = new Date().toISOString()): ResearchSourceProfile[] {
    return [...profiles].sort((a, b) => (this.get(b.id, now)?.decayedScore ?? 0) - (this.get(a.id, now)?.decayedScore ?? 0));
  }

  private applyDecay(value: ResearchSourcePerformance, now: string): ResearchSourcePerformance {
    const decayedScore = Math.max(this.decay.minimumScore, this.decayScore(value.score, value.updatedAt, now));
    const next = { ...value, decayedScore };
    this.set(next);
    return next;
  }

  private decayScore(score: number, updatedAt: string, now: string): number {
    const ageDays = Math.max(0, (Date.parse(now) - Date.parse(updatedAt)) / 86_400_000);
    return score * Math.pow(0.5, ageDays / Math.max(1, this.decay.halfLifeDays));
  }
}
