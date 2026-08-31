import type { GrowthId } from '../domain/types.js';
import type { CommentStrategy } from './social-comment-strategy.js';
import type { CommentLearningSignal } from './social-comment-learning.js';

export interface AdaptiveCommentCandidate {
  readonly accountId: GrowthId;
  readonly targetId: GrowthId;
  readonly audienceId: GrowthId;
  readonly strategy: CommentStrategy;
  readonly baseScore: number;
}

export interface AdaptiveCommentScore {
  readonly accountId: GrowthId;
  readonly targetId: GrowthId;
  readonly audienceId: GrowthId;
  readonly strategy: CommentStrategy;
  readonly score: number;
  readonly adjustment: number;
  readonly reason: string;
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function applyCommentLearning(candidate: AdaptiveCommentCandidate, learning: readonly CommentLearningSignal[]): AdaptiveCommentScore {
  const accountSignals = learning.filter(s => s.accountId === candidate.accountId && s.strategy === candidate.strategy);
  const relevant = accountSignals.filter(s => s.targetId === candidate.targetId);
  const local = relevant.length ? relevant : accountSignals;
  const average = local.length ? local.reduce((sum, s) => sum + s.signalScore, 0) / local.length : 0.5;
  const adjustment = (clamp(average) - 0.5) * 0.3;
  const score = clamp(candidate.baseScore + adjustment);
  return {
    accountId: candidate.accountId,
    targetId: candidate.targetId,
    audienceId: candidate.audienceId,
    strategy: candidate.strategy,
    score,
    adjustment,
    reason: local.length ? `adapted_from_${local.length}_account_scoped_learning_signals` : 'neutral_prior_no_account_learning_signal',
  };
}
