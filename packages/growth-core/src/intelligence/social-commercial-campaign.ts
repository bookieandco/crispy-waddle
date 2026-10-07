import type { GrowthId } from '../domain/types.js';
import {
  createSocialCampaignRun,
  type SocialCampaignRun,
} from './social-campaign-runtime.js';
import {
  compileSocialCommercialRoutes,
  type SocialBusinessBinding,
  type SocialCommercialVariantRoute,
} from './social-commercial-lineage.js';
import type { SocialJuggernautPlan } from './social-juggernaut.js';

export interface SocialCommercialCampaignEnvelope {
  id: GrowthId;
  subjectId: GrowthId;
  brandId: GrowthId;
  planMode: SocialJuggernautPlan['mode'];
  businessBindingRef: string;
  routes: readonly SocialCommercialVariantRoute[];
  routeByVariant: Readonly<Record<string, string>>;
  productionLineageByVariant: Readonly<Record<string, string>>;
  run: SocialCampaignRun;
  evidenceRefs: readonly string[];
  policy: Readonly<{
    everyExecutableVariantNeedsCommercialRoute: true;
    commercialLineageSurvivesProduction: true;
    campaignRunCarriesBusinessBinding: true;
    orphanVariantExecutionBlocked: true;
  }>;
  authority: 'COMMERCIAL_CAMPAIGN_ORCHESTRATION_ONLY';
  publicationAuthority: 'NONE';
  paidMediaAuthority: 'NONE';
  externalActionAuthorized: false;
}

export function createSocialCommercialCampaignEnvelope(input: {
  id: GrowthId;
  plan: SocialJuggernautPlan;
  binding: SocialBusinessBinding;
  destinationByVariant?: Readonly<Record<string, string>>;
  executableVariantIds?: readonly string[];
  evidenceRefs: readonly string[];
  createdAt?: string;
}): SocialCommercialCampaignEnvelope {
  requireText(input.id, 'id');
  if (!input.evidenceRefs.length) {
    throw new Error('SOCIAL_COMMERCIAL_CAMPAIGN_EVIDENCE_REQUIRED');
  }

  const routes = compileSocialCommercialRoutes({
    plan: input.plan,
    binding: input.binding,
    destinationByVariant: input.destinationByVariant,
  });
  if (!routes.length) {
    throw new Error('SOCIAL_COMMERCIAL_CAMPAIGN_ROUTE_REQUIRED');
  }

  const executable = new Set(
    (input.executableVariantIds ?? input.plan.variants.map((variant) => variant.id))
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const planVariantIds = new Set(input.plan.variants.map((variant) => variant.id));
  for (const id of executable) {
    if (!planVariantIds.has(id)) {
      throw new Error(`SOCIAL_COMMERCIAL_CAMPAIGN_VARIANT_UNKNOWN:${id}`);
    }
  }

  const routeByVariant = Object.fromEntries(
    routes.map((route) => [route.variantId, route.id]),
  );
  const productionLineageByVariant = Object.fromEntries(
    routes.map((route) => [route.variantId, route.lineageKey]),
  );

  const orphaned = [...executable]
    .filter((variantId) => !routeByVariant[variantId]);
  if (orphaned.length) {
    throw new Error(
      `SOCIAL_COMMERCIAL_CAMPAIGN_ORPHAN_VARIANTS:${orphaned.join(',')}`,
    );
  }

  const routed = routes.filter((route) => executable.has(route.variantId));
  const run = createSocialCampaignRun({
    id: `${input.id}:run` as GrowthId,
    plan: {
      ...input.plan,
      variants: Object.freeze(
        input.plan.variants.filter((variant) => executable.has(variant.id)),
      ),
    },
    destinationSetRefs: [input.binding.id],
    createdAt: input.createdAt,
  });

  return Object.freeze({
    id: input.id,
    subjectId: input.plan.subjectId,
    brandId: input.plan.brandId,
    planMode: input.plan.mode,
    businessBindingRef: input.binding.id,
    routes: Object.freeze(routed),
    routeByVariant: Object.freeze(
      Object.fromEntries(
        routed.map((route) => [route.variantId, route.id]),
      ),
    ),
    productionLineageByVariant: Object.freeze(
      Object.fromEntries(
        routed.map((route) => [route.variantId, route.lineageKey]),
      ),
    ),
    run,
    evidenceRefs: Object.freeze(unique([
      ...input.evidenceRefs,
      ...input.binding.evidenceRefs,
      ...routed.flatMap((route) => route.evidenceRefs),
    ])),
    policy: Object.freeze({
      everyExecutableVariantNeedsCommercialRoute: true as const,
      commercialLineageSurvivesProduction: true as const,
      campaignRunCarriesBusinessBinding: true as const,
      orphanVariantExecutionBlocked: true as const,
    }),
    authority: 'COMMERCIAL_CAMPAIGN_ORCHESTRATION_ONLY' as const,
    publicationAuthority: 'NONE' as const,
    paidMediaAuthority: 'NONE' as const,
    externalActionAuthorized: false as const,
  });
}

function requireText(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`SOCIAL_COMMERCIAL_CAMPAIGN_FIELD_REQUIRED:${field}`);
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
