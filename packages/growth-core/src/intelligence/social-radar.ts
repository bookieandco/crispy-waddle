import type { GrowthId } from '../domain/types.js';

export type SocialRadarSource =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'douyin'
  | 'youtube'
  | 'x'
  | 'threads'
  | 'bluesky'
  | 'reddit'
  | 'linkedin'
  | 'pinterest'
  | 'hackernews'
  | 'github'
  | 'web';

export type SocialRadarSourceState =
  | 'working'
  | 'unverified'
  | 'not_working'
  | 'available';

export interface SocialRadarSourceHealth {
  id: string;
  source: SocialRadarSource;
  state: SocialRadarSourceState;
  checkedAt: string;
  reason?: string;
  evidenceRefs: readonly string[];
}

export interface SocialRadarObservation {
  id: GrowthId;
  source: SocialRadarSource;
  sourceItemId?: string;
  canonicalStoryKey: string;
  topic: string;
  text?: string;
  url?: string;
  publishedAt?: string;
  observedAt: string;
  relevance: number;
  engagement: number;
  freshness: number;
  brandFit: number;
  commercialIntent: number;
  audienceSignals: readonly string[];
  evidenceRefs: readonly string[];
  sourceHealthId: string;
}

export interface SocialRadarRankedObservation extends SocialRadarObservation {
  score: number;
}

export interface SocialRadarCluster {
  canonicalStoryKey: string;
  topic: string;
  sources: readonly SocialRadarSource[];
  observationIds: readonly GrowthId[];
  audienceSignals: readonly string[];
  score: number;
  corroboration: number;
  evidenceRefs: readonly string[];
}

export interface SocialRadarReport {
  generatedAt: string;
  observations: readonly SocialRadarRankedObservation[];
  clusters: readonly SocialRadarCluster[];
  sourceHealth: readonly SocialRadarSourceHealth[];
  coverage: Readonly<{
    working: readonly SocialRadarSource[];
    unverified: readonly SocialRadarSource[];
    notWorking: readonly SocialRadarSource[];
    available: readonly SocialRadarSource[];
  }>;
  policy: Readonly<{
    readOnlyResearch: true;
    publicMediaReuseAuthority: 'NONE';
    stylePolicy: 'EXTRACT_MECHANICS_NOT_IDENTITY';
    absenceLaw: 'SOURCE_FAILURE_IS_NOT_ZERO_DEMAND';
  }>;
  authority: 'RESEARCH_ONLY';
  externalActionAuthorized: false;
}

export function buildSocialRadar(input: {
  observations: readonly SocialRadarObservation[];
  sourceHealth: readonly SocialRadarSourceHealth[];
  generatedAt?: string;
}): SocialRadarReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  requireDate(generatedAt, 'generatedAt');

  const healthById = new Map<string, SocialRadarSourceHealth>();
  for (const health of input.sourceHealth) {
    validateHealth(health);
    if (healthById.has(health.id)) {
      throw new Error('SOCIAL_RADAR_HEALTH_DUPLICATE');
    }
    healthById.set(health.id, health);
  }

  const bestByIdentity = new Map<string, SocialRadarRankedObservation>();
  for (const observation of input.observations) {
    validateObservation(observation);
    const health = healthById.get(observation.sourceHealthId);
    if (!health || health.source !== observation.source) {
      throw new Error('SOCIAL_RADAR_HEALTH_MISMATCH');
    }
    if (!['working', 'unverified'].includes(health.state)) {
      throw new Error('SOCIAL_RADAR_OBSERVATION_FROM_UNAVAILABLE_SOURCE');
    }

    const ranked: SocialRadarRankedObservation = Object.freeze({
      ...observation,
      audienceSignals: Object.freeze(unique(observation.audienceSignals)),
      evidenceRefs: Object.freeze(unique(observation.evidenceRefs)),
      score: observationScore(observation),
    });

    const identity = observation.sourceItemId?.trim()
      ? `${observation.source}:${observation.sourceItemId.trim()}`
      : `${observation.source}:${observation.canonicalStoryKey.trim()}:${safe(observation.url ?? observation.id)}`;

    const current = bestByIdentity.get(identity);
    if (!current || ranked.score > current.score) {
      bestByIdentity.set(identity, ranked);
    }
  }

  const rankedObservations = [...bestByIdentity.values()]
    .sort((a, b) => b.score - a.score);

  const byStory = new Map<string, SocialRadarRankedObservation[]>();
  for (const observation of rankedObservations) {
    const key = observation.canonicalStoryKey.trim().toLowerCase();
    const group = byStory.get(key) ?? [];
    group.push(observation);
    byStory.set(key, group);
  }

  const clusters = [...byStory.entries()]
    .map(([key, group]) => buildCluster(key, group))
    .sort((a, b) => b.score - a.score);

  const byState = {
    working: [] as SocialRadarSource[],
    unverified: [] as SocialRadarSource[],
    not_working: [] as SocialRadarSource[],
    available: [] as SocialRadarSource[],
  };
  for (const health of input.sourceHealth) {
    byState[health.state].push(health.source);
  }

  return Object.freeze({
    generatedAt,
    observations: Object.freeze(rankedObservations),
    clusters: Object.freeze(clusters),
    sourceHealth: Object.freeze(input.sourceHealth.map((health) => Object.freeze({
      ...health,
      evidenceRefs: Object.freeze(unique(health.evidenceRefs)),
    }))),
    coverage: Object.freeze({
      working: Object.freeze(uniqueSources(byState.working)),
      unverified: Object.freeze(uniqueSources(byState.unverified)),
      notWorking: Object.freeze(uniqueSources(byState.not_working)),
      available: Object.freeze(uniqueSources(byState.available)),
    }),
    policy: Object.freeze({
      readOnlyResearch: true as const,
      publicMediaReuseAuthority: 'NONE' as const,
      stylePolicy: 'EXTRACT_MECHANICS_NOT_IDENTITY' as const,
      absenceLaw: 'SOURCE_FAILURE_IS_NOT_ZERO_DEMAND' as const,
    }),
    authority: 'RESEARCH_ONLY' as const,
    externalActionAuthorized: false as const,
  });
}

function buildCluster(
  canonicalStoryKey: string,
  observations: readonly SocialRadarRankedObservation[],
): SocialRadarCluster {
  const bestBySource = new Map<SocialRadarSource, SocialRadarRankedObservation>();
  for (const observation of observations) {
    const current = bestBySource.get(observation.source);
    if (!current || observation.score > current.score) {
      bestBySource.set(observation.source, observation);
    }
  }

  const independent = [...bestBySource.values()];
  const sourceCount = independent.length;
  const corroboration = round(Math.min(1, sourceCount / 3));
  const average = independent.reduce((sum, item) => sum + item.score, 0)
    / Math.max(1, independent.length);
  const score = round(Math.min(100, average + corroboration * 8));

  const strongest = [...independent].sort((a, b) => b.score - a.score)[0]!;
  return Object.freeze({
    canonicalStoryKey,
    topic: strongest.topic,
    sources: Object.freeze(independent.map((item) => item.source)),
    observationIds: Object.freeze(independent.map((item) => item.id)),
    audienceSignals: Object.freeze(unique(independent.flatMap((item) => item.audienceSignals))),
    score,
    corroboration,
    evidenceRefs: Object.freeze(unique(independent.flatMap((item) => item.evidenceRefs))),
  });
}

function observationScore(observation: SocialRadarObservation): number {
  return round(
    observation.relevance * 0.28
      + observation.brandFit * 0.22
      + observation.engagement * 0.18
      + observation.freshness * 0.14
      + observation.commercialIntent * 0.18,
  );
}

function validateHealth(health: SocialRadarSourceHealth): void {
  requireText(health.id, 'health.id');
  requireDate(health.checkedAt, 'health.checkedAt');
  if (!health.evidenceRefs.length) {
    throw new Error('SOCIAL_RADAR_HEALTH_EVIDENCE_REQUIRED');
  }
}

function validateObservation(observation: SocialRadarObservation): void {
  requireText(observation.id, 'observation.id');
  requireText(observation.canonicalStoryKey, 'observation.canonicalStoryKey');
  requireText(observation.topic, 'observation.topic');
  requireText(observation.sourceHealthId, 'observation.sourceHealthId');
  requireDate(observation.observedAt, 'observation.observedAt');

  if (observation.publishedAt) {
    requireDate(observation.publishedAt, 'observation.publishedAt');
  }
  if (!observation.evidenceRefs.length) {
    throw new Error('SOCIAL_RADAR_OBSERVATION_EVIDENCE_REQUIRED');
  }
  for (const [name, value] of Object.entries({
    relevance: observation.relevance,
    engagement: observation.engagement,
    freshness: observation.freshness,
    brandFit: observation.brandFit,
    commercialIntent: observation.commercialIntent,
  })) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`SOCIAL_RADAR_SCORE_INVALID:${name}`);
    }
  }
}

function requireText(value: string, field: string): void {
  if (!value.trim()) throw new Error(`SOCIAL_RADAR_FIELD_REQUIRED:${field}`);
}

function requireDate(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`SOCIAL_RADAR_DATE_INVALID:${field}`);
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueSources(values: readonly SocialRadarSource[]): SocialRadarSource[] {
  return [...new Set(values)];
}

function safe(value: string): string {
  return String(value).replace(/[^a-zA-Z0-9:_-]+/g, '-').slice(0, 180);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
