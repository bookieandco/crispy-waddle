import type { GrowthId, ISODateTime } from '../domain/types.js';
import type { CreativeFormat, CreativePack, CreativeVariant, FunnelStage } from './creative-pack.js';
import type { ExperimentPlan } from './experiment-planner.js';
import type { GrowthOpportunity } from './opportunity-engine.js';

export interface CreativePackAssemblyInput {
  brandId: GrowthId;
  createdAt: ISODateTime;
  format?: CreativeFormat;
  funnelStage?: FunnelStage;
  objective?: string;
  avatar?: string;
  offer?: string;
}

export function assembleCreativePack(
  opportunity: GrowthOpportunity,
  experiment: ExperimentPlan,
  input: CreativePackAssemblyInput,
): CreativePack {
  const format = input.format ?? 'short_video';
  const funnelStage = input.funnelStage ?? 'prospecting';
  const objective = input.objective ?? `Validate ${opportunity.key}`;
  const avatar = input.avatar ?? 'target-audience';

  const variants: CreativeVariant[] = experiment.creativeVariants.map((variantKey, index) => ({
    id: `creative-variant:${experiment.id}:${index + 1}`,
    label: variantKey,
    format,
    hook: `${index === 0 ? 'Control' : `Variant ${index}`}: ${opportunity.key}`,
    primaryText: experiment.hypothesis,
    callToAction: input.offer ? `Explore ${input.offer}` : 'Learn more',
  }));

  return {
    id: `creative-pack:${experiment.id}`,
    brandId: input.brandId,
    name: `Experiment creative — ${opportunity.key}`,
    objective,
    funnelStage,
    concepts: [{
      id: `creative-concept:${experiment.id}`,
      name: opportunity.key,
      avatar,
      offer: input.offer,
      audienceSignals: [
        `opportunity-score:${opportunity.score}`,
        `confidence:${opportunity.confidence}`,
        `action:${opportunity.action}`,
      ],
      variants,
    }],
    createdAt: input.createdAt,
  };
}
