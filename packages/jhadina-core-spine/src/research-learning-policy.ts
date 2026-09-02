import type { ResearchSourcePerformance, ResearchSourceDecayPolicy } from './research-source-performance.js';

export type BanditStrategy = 'thompson' | 'ucb';

export interface ResearchLearningCandidate {
  sourceId: string;
  intentRelevance: number;
  sourceRoleScore: number;
  freshnessScore: number;
  trustScore: number;
  performance?: ResearchSourcePerformance;
}

export interface ResearchLearningScore {
  sourceId: string;
  score: number;
  strategy: BanditStrategy;
  exploration: number;
  posteriorMean: number;
}

/** Selection policy only. It cannot override authorization, trust, or verification requirements. */
export class ResearchLearningPolicy {
  constructor(private readonly config: ResearchSourceDecayPolicy) {}

  rank(candidates: readonly ResearchLearningCandidate[], totalTrials: number, strategy: BanditStrategy = 'thompson', random: () => number = Math.random): ResearchLearningScore[] {
    const ranked = candidates.map(candidate => {
      const p = candidate.performance;
      const posteriorMean = p?.posteriorMean ?? this.config.priorAlpha / (this.config.priorAlpha + this.config.priorBeta);
      const exploitation = candidate.intentRelevance + candidate.sourceRoleScore + candidate.freshnessScore + candidate.trustScore + (p?.decayedScore ?? 0) + posteriorMean;
      const exploration = strategy === 'ucb'
        ? Math.sqrt(Math.log(Math.max(2, totalTrials + 1)) / Math.max(1, p?.investigations ?? 0.5))
        : this.sampleBeta(
            this.config.priorAlpha + (p?.verifiedEvidence ?? 0) + (p?.corroboratedEvidence ?? 0) * 0.5,
            this.config.priorBeta + (p?.rejectedEvidence ?? 0),
            random,
          ) - posteriorMean;
      return { sourceId: candidate.sourceId, score: exploitation + this.config.explorationWeight * exploration, strategy, exploration, posteriorMean };
    });
    return ranked.sort((a, b) => b.score - a.score);
  }

  private sampleBeta(alpha: number, beta: number, random: () => number): number {
    // Lightweight Thompson approximation: posterior mean plus bounded stochastic uncertainty.
    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
    const jitter = (random() + random() - 1) * Math.sqrt(12 * variance);
    return Math.min(1, Math.max(0, mean + jitter));
  }
}
