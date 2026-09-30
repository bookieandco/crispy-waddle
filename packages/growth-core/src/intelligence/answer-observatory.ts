import type { GrowthId, ISODateTime } from '../domain/types.js';

export type AnswerAccuracy =
  | 'accurate'
  | 'partially_accurate'
  | 'inaccurate'
  | 'unknown';

export interface AnswerCitation {
  url: string;
  label?: string;
}

export interface AnswerEngineObservation {
  id: GrowthId;
  campaignId: GrowthId;
  engine: string;
  surface: string;
  query: string;
  queryFamily?: string;
  answerText: string;
  responseHash: string;
  citations: readonly AnswerCitation[];
  mentionedEntityIds: readonly GrowthId[];
  accuracy: AnswerAccuracy;
  market?: string;
  locale?: string;
  observedAt: ISODateTime;
  evidenceRefs: readonly string[];
  authority: 'OBSERVATION_ONLY';
}

export interface AnswerObservationDelta {
  previousId: GrowthId;
  currentId: GrowthId;
  answerChanged: boolean;
  accuracyChanged: boolean;
  mentionsAdded: readonly GrowthId[];
  mentionsRemoved: readonly GrowthId[];
  citationsAdded: readonly string[];
  citationsRemoved: readonly string[];
}

export interface AnswerObservatorySummary {
  campaignId: GrowthId;
  observations: number;
  distinctEngines: number;
  mentionedObservations: number;
  citedObservations: number;
  accurate: number;
  partiallyAccurate: number;
  inaccurate: number;
  unknownAccuracy: number;
  latestObservedAt?: ISODateTime;
}

export function createAnswerEngineObservation(
  input: Omit<AnswerEngineObservation, 'authority'>,
): AnswerEngineObservation {
  if (!input.id.trim() || !input.campaignId.trim()) {
    throw new Error('GROWTH_ANSWER_OBSERVATION_ID_REQUIRED');
  }
  if (!clean(input.engine) || !clean(input.surface) || !clean(input.query)) {
    throw new Error('GROWTH_ANSWER_OBSERVATION_CONTEXT_REQUIRED');
  }
  if (!input.responseHash.trim()) throw new Error('GROWTH_ANSWER_OBSERVATION_HASH_REQUIRED');
  if (!Number.isFinite(Date.parse(input.observedAt))) {
    throw new Error('GROWTH_ANSWER_OBSERVATION_TIME_INVALID');
  }
  if (!input.evidenceRefs.length) throw new Error('GROWTH_ANSWER_OBSERVATION_EVIDENCE_REQUIRED');

  const citationUrls = new Set<string>();
  for (const citation of input.citations) {
    assertHttpUrl(citation.url);
    if (citationUrls.has(citation.url)) throw new Error('GROWTH_ANSWER_CITATION_DUPLICATE');
    citationUrls.add(citation.url);
  }

  return Object.freeze({
    ...input,
    engine: clean(input.engine),
    surface: clean(input.surface),
    query: clean(input.query),
    queryFamily: input.queryFamily ? clean(input.queryFamily) : undefined,
    answerText: input.answerText.trim(),
    citations: Object.freeze(input.citations.map((citation) => Object.freeze({ ...citation }))),
    mentionedEntityIds: Object.freeze([...new Set(input.mentionedEntityIds)]),
    evidenceRefs: Object.freeze([...new Set(input.evidenceRefs)]),
    authority: 'OBSERVATION_ONLY',
  });
}

export function compareAnswerObservations(
  previous: AnswerEngineObservation,
  current: AnswerEngineObservation,
): AnswerObservationDelta {
  if (previous.campaignId !== current.campaignId) {
    throw new Error('GROWTH_ANSWER_DELTA_CAMPAIGN_MISMATCH');
  }
  if (previous.engine !== current.engine || normalizedQuery(previous.query) !== normalizedQuery(current.query)) {
    throw new Error('GROWTH_ANSWER_DELTA_CONTEXT_MISMATCH');
  }
  const previousMentions = new Set(previous.mentionedEntityIds);
  const currentMentions = new Set(current.mentionedEntityIds);
  const previousCitations = new Set(previous.citations.map((citation) => citation.url));
  const currentCitations = new Set(current.citations.map((citation) => citation.url));

  return {
    previousId: previous.id,
    currentId: current.id,
    answerChanged: previous.responseHash !== current.responseHash,
    accuracyChanged: previous.accuracy !== current.accuracy,
    mentionsAdded: Object.freeze([...currentMentions].filter((id) => !previousMentions.has(id))),
    mentionsRemoved: Object.freeze([...previousMentions].filter((id) => !currentMentions.has(id))),
    citationsAdded: Object.freeze([...currentCitations].filter((url) => !previousCitations.has(url))),
    citationsRemoved: Object.freeze([...previousCitations].filter((url) => !currentCitations.has(url))),
  };
}

export function summarizeAnswerObservatory(
  campaignId: GrowthId,
  observations: readonly AnswerEngineObservation[],
): AnswerObservatorySummary {
  const rows = observations.filter((row) => row.campaignId === campaignId);
  const times = rows.map((row) => Date.parse(row.observedAt)).filter(Number.isFinite);
  return {
    campaignId,
    observations: rows.length,
    distinctEngines: new Set(rows.map((row) => row.engine)).size,
    mentionedObservations: rows.filter((row) => row.mentionedEntityIds.length > 0).length,
    citedObservations: rows.filter((row) => row.citations.length > 0).length,
    accurate: rows.filter((row) => row.accuracy === 'accurate').length,
    partiallyAccurate: rows.filter((row) => row.accuracy === 'partially_accurate').length,
    inaccurate: rows.filter((row) => row.accuracy === 'inaccurate').length,
    unknownAccuracy: rows.filter((row) => row.accuracy === 'unknown').length,
    latestObservedAt: times.length ? new Date(Math.max(...times)).toISOString() : undefined,
  };
}

function assertHttpUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('GROWTH_ANSWER_CITATION_URL_INVALID');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('GROWTH_ANSWER_CITATION_URL_INVALID');
  }
}

function normalizedQuery(value: string): string {
  return clean(value).toLowerCase();
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
