import type { GrowthId } from '../domain/types.js';
import type { ExperimentPlan } from './experiment-planner.js';
import type { CreativeVariant } from './social-adaptation.js';
import type { SocialPattern } from './social-intelligence.js';

export interface SocialExperimentInput {
  readonly pattern: SocialPattern;
  readonly variants: readonly CreativeVariant[];
  readonly audienceId?: GrowthId;
  readonly offerId?: GrowthId;
  readonly channel: string;
  readonly budgetGuardrail: number;
  readonly successThreshold?: number;
}

export function planSocialExperiment(input: SocialExperimentInput): ExperimentPlan {
  const patternId = input.pattern.id;
  return {
    id: `social-experiment:${patternId}` as GrowthId,
    opportunityId: patternId,
    hypothesis: `Applying the validated social pattern ${patternId} through original creative variants will improve qualified commercial performance without copying source expression.`,
    creativeVariants: input.variants.map((variant) => variant.id),
    audienceId: input.audienceId,
    offerId: input.offerId,
    channel: input.channel,
    budgetGuardrail: Math.max(0, input.budgetGuardrail),
    successMetric: 'contribution_roas',
    successThreshold: input.successThreshold ?? 1.5,
    stopCondition: 'Stop when the approved budget guardrail is reached, material policy risk is detected, or contribution ROAS remains below the configured floor after sufficient attribution evidence.',
    requiredEvidence: ['delivery', 'spend', 'attribution', 'revenue', 'contribution_margin'],
  };
}
