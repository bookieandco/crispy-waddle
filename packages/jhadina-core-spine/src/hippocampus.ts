import type { EvidenceRef, Experience } from './types.js';

export interface HippocampalEpisode {
  episodeId: string;
  occurredAt: string;
  recordedAt?: string;
  createdAt?: string;
  source: string;
  domain?: string;
  actor: Experience['actor'];
  outcome?: string;
  correlationId?: string;
  causationId?: string;
  sensitivity?: string;
  provenance?: Record<string, unknown>;
  content: string;
  evidence: EvidenceRef[];
  metadata?: Record<string, unknown>;
  indexedTerms: string[];
}

export interface ExperienceEventRow {
  event_id: string;
  occurred_at: string;
  recorded_at: string;
  created_at: string;
  source: string;
  domain: string | null;
  actor: Experience['actor'];
  outcome: string | null;
  correlation_id: string | null;
  causation_id: string | null;
  sensitivity: string;
  provenance: Record<string, unknown>;
  evidence: EvidenceRef[];
  content: string;
  metadata: Record<string, unknown> | null;
}

export interface HippocampusIndex {
  encode(experience: Experience): HippocampalEpisode;
  decode(row: ExperienceEventRow): Experience;
  related(episodes: HippocampalEpisode[], query: string): HippocampalEpisode[];
}

function tokenize(value: string): string[] {
  return [...new Set(value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [])];
}

function validateExperience(experience: Experience): void {
  if (!experience.id.trim()) throw new RangeError('experience.id must not be empty');
  if (!experience.content.trim()) throw new RangeError('experience.content must not be empty');
  if (!experience.source.trim()) throw new RangeError('experience.source must not be empty');
  if (!Number.isFinite(Date.parse(experience.occurredAt))) throw new RangeError('experience.occurredAt must be a valid timestamp');
}

function validateRow(row: ExperienceEventRow): void {
  if (!row.event_id.trim()) throw new RangeError('event_id must not be empty');
  if (!row.content.trim()) throw new RangeError('content must not be empty');
  if (!Number.isFinite(Date.parse(row.occurred_at))) throw new RangeError('occurred_at must be a valid timestamp');
  if (!Number.isFinite(Date.parse(row.recorded_at))) throw new RangeError('recorded_at must be a valid timestamp');
  if (!Number.isFinite(Date.parse(row.created_at))) throw new RangeError('created_at must be a valid timestamp');
}

export function encodeHippocampalEpisode(experience: Experience): HippocampalEpisode {
  validateExperience(experience);
  return {
    episodeId: experience.id,
    occurredAt: experience.occurredAt,
    recordedAt: experience.recordedAt,
    createdAt: experience.createdAt,
    source: experience.source,
    domain: experience.domain,
    actor: experience.actor,
    outcome: experience.outcome,
    correlationId: experience.correlationId,
    causationId: experience.causationId,
    sensitivity: experience.sensitivity,
    provenance: experience.provenance ? { ...experience.provenance } : undefined,
    content: experience.content,
    evidence: experience.evidence.map((ref) => ({ ...ref })),
    metadata: experience.metadata ? { ...experience.metadata } : undefined,
    indexedTerms: tokenize([experience.source, experience.domain ?? '', experience.outcome ?? '', experience.content].join(' ')),
  };
}

export function experienceEventRowToExperience(row: ExperienceEventRow): Experience {
  validateRow(row);
  return {
    id: row.event_id,
    occurredAt: row.occurred_at,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    source: row.source,
    domain: row.domain ?? undefined,
    actor: row.actor,
    outcome: row.outcome ?? undefined,
    correlationId: row.correlation_id ?? undefined,
    causationId: row.causation_id ?? undefined,
    sensitivity: row.sensitivity,
    provenance: { ...row.provenance },
    content: row.content,
    evidence: row.evidence.map((ref) => ({ ...ref })),
    metadata: row.metadata ? { ...row.metadata } : undefined,
  };
}

export function experienceToEventRow(experience: Experience): Omit<ExperienceEventRow, 'recorded_at' | 'created_at'> {
  validateExperience(experience);
  return {
    event_id: experience.id,
    occurred_at: experience.occurredAt,
    source: experience.source,
    domain: experience.domain ?? null,
    actor: experience.actor,
    outcome: experience.outcome ?? null,
    correlation_id: experience.correlationId ?? null,
    causation_id: experience.causationId ?? null,
    sensitivity: experience.sensitivity ?? 'normal',
    provenance: { ...(experience.provenance ?? {}) },
    evidence: experience.evidence.map((ref) => ({ ...ref })),
    content: experience.content,
    metadata: experience.metadata ? { ...experience.metadata } : null,
  };
}

export function retrieveRelatedEpisodes(episodes: HippocampalEpisode[], query: string): HippocampalEpisode[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  return episodes
    .map((episode, inputOrder) => ({ episode, inputOrder, score: terms.reduce((score, term) => score + (episode.indexedTerms.includes(term) ? 1 : 0), 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.episode.occurredAt.localeCompare(a.episode.occurredAt) || a.episode.episodeId.localeCompare(b.episode.episodeId) || a.inputOrder - b.inputOrder)
    .map(({ episode }) => episode);
}

export function createHippocampusIndex(): HippocampusIndex {
  return { encode: encodeHippocampalEpisode, decode: experienceEventRowToExperience, related: retrieveRelatedEpisodes };
}