import type { OwnedMediaProperty } from '@jhadina/opportunity-core';
import type { GrowthId } from '../domain/types.js';
import type {
  SocialJuggernautPlan,
  SocialNativeVariantPlan,
} from './social-juggernaut.js';

export type SocialCommercialOwnerKind =
  | 'venture'
  | 'owned_media'
  | 'commerce'
  | 'music'
  | 'service';

export type SocialCommercialDestinationKind =
  | 'affiliate_program'
  | 'commerce_offer'
  | 'owned_storefront'
  | 'music_destination'
  | 'lead_capture'
  | 'community'
  | 'website';

export interface SocialCommercialDestination {
  id: string;
  kind: SocialCommercialDestinationKind;
  label: string;
  destinationRef: string;
  opportunityId?: string;
  offerRef?: string;
  programRef?: string;
  providerRef?: string;
  productRef?: string;
  songRef?: string;
  disclosureRequired: boolean;
  disclosureRef?: string;
  evidenceRefs: readonly string[];
}

export interface SocialBusinessBinding {
  id: string;
  subjectId: GrowthId;
  brandId: GrowthId;
  owner: Readonly<{
    kind: SocialCommercialOwnerKind;
    ref: string;
  }>;
  propertyRef?: string;
  accountRefs: readonly Readonly<{
    accountRef: string;
    platform: string;
    role: 'primary' | 'secondary';
  }>[];
  destinations: readonly SocialCommercialDestination[];
  primaryDestinationId: string;
  evidenceRefs: readonly string[];
  policy: Readonly<{
    oneCanonicalBusinessOwner: true;
    platformAccountMustMatchBinding: true;
    contentMustCarryCommercialLineage: true;
    affiliateDisclosureMustSurviveRepurposing: true;
    conversionMustNotBeInferredFromClick: true;
    realizedRevenueRequiresProviderFinancialEvidence: true;
  }>;
  authority: 'COMMERCIAL_LINEAGE_ONLY';
  publicationAuthority: 'NONE';
  moneyMovementAuthorized: false;
}

export interface SocialCommercialVariantRoute {
  id: string;
  subjectId: GrowthId;
  brandId: GrowthId;
  variantId: string;
  platform: string;
  accountRef: string;
  destinationId: string;
  destinationKind: SocialCommercialDestinationKind;
  destinationRef: string;
  lineageKey: string;
  disclosureRequired: boolean;
  disclosureRef?: string;
  evidenceRefs: readonly string[];
  authority: 'ROUTING_ONLY';
  publicationAuthority: 'NONE';
  externalActionAuthorized: false;
}

export interface SocialCommercialOutcomeLineage {
  lineageKey: string;
  subjectId: GrowthId;
  brandId: GrowthId;
  variantId: string;
  platform: string;
  accountRef: string;
  destinationId: string;
  publicationRef?: string;
  clickOrSessionRef?: string;
  conversionRef?: string;
  revenueRef?: string;
  state: 'planned' | 'published' | 'clicked' | 'converted' | 'realized_revenue';
  evidenceRefs: readonly string[];
  law: 'NEVER_SKIP_FROM_ATTENTION_TO_REVENUE';
  authority: 'ATTRIBUTION_LINEAGE_ONLY';
  moneyMovementAuthorized: false;
}

export function bindFacelessYouTubeAffiliate(input: {
  id: string;
  subjectId: GrowthId;
  brandId: GrowthId;
  ownedMediaProperty: Pick<
    OwnedMediaProperty,
    'id' | 'propertyType' | 'status' | 'opportunityId' | 'evidenceRefs'
  >;
  youtubeAccountRef: string;
  affiliateOpportunityId: string;
  affiliateProgramRef: string;
  affiliateProviderRef: string;
  destinationRef: string;
  disclosureRef: string;
  evidenceRefs: readonly string[];
}): SocialBusinessBinding {
  if (input.ownedMediaProperty.propertyType !== 'youtube_channel') {
    throw new Error('SOCIAL_COMMERCIAL_FACELESS_REQUIRES_YOUTUBE_PROPERTY');
  }
  if (input.ownedMediaProperty.status !== 'active') {
    throw new Error('SOCIAL_COMMERCIAL_FACELESS_PROPERTY_NOT_ACTIVE');
  }
  requireText(input.affiliateOpportunityId, 'affiliateOpportunityId');
  requireText(input.affiliateProgramRef, 'affiliateProgramRef');
  requireText(input.affiliateProviderRef, 'affiliateProviderRef');
  requireText(input.destinationRef, 'destinationRef');
  requireText(input.disclosureRef, 'disclosureRef');

  const destination: SocialCommercialDestination = Object.freeze({
    id: `affiliate:${safe(input.affiliateProgramRef)}`,
    kind: 'affiliate_program' as const,
    label: 'Affiliate offer',
    destinationRef: input.destinationRef.trim(),
    opportunityId: input.affiliateOpportunityId.trim(),
    programRef: input.affiliateProgramRef.trim(),
    providerRef: input.affiliateProviderRef.trim(),
    disclosureRequired: true,
    disclosureRef: input.disclosureRef.trim(),
    evidenceRefs: Object.freeze(unique([
      ...input.ownedMediaProperty.evidenceRefs,
      ...input.evidenceRefs,
    ])),
  });

  return buildBinding({
    id: input.id,
    subjectId: input.subjectId,
    brandId: input.brandId,
    owner: {
      kind: 'owned_media',
      ref: input.ownedMediaProperty.opportunityId,
    },
    propertyRef: input.ownedMediaProperty.id,
    accountRefs: [{
      accountRef: input.youtubeAccountRef,
      platform: 'youtube',
      role: 'primary',
    }],
    destinations: [destination],
    primaryDestinationId: destination.id,
    evidenceRefs: [
      ...input.ownedMediaProperty.evidenceRefs,
      ...input.evidenceRefs,
    ],
  });
}

export function bindBrandSocialCommerce(input: {
  id: string;
  subjectId: GrowthId;
  brandId: GrowthId;
  ownerRef: string;
  platform: string;
  socialAccountRef: string;
  destination: Omit<
    SocialCommercialDestination,
    'id' | 'kind' | 'disclosureRequired' | 'evidenceRefs'
  > & {
    id?: string;
    kind?: 'commerce_offer' | 'owned_storefront';
    disclosureRequired?: boolean;
    evidenceRefs: readonly string[];
  };
  evidenceRefs: readonly string[];
}): SocialBusinessBinding {
  requireText(input.ownerRef, 'ownerRef');
  requireText(input.socialAccountRef, 'socialAccountRef');
  requireText(input.platform, 'platform');
  requireText(input.destination.destinationRef, 'destination.destinationRef');

  const destination: SocialCommercialDestination = Object.freeze({
    ...input.destination,
    id: input.destination.id?.trim()
      || `commerce:${safe(input.destination.offerRef ?? input.destination.destinationRef)}`,
    kind: input.destination.kind ?? 'commerce_offer',
    disclosureRequired: input.destination.disclosureRequired ?? false,
    evidenceRefs: Object.freeze(unique(input.destination.evidenceRefs)),
  });

  return buildBinding({
    id: input.id,
    subjectId: input.subjectId,
    brandId: input.brandId,
    owner: {
      kind: 'commerce',
      ref: input.ownerRef,
    },
    accountRefs: [{
      accountRef: input.socialAccountRef,
      platform: input.platform.trim().toLowerCase(),
      role: 'primary',
    }],
    destinations: [destination],
    primaryDestinationId: destination.id,
    evidenceRefs: input.evidenceRefs,
  });
}

export function compileSocialCommercialRoutes(input: {
  plan: SocialJuggernautPlan;
  binding: SocialBusinessBinding;
  destinationByVariant?: Readonly<Record<string, string>>;
}): SocialCommercialVariantRoute[] {
  if (input.plan.subjectId !== input.binding.subjectId) {
    throw new Error('SOCIAL_COMMERCIAL_SUBJECT_MISMATCH');
  }
  if (input.plan.brandId !== input.binding.brandId) {
    throw new Error('SOCIAL_COMMERCIAL_BRAND_MISMATCH');
  }

  const accountsByPlatform = new Map(
    input.binding.accountRefs.map((entry) => [
      entry.platform.trim().toLowerCase(),
      entry,
    ] as const),
  );
  const destinations = new Map(
    input.binding.destinations.map((destination) => [
      destination.id,
      destination,
    ] as const),
  );

  return input.plan.variants.flatMap((variant) => {
    const account = accountsByPlatform.get(variant.platform);
    if (!account) return [];

    const destinationId = input.destinationByVariant?.[variant.id]
      ?? input.binding.primaryDestinationId;
    const destination = destinations.get(destinationId);
    if (!destination) {
      throw new Error(
        `SOCIAL_COMMERCIAL_DESTINATION_UNKNOWN:${destinationId}`,
      );
    }
    if (
      destination.disclosureRequired
      && !destination.disclosureRef?.trim()
    ) {
      throw new Error('SOCIAL_COMMERCIAL_DISCLOSURE_REQUIRED');
    }

    return [routeVariant({
      variant,
      binding: input.binding,
      accountRef: account.accountRef,
      destination,
    })];
  });
}

export function createSocialCommercialOutcomeLineage(input: {
  route: SocialCommercialVariantRoute;
  publicationRef?: string;
  clickOrSessionRef?: string;
  conversionRef?: string;
  revenueRef?: string;
  evidenceRefs: readonly string[];
}): SocialCommercialOutcomeLineage {
  if (!input.evidenceRefs.length) {
    throw new Error('SOCIAL_COMMERCIAL_OUTCOME_EVIDENCE_REQUIRED');
  }

  if (input.revenueRef && !input.conversionRef) {
    throw new Error('SOCIAL_COMMERCIAL_REVENUE_REQUIRES_CONVERSION');
  }
  if (input.conversionRef && !input.clickOrSessionRef) {
    throw new Error('SOCIAL_COMMERCIAL_CONVERSION_REQUIRES_CLICK_OR_SESSION');
  }
  if (input.clickOrSessionRef && !input.publicationRef) {
    throw new Error('SOCIAL_COMMERCIAL_CLICK_REQUIRES_PUBLICATION');
  }

  const state: SocialCommercialOutcomeLineage['state'] = input.revenueRef
    ? 'realized_revenue'
    : input.conversionRef
      ? 'converted'
      : input.clickOrSessionRef
        ? 'clicked'
        : input.publicationRef
          ? 'published'
          : 'planned';

  return Object.freeze({
    lineageKey: input.route.lineageKey,
    subjectId: input.route.subjectId,
    brandId: input.route.brandId,
    variantId: input.route.variantId,
    platform: input.route.platform,
    accountRef: input.route.accountRef,
    destinationId: input.route.destinationId,
    publicationRef: clean(input.publicationRef),
    clickOrSessionRef: clean(input.clickOrSessionRef),
    conversionRef: clean(input.conversionRef),
    revenueRef: clean(input.revenueRef),
    state,
    evidenceRefs: Object.freeze(unique([
      ...input.route.evidenceRefs,
      ...input.evidenceRefs,
    ])),
    law: 'NEVER_SKIP_FROM_ATTENTION_TO_REVENUE' as const,
    authority: 'ATTRIBUTION_LINEAGE_ONLY' as const,
    moneyMovementAuthorized: false as const,
  });
}

export function socialCommercialAffiliateMetadata(
  lineage: SocialCommercialOutcomeLineage,
): Record<string, string> {
  return compact({
    social_lineage_key: lineage.lineageKey,
    social_subject_id: lineage.subjectId,
    social_brand_id: lineage.brandId,
    social_variant_id: lineage.variantId,
    social_platform: lineage.platform,
    social_account_ref: lineage.accountRef,
    social_destination_id: lineage.destinationId,
    social_publication_ref: lineage.publicationRef,
    social_click_or_session_ref: lineage.clickOrSessionRef,
    social_conversion_ref: lineage.conversionRef,
  });
}

function buildBinding(input: {
  id: string;
  subjectId: GrowthId;
  brandId: GrowthId;
  owner: SocialBusinessBinding['owner'];
  propertyRef?: string;
  accountRefs: SocialBusinessBinding['accountRefs'];
  destinations: readonly SocialCommercialDestination[];
  primaryDestinationId: string;
  evidenceRefs: readonly string[];
}): SocialBusinessBinding {
  requireText(input.id, 'id');
  requireText(input.subjectId, 'subjectId');
  requireText(input.brandId, 'brandId');
  requireText(input.owner.ref, 'owner.ref');
  if (!input.accountRefs.length) {
    throw new Error('SOCIAL_COMMERCIAL_ACCOUNT_REQUIRED');
  }
  if (!input.destinations.length) {
    throw new Error('SOCIAL_COMMERCIAL_DESTINATION_REQUIRED');
  }
  if (!input.evidenceRefs.length) {
    throw new Error('SOCIAL_COMMERCIAL_EVIDENCE_REQUIRED');
  }
  if (!input.destinations.some((item) => item.id === input.primaryDestinationId)) {
    throw new Error('SOCIAL_COMMERCIAL_PRIMARY_DESTINATION_UNKNOWN');
  }

  for (const account of input.accountRefs) {
    requireText(account.accountRef, 'account.accountRef');
    requireText(account.platform, 'account.platform');
  }
  for (const destination of input.destinations) {
    requireText(destination.id, 'destination.id');
    requireText(destination.destinationRef, 'destination.destinationRef');
    if (!destination.evidenceRefs.length) {
      throw new Error('SOCIAL_COMMERCIAL_DESTINATION_EVIDENCE_REQUIRED');
    }
    if (destination.disclosureRequired && !destination.disclosureRef?.trim()) {
      throw new Error('SOCIAL_COMMERCIAL_DISCLOSURE_REQUIRED');
    }
  }

  return Object.freeze({
    id: input.id.trim(),
    subjectId: input.subjectId,
    brandId: input.brandId,
    owner: Object.freeze({ ...input.owner }),
    propertyRef: clean(input.propertyRef),
    accountRefs: Object.freeze(input.accountRefs.map((account) => Object.freeze({
      ...account,
      accountRef: account.accountRef.trim(),
      platform: account.platform.trim().toLowerCase(),
    }))),
    destinations: Object.freeze(input.destinations.map((destination) => Object.freeze({
      ...destination,
      evidenceRefs: Object.freeze(unique(destination.evidenceRefs)),
    }))),
    primaryDestinationId: input.primaryDestinationId,
    evidenceRefs: Object.freeze(unique(input.evidenceRefs)),
    policy: Object.freeze({
      oneCanonicalBusinessOwner: true as const,
      platformAccountMustMatchBinding: true as const,
      contentMustCarryCommercialLineage: true as const,
      affiliateDisclosureMustSurviveRepurposing: true as const,
      conversionMustNotBeInferredFromClick: true as const,
      realizedRevenueRequiresProviderFinancialEvidence: true as const,
    }),
    authority: 'COMMERCIAL_LINEAGE_ONLY' as const,
    publicationAuthority: 'NONE' as const,
    moneyMovementAuthorized: false as const,
  });
}

function routeVariant(input: {
  variant: SocialNativeVariantPlan;
  binding: SocialBusinessBinding;
  accountRef: string;
  destination: SocialCommercialDestination;
}): SocialCommercialVariantRoute {
  const lineageKey = [
    'social-commercial',
    safe(input.binding.subjectId),
    safe(input.variant.id),
    safe(input.destination.id),
  ].join(':');

  return Object.freeze({
    id: `route:${lineageKey}`,
    subjectId: input.binding.subjectId,
    brandId: input.binding.brandId,
    variantId: input.variant.id,
    platform: input.variant.platform,
    accountRef: input.accountRef,
    destinationId: input.destination.id,
    destinationKind: input.destination.kind,
    destinationRef: input.destination.destinationRef,
    lineageKey,
    disclosureRequired: input.destination.disclosureRequired,
    disclosureRef: input.destination.disclosureRef,
    evidenceRefs: Object.freeze(unique([
      ...input.binding.evidenceRefs,
      ...input.variant.evidenceRefs,
      ...input.destination.evidenceRefs,
    ])),
    authority: 'ROUTING_ONLY' as const,
    publicationAuthority: 'NONE' as const,
    externalActionAuthorized: false as const,
  });
}

function compact(values: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] =>
      typeof entry[1] === 'string' && entry[1].trim().length > 0
    ),
  );
}

function clean(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function requireText(value: string, field: string): void {
  if (!value.trim()) throw new Error(`SOCIAL_COMMERCIAL_FIELD_REQUIRED:${field}`);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function safe(value: string): string {
  return String(value).replace(/[^0-9A-Za-z:_-]+/g, '-').slice(0, 160);
}
