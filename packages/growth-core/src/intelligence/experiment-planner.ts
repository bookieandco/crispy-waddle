import type { GrowthId } from '../domain/types.js';
import type { GrowthOpportunity } from './opportunity-engine.js';

export interface ExperimentPlan {
  id: GrowthId;
  opportunityId: GrowthId;
  hypothesis: string;
  creativeVariants: string[];
  audienceId?: GrowthId;
  offerId?: GrowthId;
  channel?: string;
  budgetGuardrail: number;
  successMetric: 'contribution_roas' | 'contribution_margin' | 'cac';
  successThreshold: number;
  stopCondition: string;
  requiredEvidence: string[];
}

export function planGrowthExperiment(opportunity: GrowthOpportunity): ExperimentPlan {
  const channel = opportunity.action === 'scale' ? 'existing-best-channel' : 'test-channel';
  return {
    id: `experiment:${opportunity.key}`,
    opportunityId: opportunity.id,
    hypothesis: `Improving ${opportunity.key} while preserving unit economics will increase contribution value.`,
    creativeVariants: [`${opportunity.key}:control`, `${opportunity.key}:variant-a`, `${opportunity.key}:variant-b`],
    channel,
    budgetGuardrail: Math.max(50, Math.round(opportunity.expectedValue * 0.25)),
    successMetric: 'contribution_roas',
    successThreshold: 1.5,
    stopCondition: 'Stop if contribution ROAS remains below 1.0 after sufficient evidence or the approved budget guardrail is reached.',
    requiredEvidence: ['delivery', 'spend', 'attribution', 'revenue', 'contribution_margin'],
  };
}
