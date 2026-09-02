import type { ResearchLearningCandidate, ResearchLearningScore } from './research-learning-policy.js';
import type { BanditStrategy, ResearchLearningPolicy } from './research-learning-policy.js';

export interface ResearchSourceSelection {
  sourceId: string;
  rank: number;
  score: number;
  posteriorMean: number;
  exploration: number;
  reason: string;
}

export interface ResearchSourceSelector {
  rank(intent: string, candidates: readonly ResearchLearningCandidate[], totalTrials: number, strategy?: BanditStrategy): ResearchSourceSelection[];
}

/** Planner-facing boundary: recommends sources only; it never authorizes or executes research. */
export class DefaultResearchSourceSelector implements ResearchSourceSelector {
  constructor(private readonly learningPolicy: ResearchLearningPolicy) {}

  rank(intent: string, candidates: readonly ResearchLearningCandidate[], totalTrials: number, strategy: BanditStrategy = 'thompson'): ResearchSourceSelection[] {
    const ranked: ResearchLearningScore[] = this.learningPolicy.rank(candidates, totalTrials, strategy);
    return ranked.map((item, index) => {
      const candidate = candidates.find(value => value.sourceId === item.sourceId);
      const p = candidate?.performance;
      const reasons = [
        `${intent} relevance ${(candidate?.intentRelevance ?? 0).toFixed(2)}`,
        `role ${(candidate?.sourceRoleScore ?? 0).toFixed(2)}`,
        `freshness ${(candidate?.freshnessScore ?? 0).toFixed(2)}`,
        `trust ${(candidate?.trustScore ?? 0).toFixed(2)}`,
        `posterior ${item.posteriorMean.toFixed(2)}`,
        `${strategy} exploration ${item.exploration.toFixed(2)}`,
      ];
      if ((p?.investigations ?? 0) < 1) reasons.push('untried source receives exploration opportunity');
      return { ...item, rank: index + 1, reason: reasons.join('; ') };
    });
  }
}
