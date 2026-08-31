import type { GrowthId } from '../domain/types.js';
import type { CommentLearningSignal } from './social-comment-learning.js';

export interface AccountLearningProfile {
  readonly accountId: GrowthId;
  readonly strategyScores: Readonly<Record<string, number>>;
  readonly toneScores: Readonly<Record<string, number>>;
  readonly targetPatternScores: Readonly<Record<string, number>>;
  readonly transferablePatterns: readonly TransferableSocialPattern[];
}

export interface TransferableSocialPattern {
  readonly patternId: GrowthId;
  readonly sourceAccountId: GrowthId;
  readonly strategy: string;
  readonly tone: string;
  readonly signalScore: number;
  readonly confidence: number;
  readonly transferableTraits: readonly string[];
  readonly mustRevalidateOnTargetAccount: true;
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function buildAccountLearningProfile(accountId: GrowthId, signals: readonly CommentLearningSignal[]): AccountLearningProfile {
  const local = signals.filter(s => s.accountId === accountId);
  const strategyScores: Record<string, number> = {};
  const toneScores: Record<string, number> = {};
  const targetPatternScores: Record<string, number> = {};
  for (const signal of local) {
    strategyScores[signal.strategy] = Math.max(strategyScores[signal.strategy] ?? 0, signal.signalScore);
    toneScores[signal.strategy + ':' + (signal.provenance.find(p => p.startsWith('tone:'))?.slice(5) ?? 'unknown')] = Math.max(toneScores[signal.strategy + ':' + (signal.provenance.find(p => p.startsWith('tone:'))?.slice(5) ?? 'unknown')] ?? 0, signal.signalScore);
    targetPatternScores[String(signal.targetId)] = Math.max(targetPatternScores[String(signal.targetId)] ?? 0, signal.signalScore);
  }
  return { accountId, strategyScores, toneScores, targetPatternScores, transferablePatterns: buildTransferablePatterns(signals, accountId) };
}

export function buildTransferablePatterns(signals: readonly CommentLearningSignal[], sourceAccountId: GrowthId): TransferableSocialPattern[] {
  return signals.filter(s => s.accountId === sourceAccountId && s.signalScore >= 0.75).map(s => ({
    patternId: `transferable:${s.commentId}` as GrowthId,
    sourceAccountId,
    strategy: s.strategy,
    tone: s.provenance.find(p => p.startsWith('tone:'))?.slice(5) ?? 'unknown',
    signalScore: clamp(s.signalScore),
    confidence: clamp(0.5 + (s.signalScore - 0.75) * 1.5),
    transferableTraits: ['strategy_shape', 'timing_signal', 'audience_context'],
    mustRevalidateOnTargetAccount: true,
  }));
}
