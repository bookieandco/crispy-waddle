import type { GrowthId } from '../domain/types.js';
import type { TransferableSocialPattern } from './social-account-learning.js';

export interface PatternTransferRequest {
  readonly pattern: TransferableSocialPattern;
  readonly targetAccountId: GrowthId;
  readonly targetAudienceId: GrowthId;
  readonly targetVoiceId: GrowthId;
}

export interface PatternHypothesis {
  readonly id: GrowthId;
  readonly sourcePatternId: GrowthId;
  readonly sourceAccountId: GrowthId;
  readonly targetAccountId: GrowthId;
  readonly targetAudienceId: GrowthId;
  readonly targetVoiceId: GrowthId;
  readonly strategy: string;
  readonly transferableTraits: readonly string[];
  readonly sourceConfidence: number;
  readonly initialPrior: number;
  readonly status: 'hypothesis';
  readonly requiresLocalValidation: true;
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function createPatternHypothesis(request: PatternTransferRequest): PatternHypothesis {
  if (request.pattern.sourceAccountId === request.targetAccountId) {
    throw new Error('PATTERN_TRANSFER_SAME_ACCOUNT');
  }
  if (!request.pattern.mustRevalidateOnTargetAccount) {
    throw new Error('PATTERN_TRANSFER_REVALIDATION_REQUIRED');
  }
  return {
    id: `pattern-hypothesis:${request.pattern.patternId}:${request.targetAccountId}` as GrowthId,
    sourcePatternId: request.pattern.patternId,
    sourceAccountId: request.pattern.sourceAccountId,
    targetAccountId: request.targetAccountId,
    targetAudienceId: request.targetAudienceId,
    targetVoiceId: request.targetVoiceId,
    strategy: request.pattern.strategy,
    transferableTraits: request.pattern.transferableTraits,
    sourceConfidence: clamp(request.pattern.confidence),
    initialPrior: clamp(request.pattern.confidence * 0.5),
    status: 'hypothesis',
    requiresLocalValidation: true,
  };
}
