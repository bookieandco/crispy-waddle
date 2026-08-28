import type { GrowthId, ISODateTime } from '../domain/types.js';
import type { CreativeFormat, CreativePack, CreativeVariant, FunnelStage } from './creative-pack.js';
import type { ExperimentPlan } from './experiment-planner.js';
import type { GrowthOpportunity } from './opportunity-engine.js';
import { planCreativeAngles } from './creative-intelligence.js';

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
  const angles = planCreativeAngles(opportunity);

  const variants: CreativeVariant[] = experiment.creativeVariants.map((variantKey, index) => {
    const angle = angles[index % angles.length];
    return {
      id: `creative-variant:${experiment.id}:${index + 1}`,
      label: variantKey,
      format,
      hook: angle.hook,
      primaryText: `${experiment.hypothesis} ${angle.rationale}`,
      callToAction: input.offer ? `Explore ${input.offer}` : 'Learn more',
    };
  });

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
        ...angles.map((angle) => `creative-angle:${angle.angle}`),
      ],
      variants,
    }],
    createdAt: input.createdAt,
  };
}
