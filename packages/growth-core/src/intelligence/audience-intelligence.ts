import type { GrowthId, ISODateTime } from '../domain/types.js';
import type { CustomerBehaviorEvent } from '../customer/customer-graph.js';

const SENSITIVE_FEATURES = new Set([
  'race', 'ethnicity', 'religion', 'health', 'medical', 'disability',
  'political', 'politics', 'party', 'union', 'gender', 'sex',
  'sexual_orientation', 'sexuality', 'sex_life', 'criminal_history',
]);

function normalizedFeatureName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function assertNonSensitiveFeatures(vector: Readonly<Record<string, number>>): void {
  for (const key of Object.keys(vector)) {
    if (SENSITIVE_FEATURES.has(normalizedFeatureName(key))) {
      throw new Error(`GROWTH_SENSITIVE_TARGETING_FEATURE_FORBIDDEN:${key}`);
    }
  }
}

export interface AudienceVector {
  entityId: GrowthId;
  features: Readonly<Record<string, number>>;
}

export interface AudiencePersona {
  seedIds: readonly GrowthId[];
  centroid: Readonly<Record<string, number>>;
  weights: Readonly<Record<string, number>>;
}

export function buildAudiencePersona(
  seeds: readonly AudienceVector[],
  populationSample: readonly AudienceVector[] = [],
): AudiencePersona {
  if (seeds.length === 0) throw new Error('GROWTH_LOOKALIKE_SEED_REQUIRED');
  for (const seed of seeds) assertNonSensitiveFeatures(seed.features);
  for (const candidate of populationSample) assertNonSensitiveFeatures(candidate.features);

  const featureNames = [...new Set(seeds.flatMap((seed) => Object.keys(seed.features)))].sort();
  const centroid: Record<string, number> = {};
  const weights: Record<string, number> = {};

  for (const feature of featureNames) {
    const seedMean = seeds.reduce((sum, seed) => sum + (seed.features[feature] ?? 0), 0) / seeds.length;
    centroid[feature] = seedMean;

    if (populationSample.length === 0) {
      weights[feature] = 1;
      continue;
    }

    const populationMean =
      populationSample.reduce((sum, candidate) => sum + (candidate.features[feature] ?? 0), 0)
      / populationSample.length;
    const divergence = Math.abs(seedMean - populationMean) / (Math.abs(seedMean) + Math.abs(populationMean) + 1);
    weights[feature] = Math.max(0.05, Math.min(1, divergence));
  }

  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0) || 1;
  for (const feature of featureNames) weights[feature] /= totalWeight;

  return { seedIds: seeds.map((seed) => seed.entityId), centroid, weights };
}

export interface LookalikeScore {
  entityId: GrowthId;
  score: number;
  topMatchingFeatures: readonly string[];
}

export function scoreLookalikeCandidate(persona: AudiencePersona, candidate: AudienceVector): LookalikeScore {
  assertNonSensitiveFeatures(candidate.features);
  const features = Object.keys(persona.centroid);
  let weightedDistance = 0;

  const matches = features.map((feature) => {
    const seedValue = persona.centroid[feature] ?? 0;
    const candidateValue = candidate.features[feature] ?? 0;
    const scale = Math.max(1, Math.abs(seedValue));
    const difference = Math.abs(candidateValue - seedValue) / scale;
    const weighted = difference * (persona.weights[feature] ?? 0);
    weightedDistance += weighted;
    return { feature, difference };
  });

  return {
    entityId: candidate.entityId,
    score: Math.max(0, Math.min(1, 1 / (1 + weightedDistance))),
    topMatchingFeatures: matches
      .sort((a, b) => a.difference - b.difference)
      .slice(0, 5)
      .map((item) => item.feature),
  };
}

const INTENT_WEIGHT: Readonly<Record<CustomerBehaviorEvent['type'], number>> = {
  page_view: 0.05,
  product_view: 0.16,
  site_search: 0.2,
  customization_started: 0.4,
  add_to_cart: 0.62,
  checkout_started: 0.82,
  purchase: 1,
  email_click: 0.18,
  sms_click: 0.22,
  social_engagement: 0.1,
  social_dm: 0.42,
  pricing_view: 0.5,
  demo_request: 0.82,
  form_submit: 0.68,
  refund: -0.55,
};

export interface PurchaseIntentScore {
  customerId: GrowthId;
  score: number;
  band: 'cold' | 'prospecting' | 'warm' | 'hot' | 'converted';
  evidenceEventIds: readonly GrowthId[];
  calculatedAt: ISODateTime;
}

export function scorePurchaseIntent(
  customerId: GrowthId,
  events: readonly CustomerBehaviorEvent[],
  now: Date = new Date(),
): PurchaseIntentScore {
  const eligible = events
    .filter((event) => event.customerId === customerId)
    .filter((event) => Number.isFinite(new Date(event.occurredAt).getTime()))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  let raw = 0;
  for (const event of eligible) {
    const ageDays = Math.max(0, (now.getTime() - new Date(event.occurredAt).getTime()) / 86_400_000);
    const recency = Math.pow(0.5, ageDays / 7);
    const confidence = Math.max(0, Math.min(1, event.confidence ?? 0.7));
    raw += INTENT_WEIGHT[event.type] * recency * confidence;
  }

  const hasPurchase = eligible.some((event) => event.type === 'purchase');
  const score = hasPurchase ? 1 : Math.max(0, Math.min(0.99, 1 - Math.exp(-Math.max(0, raw))));
  const band: PurchaseIntentScore['band'] =
    hasPurchase ? 'converted'
      : score >= 0.75 ? 'hot'
        : score >= 0.45 ? 'warm'
          : score >= 0.2 ? 'prospecting'
            : 'cold';

  return {
    customerId,
    score,
    band,
    evidenceEventIds: eligible.slice(0, 20).map((event) => event.id),
    calculatedAt: now.toISOString(),
  };
}

export interface RankedProspect {
  entityId: GrowthId;
  lookalikeScore: number;
  intentScore: number;
  combinedScore: number;
}

export function rankProspects(input: readonly Omit<RankedProspect, 'combinedScore'>[]): RankedProspect[] {
  return input
    .map((candidate) => ({
      ...candidate,
      combinedScore: Math.max(0, Math.min(1, candidate.lookalikeScore * 0.45 + candidate.intentScore * 0.55)),
    }))
    .sort((a, b) => b.combinedScore - a.combinedScore);
}
