import type { HippocampalEpisode } from './hippocampus.js';
import type { EvidenceRef, MemoryProposal, PersonalityState } from './types.js';

export interface CallbackLearningInput {
  callback: string;
  episodes?: readonly HippocampalEpisode[];
  memories?: readonly MemoryProposal[];
  relationshipEvidence?: readonly EvidenceRef[];
  excludedEvidenceIds?: ReadonlySet<string>;
  minimumIndependentEvidence?: number;
}

export interface CallbackCandidate {
  callback: string;
  evidence: readonly EvidenceRef[];
  independentEvidenceCount: number;
  eligible: boolean;
  reasons: readonly string[];
}

function tokens(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [];
}

function normalized(value: string): string {
  return tokens(value).join(' ');
}

function supports(value: string, callback: string): boolean {
  const expected = [...new Set(tokens(callback))];
  if (expected.length === 0) return false;
  const actual = new Set(tokens(value));
  return expected.every((token) => actual.has(token));
}

function valid(ref: EvidenceRef): boolean {
  return Boolean(
    ref.id.trim() &&
    ref.source.trim() &&
    ref.summary.trim() &&
    ref.immutable === true &&
    Number.isFinite(Date.parse(ref.observedAt)),
  );
}

function directEpisodeEvidence(episode: HippocampalEpisode): EvidenceRef {
  return {
    id: episode.episodeId,
    source: episode.source,
    observedAt: episode.occurredAt,
    summary: episode.content,
    immutable: true,
  };
}

function collect(input: CallbackLearningInput): EvidenceRef[] {
  const excluded = input.excludedEvidenceIds ?? new Set<string>();
  const refs: EvidenceRef[] = [];

  for (const ref of input.relationshipEvidence ?? []) {
    if (valid(ref) && !excluded.has(ref.id) && supports(ref.summary, input.callback)) refs.push({ ...ref });
  }

  for (const memory of input.memories ?? []) {
    if (memory.disposition !== 'SAVE' || !supports(memory.content, input.callback)) continue;
    for (const ref of memory.evidence) {
      if (valid(ref) && !excluded.has(ref.id) && supports(ref.summary, input.callback)) refs.push({ ...ref });
    }
  }

  for (const episode of input.episodes ?? []) {
    if (!supports(episode.content, input.callback)) continue;
    const matching = episode.evidence.filter((ref) =>
      valid(ref) && !excluded.has(ref.id) && supports(ref.summary, input.callback)
    );
    if (matching.length) refs.push(...matching.map((ref) => ({ ...ref })));
    else {
      const ref = directEpisodeEvidence(episode);
      if (!excluded.has(ref.id)) refs.push(ref);
    }
  }

  const seen = new Set<string>();
  return refs
    .filter((ref) => {
      if (seen.has(ref.id)) return false;
      seen.add(ref.id);
      return true;
    })
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id));
}

/**
 * Builds a governed relationship-callback candidate. Repetition of the same
 * evidence id cannot inflate support, and mutable evidence is ignored.
 */
export function assessCallbackCandidate(input: CallbackLearningInput): CallbackCandidate {
  const callback = normalized(input.callback);
  if (!callback) {
    return Object.freeze({
      callback: '',
      evidence: Object.freeze([]),
      independentEvidenceCount: 0,
      eligible: false,
      reasons: Object.freeze(['empty-callback']),
    });
  }

  const evidence = collect(input);
  const minimum = Math.max(2, Math.floor(input.minimumIndependentEvidence ?? 2));
  const reasons: string[] = [];
  if (evidence.length < minimum) reasons.push('insufficient-independent-evidence');

  return Object.freeze({
    callback: input.callback.trim(),
    evidence: Object.freeze(evidence),
    independentEvidenceCount: evidence.length,
    eligible: evidence.length >= minimum,
    reasons: Object.freeze(reasons),
  });
}

/**
 * Admits an already-assessed callback into durable Relationship state.
 * This is intentionally separate from assessment so callers can put policy /
 * approval around admission when required.
 */
export function admitRecurringCallback(
  personality: PersonalityState,
  candidate: CallbackCandidate,
  now: string,
): PersonalityState {
  if (!candidate.eligible || !candidate.callback.trim()) return personality;
  if (!Number.isFinite(Date.parse(now))) throw new RangeError('callback admission now must be a valid timestamp');

  const relationship = personality.relationship ?? {
    familiarity: 0.5,
    calibrationConfidence: 0.5,
    preferredInteractionModes: [],
    recurringCallbacks: [],
    evidence: [],
  };
  const normalizedCandidate = normalized(candidate.callback);
  const callbacks = relationship.recurringCallbacks.some((item) => normalized(item) === normalizedCandidate)
    ? [...relationship.recurringCallbacks]
    : [...relationship.recurringCallbacks, candidate.callback];

  const evidenceById = new Map<string, EvidenceRef>();
  for (const ref of [...relationship.evidence, ...candidate.evidence]) evidenceById.set(ref.id, { ...ref });

  return Object.freeze({
    ...personality,
    version: personality.version + 1,
    relationship: Object.freeze({
      ...relationship,
      recurringCallbacks: Object.freeze(callbacks),
      evidence: Object.freeze([...evidenceById.values()]),
    }),
    updatedAt: now,
  });
}

export function retireRecurringCallback(
  personality: PersonalityState,
  callback: string,
  now: string,
): PersonalityState {
  if (!personality.relationship) return personality;
  if (!Number.isFinite(Date.parse(now))) throw new RangeError('callback retirement now must be a valid timestamp');
  const target = normalized(callback);
  const recurringCallbacks = personality.relationship.recurringCallbacks
    .filter((item) => normalized(item) !== target);

  if (recurringCallbacks.length === personality.relationship.recurringCallbacks.length) return personality;

  return Object.freeze({
    ...personality,
    version: personality.version + 1,
    relationship: Object.freeze({
      ...personality.relationship,
      recurringCallbacks: Object.freeze(recurringCallbacks),
    }),
    updatedAt: now,
  });
}
