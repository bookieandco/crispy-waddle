import type { GrowthId } from '../domain/types.js';
import type { CommentStrategy } from './social-comment-strategy.js';
import type { CommentLearningSignal } from './social-comment-learning.js';

export interface AdaptiveCommentCandidate {
  readonly targetId: GrowthId;
  readonly audienceId: GrowthId;
  readonly strategy: CommentStrategy;
  readonly baseScore: number;
}

export interface AdaptiveCommentScore {
  readonly targetId: GrowthId;
  readonly audienceId: GrowthId;
  readonly strategy: CommentStrategy;
  readonly score: number;
  readonly adjustment: number;
  readonly reason: string;
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function applyCommentLearning(candidate: AdaptiveCommentCandidate, learning: readonly CommentLearningSignal[]): AdaptiveCommentScore {
  const relevant = learning.filter(s => s.accountId !== undefined && s.strategy === candidate.strategy && s.targetId === candidate.targetId);
  const strategySignals = learning.filter(s => s.strategy === candidate.strategy);
  const local = relevant.length ? relevant : strategySignals;
  const average = local.length ? local.reduce((sum, s) => sum + s.signalScore, 0) / local.length : 0.5;
  const adjustment = (clamp(average) - 0.5) * 0.3;
  const score = clamp(candidate.baseScore + adjustment);
  return {
    targetId: candidate.targetId,
    audienceId: candidate.audienceId,
    strategy: candidate.strategy,
    score,
    adjustment,
    reason: local.length ? `adapted_from_${local.length}_learning_signals` : 'neutral_prior_no_learning_signal',
  };
}
