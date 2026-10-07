import type {
  OwnedMediaProperty,
  SideHustleAffiliatePortfolioTruth,
  SideHustleAffiliateProgramTruth,
} from '@jhadina/opportunity-core';
import type { GrowthId } from '../domain/types.js';

export type SocialBusinessDestinationKind =
  | 'affiliate_program'
  | 'storefront'
  | 'product'
  | 'checkout'
  | 'music'
  | 'direct_capture'
  | 'lead'
  | 'service'
  | 'membership'
  | 'app';

export type SocialBusinessOwner =
  | 'opportunity'
  | 'commerce'
  | 'affiliate'
  | 'pupsonstuff'
  | 'music'
  | 'growth_crm'
  | 'owned_media'
  | 'other';

export interface SocialBusinessDestination {
  id: string;
  kind: SocialBusinessDestinationKind;
  owner: SocialBusinessOwner;
  destinationRef: string;
  attributionKey: string;
  objective:
    | 'affiliate_conversion'
    | 'product_sale'
    | 'checkout'
    | 'music_transfer'
    | 'direct_capture'
    | 'lead_generation'
    | 'service_conversion'
    | 'membership_conversion'
    | 'app_conversion';
  evidenceRefs: readonly string[];
}

export interface SocialBusinessDestinationSet {
  id: string;
  subjectId: GrowthId;
  brandId: GrowthId;
  sourceSurfaceRef: string;
  sourcePlatform: string;
  destinations: readonly SocialBusinessDestination[];
  evidenceRefs: readonly string[];
  policy: Readonly<{
    sourceAndDestinationLineageRequired: true;
    destinationSpecificAttributionRequired: true;
    vanityMetricsCannotProveBusinessOutcome: true;
    approvedCommissionIsNotRealizedRevenue: true;
    realizedRevenueRequiresCanonicalEconomicEvidence: true;
  }>;
  authority: 'ATTRIBUTION_PLANNING_ONLY';
  externalActionAuthorized: false;
  publicationAuthority: 'NONE';
  moneyMovementAuthority: 'NONE';
}

export interface SocialDestinationOutcomeObservation {
  id: string;
  destinationSetId: string;
  destinationId: string;
  sourceContentRef: string;
  clicks?: number;
  conversions?: number;
  qualifiedCaptures?: number;
  realizedRevenue?: number;
  currency?: string;
  transactionRefs: readonly string[];
  evidenceRefs: readonly string[];
  observedAt: string;
  authority: 'BUSINESS_OUTCOME_OBSERVATION_ONLY';
  externalActionAuthorized: false;
  moneyMovementAuthorized: false;
}

export interface SocialDestinationPerformance {
  destinationId: string;
  clicks: number;
  conversions: number;
  qualifiedCaptures: number;
  realizedRevenueByCurrency: Readonly<Record<string, number>>;
  observationCount: number;
  evidenceRefs: readonly string[];
}

export function buildSocialBusinessDestinationSet(input: {
  id: string;
  subjectId: GrowthId;
  brandId: GrowthId;
  sourceSurfaceRef: string;
  sourcePlatform: string;
  destinations: readonly SocialBusinessDestination[];
  evidenceRefs: readonly string[];
}): SocialBusinessDestinationSet {
  requireText(input.id, 'id');
  requireText(input.subjectId, 'subjectId');
  requireText(input.brandId, 'brandId');
  requireText(input.sourceSurfaceRef, 'sourceSurfaceRef');
  requireText(input.sourcePlatform, 'sourcePlatform');
  if (!input.destinations.length) {
    throw new Error('SOCIAL_DESTINATION_SET_DESTINATIONS_REQUIRED');
  }
  if (!input.evidenceRefs.length) {
    throw new Error('SOCIAL_DESTINATION_SET_EVIDENCE_REQUIRED');
  }

  const seenIds = new Set<string>();
  const seenAttribution = new Set<string>();
  for (const destination of input.destinations) {
    validateDestination(destination);
    if (seenIds.has(destination.id)) {
      throw new Error('SOCIAL_DESTINATION_DUPLICATE_ID');
    }
    if (seenAttribution.has(destination.attributionKey)) {
      throw new Error('SOCIAL_DESTINATION_DUPLICATE_ATTRIBUTION_KEY');
    }
    seenIds.add(destination.id);
    seenAttribution.add(destination.attributionKey);
  }

  return Object.freeze({
    id: input.id.trim(),
    subjectId: input.subjectId,
    brandId: input.brandId,
    sourceSurfaceRef: input.sourceSurfaceRef.trim(),
    sourcePlatform: input.sourcePlatform.trim().toLowerCase(),
    destinations: Object.freeze(
      input.destinations.map((destination) => Object.freeze({
        ...destination,
        evidenceRefs: Object.freeze(unique(destination.evidenceRefs)),
      })),
    ),
    evidenceRefs: Object.freeze(unique([
      ...input.evidenceRefs,
      ...input.destinations.flatMap((destination) => destination.evidenceRefs),
    ])),
    policy: Object.freeze({
      sourceAndDestinationLineageRequired: true as const,
      destinationSpecificAttributionRequired: true as const,
      vanityMetricsCannotProveBusinessOutcome: true as const,
      approvedCommissionIsNotRealizedRevenue: true as const,
      realizedRevenueRequiresCanonicalEconomicEvidence: true as const,
    }),
    authority: 'ATTRIBUTION_PLANNING_ONLY' as const,
    externalActionAuthorized: false as const,
    publicationAuthority: 'NONE' as const,
    moneyMovementAuthority: 'NONE' as const,
  });
}

export function facelessYouTubeAffiliateDestinationSet(input: {
  id: string;
  subjectId: GrowthId;
  brandId: GrowthId;
  property: OwnedMediaProperty;
  affiliatePortfolio: SideHustleAffiliatePortfolioTruth;
  destinationRefsByProgram: Readonly<Record<string, string>>;
  disclosureEvidenceRefs: readonly string[];
  evidenceRefs: readonly string[];
}): SocialBusinessDestinationSet {
  if (input.property.propertyType !== 'youtube_channel') {
    throw new Error('SOCIAL_DESTINATION_FACELESS_REQUIRES_YOUTUBE_PROPERTY');
  }
  if (input.property.status !== 'active') {
    throw new Error('SOCIAL_DESTINATION_FACELESS_PROPERTY_NOT_ACTIVE');
  }
  if (!input.disclosureEvidenceRefs.length) {
    throw new Error('SOCIAL_DESTINATION_AFFILIATE_DISCLOSURE_EVIDENCE_REQUIRED');
  }
  if (!input.affiliatePortfolio.programs.length) {
    throw new Error('SOCIAL_DESTINATION_AFFILIATE_PROGRAM_TRUTH_REQUIRED');
  }

  const destinations = input.affiliatePortfolio.programs.map((program) =>
    affiliateDestination(program, input.destinationRefsByProgram),
  );

  return buildSocialBusinessDestinationSet({
    id: input.id,
    subjectId: input.subjectId,
    brandId: input.brandId,
    sourceSurfaceRef: input.property.id,
    sourcePlatform: 'youtube',
    destinations,
    evidenceRefs: unique([
      ...input.evidenceRefs,
      ...input.property.evidenceRefs,
      ...input.disclosureEvidenceRefs,
      ...input.affiliatePortfolio.programs.flatMap((program) => program.evidenceRefs),
    ]),
  });
}

export function pupsonStuffSocialCommerceDestinationSet(input: {
  id: string;
  subjectId: GrowthId;
  sourceAccountRef: string;
  platform: 'instagram' | 'tiktok' | 'facebook' | 'pinterest' | 'youtube';
  storefrontRef: string;
  checkoutRef: string;
  productRefs: readonly string[];
  catalogEvidenceRefs: readonly string[];
  commerceEvidenceRefs: readonly string[];
}): SocialBusinessDestinationSet {
  requireText(input.sourceAccountRef, 'sourceAccountRef');
  requireText(input.storefrontRef, 'storefrontRef');
  requireText(input.checkoutRef, 'checkoutRef');
  if (!input.productRefs.length) {
    throw new Error('SOCIAL_DESTINATION_PUPSON_PRODUCTS_REQUIRED');
  }
  if (!input.catalogEvidenceRefs.length) {
    throw new Error('SOCIAL_DESTINATION_PUPSON_CATALOG_EVIDENCE_REQUIRED');
  }
  if (!input.commerceEvidenceRefs.length) {
    throw new Error('SOCIAL_DESTINATION_PUPSON_COMMERCE_EVIDENCE_REQUIRED');
  }

  const destinations: SocialBusinessDestination[] = [
    {
      id: `${input.id}:storefront`,
      kind: 'storefront',
      owner: 'pupsonstuff',
      destinationRef: input.storefrontRef.trim(),
      attributionKey: `pupsonstuff:storefront:${safe(input.storefrontRef)}`,
      objective: 'product_sale',
      evidenceRefs: unique(input.commerceEvidenceRefs),
    },
    {
      id: `${input.id}:checkout`,
      kind: 'checkout',
      owner: 'pupsonstuff',
      destinationRef: input.checkoutRef.trim(),
      attributionKey: `pupsonstuff:checkout:${safe(input.checkoutRef)}`,
      objective: 'checkout',
      evidenceRefs: unique(input.commerceEvidenceRefs),
    },
    ...unique(input.productRefs).map((productRef) => ({
      id: `${input.id}:product:${safe(productRef)}`,
      kind: 'product' as const,
      owner: 'pupsonstuff' as const,
      destinationRef: productRef,
      attributionKey: `pupsonstuff:product:${safe(productRef)}`,
      objective: 'product_sale' as const,
      evidenceRefs: unique(input.catalogEvidenceRefs),
    })),
  ];

  return buildSocialBusinessDestinationSet({
    id: input.id,
    subjectId: input.subjectId,
    brandId: 'brand:pupsonstuff',
    sourceSurfaceRef: input.sourceAccountRef,
    sourcePlatform: input.platform,
    destinations,
    evidenceRefs: unique([
      ...input.catalogEvidenceRefs,
      ...input.commerceEvidenceRefs,
    ]),
  });
}

export function recordSocialDestinationOutcome(input: {
  id: string;
  destinationSet: SocialBusinessDestinationSet;
  destinationId: string;
  sourceContentRef: string;
  clicks?: number;
  conversions?: number;
  qualifiedCaptures?: number;
  realizedRevenue?: number;
  currency?: string;
  transactionRefs?: readonly string[];
  evidenceRefs: readonly string[];
  observedAt: string;
}): SocialDestinationOutcomeObservation {
  requireText(input.id, 'outcome.id');
  requireText(input.sourceContentRef, 'outcome.sourceContentRef');
  requireDate(input.observedAt, 'outcome.observedAt');
  if (!input.evidenceRefs.length) {
    throw new Error('SOCIAL_DESTINATION_OUTCOME_EVIDENCE_REQUIRED');
  }

  const destination = input.destinationSet.destinations.find(
    (candidate) => candidate.id === input.destinationId,
  );
  if (!destination) {
    throw new Error('SOCIAL_DESTINATION_OUTCOME_DESTINATION_NOT_FOUND');
  }

  for (const [field, value] of Object.entries({
    clicks: input.clicks,
    conversions: input.conversions,
    qualifiedCaptures: input.qualifiedCaptures,
    realizedRevenue: input.realizedRevenue,
  })) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`SOCIAL_DESTINATION_OUTCOME_INVALID:${field}`);
    }
  }

  if (input.realizedRevenue !== undefined && !input.currency?.trim()) {
    throw new Error('SOCIAL_DESTINATION_OUTCOME_CURRENCY_REQUIRED');
  }
  if (
    input.realizedRevenue !== undefined
    && input.realizedRevenue > 0
    && !(input.transactionRefs?.length)
  ) {
    throw new Error('SOCIAL_DESTINATION_REALIZED_REVENUE_TRANSACTION_REQUIRED');
  }

  return Object.freeze({
    id: input.id.trim(),
    destinationSetId: input.destinationSet.id,
    destinationId: destination.id,
    sourceContentRef: input.sourceContentRef.trim(),
    clicks: input.clicks,
    conversions: input.conversions,
    qualifiedCaptures: input.qualifiedCaptures,
    realizedRevenue: input.realizedRevenue,
    currency: input.currency?.trim().toUpperCase(),
    transactionRefs: Object.freeze(unique(input.transactionRefs ?? [])),
    evidenceRefs: Object.freeze(unique([
      ...input.evidenceRefs,
      ...destination.evidenceRefs,
    ])),
    observedAt: input.observedAt,
    authority: 'BUSINESS_OUTCOME_OBSERVATION_ONLY' as const,
    externalActionAuthorized: false as const,
    moneyMovementAuthorized: false as const,
  });
}

export function summarizeSocialDestinationPerformance(
  destinationSet: SocialBusinessDestinationSet,
  observations: readonly SocialDestinationOutcomeObservation[],
): SocialDestinationPerformance[] {
  const buckets = new Map<string, {
    clicks: number;
    conversions: number;
    qualifiedCaptures: number;
    revenue: Record<string, number>;
    count: number;
    evidenceRefs: string[];
  }>();

  for (const observation of observations) {
    if (observation.destinationSetId !== destinationSet.id) {
      throw new Error('SOCIAL_DESTINATION_OUTCOME_SET_MISMATCH');
    }
    if (!destinationSet.destinations.some(
      (destination) => destination.id === observation.destinationId,
    )) {
      throw new Error('SOCIAL_DESTINATION_OUTCOME_DESTINATION_NOT_FOUND');
    }

    const bucket = buckets.get(observation.destinationId) ?? {
      clicks: 0,
      conversions: 0,
      qualifiedCaptures: 0,
      revenue: {},
      count: 0,
      evidenceRefs: [],
    };
    bucket.clicks += observation.clicks ?? 0;
    bucket.conversions += observation.conversions ?? 0;
    bucket.qualifiedCaptures += observation.qualifiedCaptures ?? 0;
    bucket.count += 1;
    bucket.evidenceRefs.push(...observation.evidenceRefs);
    if (observation.realizedRevenue !== undefined && observation.currency) {
      bucket.revenue[observation.currency] = roundMoney(
        (bucket.revenue[observation.currency] ?? 0) + observation.realizedRevenue,
      );
    }
    buckets.set(observation.destinationId, bucket);
  }

  return destinationSet.destinations.map((destination) => {
    const bucket = buckets.get(destination.id);
    return Object.freeze({
      destinationId: destination.id,
      clicks: bucket?.clicks ?? 0,
      conversions: bucket?.conversions ?? 0,
      qualifiedCaptures: bucket?.qualifiedCaptures ?? 0,
      realizedRevenueByCurrency: Object.freeze({ ...(bucket?.revenue ?? {}) }),
      observationCount: bucket?.count ?? 0,
      evidenceRefs: Object.freeze(unique([
        ...destination.evidenceRefs,
        ...(bucket?.evidenceRefs ?? []),
      ])),
    });
  });
}

function affiliateDestination(
  program: SideHustleAffiliateProgramTruth,
  destinationRefsByProgram: Readonly<Record<string, string>>,
): SocialBusinessDestination {
  const destinationRef = destinationRefsByProgram[program.programRef]?.trim();
  if (!destinationRef) {
    throw new Error(
      `SOCIAL_DESTINATION_AFFILIATE_DESTINATION_REF_REQUIRED:${program.programRef}`,
    );
  }
  return Object.freeze({
    id: `affiliate:${safe(program.providerRef)}:${safe(program.programRef)}`,
    kind: 'affiliate_program' as const,
    owner: 'affiliate' as const,
    destinationRef,
    attributionKey: `affiliate:${safe(program.providerRef)}:${safe(program.programRef)}`,
    objective: 'affiliate_conversion' as const,
    evidenceRefs: Object.freeze(unique(program.evidenceRefs)),
  });
}

function validateDestination(destination: SocialBusinessDestination): void {
  requireText(destination.id, 'destination.id');
  requireText(destination.destinationRef, 'destination.destinationRef');
  requireText(destination.attributionKey, 'destination.attributionKey');
  if (!destination.evidenceRefs.length) {
    throw new Error('SOCIAL_DESTINATION_EVIDENCE_REQUIRED');
  }
}

function requireText(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`SOCIAL_DESTINATION_FIELD_REQUIRED:${field}`);
  }
}

function requireDate(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`SOCIAL_DESTINATION_DATE_INVALID:${field}`);
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function safe(value: string): string {
  return value.replace(/[^0-9A-Za-z:_-]+/g, '-').slice(0, 120);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
