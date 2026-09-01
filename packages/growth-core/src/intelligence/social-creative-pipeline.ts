import type { GrowthId } from '../domain/types.js';
import type { ExperimentPlan } from './experiment-planner.js';
import type { CreativeBrief } from './demand-creative-matching.js';
import type { CreativePack } from './creative-pack.js';

export interface SocialCreativePipelineInput {
  readonly brief: CreativeBrief;
  readonly experiment: ExperimentPlan;
  readonly creativePack: CreativePack;
}

export interface SocialCreativeExperiment {
  readonly id: GrowthId;
  readonly briefId: GrowthId;
  readonly experimentId: GrowthId;
  readonly creativePackId: GrowthId;
  readonly variantCount: number;
  readonly objective: CreativeBrief['objective'];
  readonly evidence: readonly GrowthId[];
  readonly requiresAttribution: true;
}

export function connectSocialCreativePipeline(
  input: SocialCreativePipelineInput,
): SocialCreativeExperiment {
  return {
    id: `social-creative-experiment:${input.brief.id}:${input.experiment.id}` as GrowthId,
    briefId: input.brief.id,
    experimentId: input.experiment.id,
    creativePackId: input.creativePack.id,
    variantCount: input.creativePack.concepts.reduce((sum, concept) => sum + concept.variants.length, 0),
    objective: input.brief.objective,
    evidence: [...new Set([...input.brief.evidence, input.experiment.id, input.creativePack.id])],
    requiresAttribution: true,
  };
}
