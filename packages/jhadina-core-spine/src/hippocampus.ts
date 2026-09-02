import type { EvidenceRef, Experience } from './types.js';

/**
 * Hippocampus is Jhadina's episodic experience layer: it encodes and indexes
 * what happened so downstream learning systems can reason over experiences.
 * It does not decide memory approval, personality, values, policy, or actions.
 */
export interface HippocampalEpisode {
  episodeId: string;
  occurredAt: string;
  source: string;
  domain?: string;
  actor: Experience['actor'];
  content: string;
  evidence: EvidenceRef[];
  correlationId?: string;
  causationId?: string;
  indexedTerms: string[];
}

export interface HippocampusIndex {
  encode(experience: Experience): HippocampalEpisode;
  related(episodes: HippocampalEpisode[], query: string): HippocampalEpisode[];
}

function tokenize(value: string): string[] {
  return [...new Set(value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [])];
}

function validateExperience(experience: Experience): void {
  if (!experience.id.trim()) throw new RangeError('experience.id must not be empty');
  if (!experience.content.trim()) throw new RangeError('experience.content must not be empty');
  if (!Number.isFinite(Date.parse(experience.occurredAt))) throw new RangeError('experience.occurredAt must be a valid timestamp');
}

/** Deterministically encodes one Experience into an episodic representation. */
export function encodeHippocampalEpisode(experience: Experience): HippocampalEpisode {
  validateExperience(experience);
  return {
    episodeId: experience.id,
    occurredAt: experience.occurredAt,
    source: experience.source,
    domain: experience.domain,
    actor: experience.actor,
    content: experience.content,
    evidence: [...experience.evidence],
    indexedTerms: tokenize([experience.source, experience.domain ?? '', experience.content].join(' ')),
  };
}

/** Simple deterministic lexical retrieval; semantic ranking belongs upstream/downstream adapters. */
export function retrieveRelatedEpisodes(episodes: HippocampalEpisode[], query: string): HippocampalEpisode[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  return episodes
    .map((episode) => ({ episode, score: terms.reduce((score, term) => score + (episode.indexedTerms.includes(term) ? 1 : 0), 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.episode.occurredAt.localeCompare(a.episode.occurredAt))
    .map(({ episode }) => episode);
}

export function createHippocampusIndex(): HippocampusIndex {
  return {
    encode: encodeHippocampalEpisode,
    related: retrieveRelatedEpisodes,
  };
}
