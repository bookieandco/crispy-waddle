import type { GrowthId } from '../domain/types.js';
import type { CreativePack } from './creative-pack.js';
import type { DistributionOpportunity, DistributionSurface } from './distribution-opportunity.js';

export interface DistributionVariant {
  id: GrowthId;
  surfaceId: GrowthId;
  creativeVariantId: GrowthId;
  adaptation: 'native' | 'shorten' | 'expand' | 'reframe';
  objective: 'discovery' | 'engagement' | 'conversion';
}

export interface DistributionPlan {
  id: GrowthId;
  opportunityId: GrowthId;
  creativePackId: GrowthId;
  variants: readonly DistributionVariant[];
}

function adaptationFor(surface: DistributionSurface): DistributionVariant['adaptation'] {
  if (surface.kind === 'social') return 'native';
  if (surface.kind === 'search') return 'expand';
  if (surface.kind === 'email') return 'reframe';
  return 'shorten';
}

export function planDistribution(
  opportunity: DistributionOpportunity,
  creativePack: CreativePack,
  surfaces: readonly DistributionSurface[],
): DistributionPlan {
  const eligible = surfaces.filter((surface) =>
    surface.enabled && surface.capabilities.includes('publish'),
  );

  const objective: DistributionVariant['objective'] =
    opportunity.recommendedAction === 'publish' || opportunity.recommendedAction === 'sponsor'
      ? 'conversion'
      : opportunity.recommendedAction === 'engage'
        ? 'engagement'
        : 'discovery';

  const variants = eligible.flatMap((surface) =>
    creativePack.concepts.flatMap((concept) =>
      concept.variants.map((variant) => ({
        id: `distribution-variant:${opportunity.id}:${surface.id}:${variant.id}`,
        surfaceId: surface.id,
        creativeVariantId: variant.id,
        adaptation: adaptationFor(surface),
        objective,
      })),
    ),
  );

  return {
    id: `distribution-plan:${opportunity.id}`,
    opportunityId: opportunity.id,
    creativePackId: creativePack.id,
    variants,
  };
}
