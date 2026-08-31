import type { GrowthId } from '../domain/types.js';
import type { CommentStrategy } from './social-comment-strategy.js';
import type { CommentLearningSignal } from './social-comment-learning.js';
import { applyCommentLearning, type AdaptiveCommentCandidate, type AdaptiveCommentScore } from './social-comment-adaptive-scoring.js';
import { buildAccountLearningProfile } from './social-account-learning.js';

export interface AccountAdaptiveCandidate extends AdaptiveCommentCandidate {
  readonly accountId: GrowthId;
}

export interface RankedCommentCandidate extends AdaptiveCommentScore {
  readonly rank: number;
  readonly accountStrategyScore: number;
  readonly targetHistoryScore: number;
}

export function rankCommentCandidates(accountId: GrowthId, candidates: readonly AccountAdaptiveCandidate[], learning: readonly CommentLearningSignal[]): RankedCommentCandidate[] {
  const profile = buildAccountLearningProfile(accountId, learning);
  return candidates
    .filter(candidate => candidate.accountId === accountId)
    .map(candidate => {
      const adaptive = applyCommentLearning(candidate, learning);
      const accountStrategyScore = profile.strategyScores[candidate.strategy] ?? 0.5;
      const targetHistoryScore = profile.targetPatternScores[String(candidate.targetId)] ?? 0.5;
      const score = Math.max(0, Math.min(1, adaptive.score * 0.6 + accountStrategyScore * 0.2 + targetHistoryScore * 0.2));
      return { ...adaptive, score, accountStrategyScore, targetHistoryScore, rank: 0 };
    })
    .sort((a, b) => b.score - a.score)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}
