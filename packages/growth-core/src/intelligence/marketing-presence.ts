import type { GrowthId, ISODateTime } from '../domain/types.js';

export type SellableKind =
  | 'music'
  | 'merchandise'
  | 'service'
  | 'software'
  | 'film'
  | 'content'
  | 'commerce'
  | 'other';

export type CampaignMechanic =
  | 'experiment'
  | 'challenge'
  | 'demonstration'
  | 'story'
  | 'meme'
  | 'launch'
  | 'comparison'
  | 'community_prompt'
  | 'other';

export type PresenceSurface =
  | 'social:tiktok'
  | 'social:instagram'
  | 'social:youtube'
  | 'social:x'
  | 'social:facebook'
  | 'community:reddit'
  | 'search:google'
  | 'search:ai'
  | 'web:owned'
  | 'email'
  | (string & {});

export interface SellableOffer {
  id: GrowthId;
  brandId: GrowthId;
  name: string;
  kind: SellableKind;
  objective: 'awareness' | 'stream' | 'sale' | 'lead' | 'signup' | 'launch' | 'other';
  destinationUrl?: string;
  evidenceRefs: readonly string[];
}

export interface PresenceCampaignConcept {
  id: GrowthId;
  name: string;
  mechanic: CampaignMechanic;
  thesis: string;
  hook: string;
  evidenceRefs: readonly string[];
  targetQuestions: readonly string[];
}

export interface CrossOfferBridge {
  fromOfferId: GrowthId;
  toOfferId: GrowthId;
  relationship:
    | 'soundtrack'
    | 'product_placement'
    | 'bundle'
    | 'cross_promotion'
    | 'upsell'
    | 'proof'
    | 'story_world'
    | 'other';
  rationale: string;
}

export interface DurablePresencePlan {
  campaignId: GrowthId;
  question: string;
  surfaces: readonly PresenceSurface[];
  sourceOfferIds: readonly GrowthId[];
  evidenceRefs: readonly string[];
  authority: 'CONTENT_STRATEGY_ONLY';
}

export interface PresenceCampaign {
  id: GrowthId;
  brandId: GrowthId;
  concept: PresenceCampaignConcept;
  offerIds: readonly GrowthId[];
  bridges: readonly CrossOfferBridge[];
  durablePresence: readonly DurablePresencePlan[];
  createdAt: ISODateTime;
  authority: 'MARKETING_STRATEGY_ONLY';
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function assertOffer(offer: SellableOffer): void {
  if (!offer.id.trim() || !offer.brandId.trim() || !clean(offer.name)) {
    throw new Error('GROWTH_PRESENCE_OFFER_FIELDS_REQUIRED');
  }
  if (!offer.evidenceRefs.length) throw new Error('GROWTH_PRESENCE_OFFER_EVIDENCE_REQUIRED');
  if (offer.destinationUrl) {
    const url = new URL(offer.destinationUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('GROWTH_PRESENCE_OFFER_URL_INVALID');
    }
  }
}

function assertConcept(concept: PresenceCampaignConcept): void {
  if (!concept.id.trim() || !clean(concept.name) || !clean(concept.thesis) || !clean(concept.hook)) {
    throw new Error('GROWTH_PRESENCE_CONCEPT_FIELDS_REQUIRED');
  }
  if (!concept.evidenceRefs.length) throw new Error('GROWTH_PRESENCE_CONCEPT_EVIDENCE_REQUIRED');
  if (!concept.targetQuestions.length || concept.targetQuestions.some((question) => !clean(question))) {
    throw new Error('GROWTH_PRESENCE_TARGET_QUESTION_REQUIRED');
  }
}

export function buildPresenceCampaign(input: {
  id: GrowthId;
  brandId: GrowthId;
  concept: PresenceCampaignConcept;
  offers: readonly SellableOffer[];
  bridges?: readonly CrossOfferBridge[];
  durableSurfaces?: readonly PresenceSurface[];
  createdAt: ISODateTime;
}): PresenceCampaign {
  if (!input.id.trim() || !input.brandId.trim()) throw new Error('GROWTH_PRESENCE_CAMPAIGN_ID_REQUIRED');
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error('GROWTH_PRESENCE_CREATED_AT_INVALID');
  assertConcept(input.concept);
  if (!input.offers.length) throw new Error('GROWTH_PRESENCE_OFFER_REQUIRED');

  const offerIds = new Set<GrowthId>();
  const evidenceRefs = new Set<string>(input.concept.evidenceRefs);
  for (const offer of input.offers) {
    assertOffer(offer);
    if (offer.brandId !== input.brandId) throw new Error('GROWTH_PRESENCE_BRAND_MISMATCH');
    if (offerIds.has(offer.id)) throw new Error('GROWTH_PRESENCE_OFFER_DUPLICATE');
    offerIds.add(offer.id);
    offer.evidenceRefs.forEach((ref) => evidenceRefs.add(ref));
  }

  const bridges = [...(input.bridges ?? [])];
  for (const bridge of bridges) {
    if (!offerIds.has(bridge.fromOfferId) || !offerIds.has(bridge.toOfferId)) {
      throw new Error('GROWTH_PRESENCE_BRIDGE_OFFER_UNKNOWN');
    }
    if (bridge.fromOfferId === bridge.toOfferId) throw new Error('GROWTH_PRESENCE_BRIDGE_SELF_REFERENCE');
    if (!clean(bridge.rationale)) throw new Error('GROWTH_PRESENCE_BRIDGE_RATIONALE_REQUIRED');
  }

  const surfaces = input.durableSurfaces ?? [
    'web:owned',
    'search:google',
    'search:ai',
    'social:youtube',
  ];

  const durablePresence = input.concept.targetQuestions.map<DurablePresencePlan>((question) => Object.freeze({
    campaignId: input.id,
    question: clean(question),
    surfaces: Object.freeze([...new Set(surfaces)]),
    sourceOfferIds: Object.freeze([...offerIds]),
    evidenceRefs: Object.freeze([...evidenceRefs]),
    authority: 'CONTENT_STRATEGY_ONLY',
  }));

  return Object.freeze({
    id: input.id,
    brandId: input.brandId,
    concept: Object.freeze({ ...input.concept }),
    offerIds: Object.freeze([...offerIds]),
    bridges: Object.freeze(bridges.map((bridge) => Object.freeze({ ...bridge }))),
    durablePresence: Object.freeze(durablePresence),
    createdAt: input.createdAt,
    authority: 'MARKETING_STRATEGY_ONLY',
  });
}

export interface PresenceObservation {
  id: GrowthId;
  campaignId: GrowthId;
  surface: PresenceSurface;
  queryOrContext: string;
  observedAt: ISODateTime;
  outcome: 'mentioned' | 'cited' | 'visited' | 'streamed' | 'added_to_cart' | 'purchased' | 'signed_up' | 'not_observed';
  sourceLocator?: string;
  value?: number;
  evidenceRefs: readonly string[];
}

export interface PresenceLearningSummary {
  campaignId: GrowthId;
  observations: number;
  mentions: number;
  citations: number;
  conversions: number;
  conversionValue: number;
  surfaces: readonly PresenceSurface[];
  evidenceRefs: readonly string[];
}

export function summarizePresenceLearning(
  campaignId: GrowthId,
  observations: readonly PresenceObservation[],
): PresenceLearningSummary {
  const rows = observations.filter((row) => row.campaignId === campaignId);
  for (const row of rows) {
    if (!row.id.trim() || !clean(row.queryOrContext)) throw new Error('GROWTH_PRESENCE_OBSERVATION_FIELDS_REQUIRED');
    if (!Number.isFinite(Date.parse(row.observedAt))) throw new Error('GROWTH_PRESENCE_OBSERVATION_TIME_INVALID');
    if (!row.evidenceRefs.length) throw new Error('GROWTH_PRESENCE_OBSERVATION_EVIDENCE_REQUIRED');
  }
  const conversionOutcomes = new Set(['streamed', 'added_to_cart', 'purchased', 'signed_up']);
  return {
    campaignId,
    observations: rows.length,
    mentions: rows.filter((row) => row.outcome === 'mentioned').length,
    citations: rows.filter((row) => row.outcome === 'cited').length,
    conversions: rows.filter((row) => conversionOutcomes.has(row.outcome)).length,
    conversionValue: rows.reduce((sum, row) => sum + (row.value ?? 0), 0),
    surfaces: Object.freeze([...new Set(rows.map((row) => row.surface))]),
    evidenceRefs: Object.freeze([...new Set(rows.flatMap((row) => row.evidenceRefs))]),
  };
}
