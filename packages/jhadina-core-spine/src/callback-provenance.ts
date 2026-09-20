import type { HippocampalEpisode } from './hippocampus.js';
import type { EvidenceRef, MemoryProposal, PersonalityState } from './types.js';

export type CallbackProvenanceOrigin = 'relationship' | 'memory' | 'hippocampus';

export interface CallbackProvenance {
  origin: CallbackProvenanceOrigin;
  evidence: EvidenceRef;
}

const VERIFIED_CALLBACK = Symbol('jhadina.verified-callback');

export interface VerifiedCallback {
  readonly value: string;
  readonly provenance: readonly CallbackProvenance[];
  readonly [VERIFIED_CALLBACK]: true;
}

export interface CallbackSelectionInput {
  personality: PersonalityState;
  callback: string;
  memories?: readonly MemoryProposal[];
  episodes?: readonly HippocampalEpisode[];
}

function lexicalTokens(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [];
}

function normalizedCallback(value: string): string {
  return lexicalTokens(value).join(' ');
}

function supportsCallback(value: string, callback: string): boolean {
  const callbackTokens = [...new Set(lexicalTokens(callback))];
  if (callbackTokens.length === 0) return false;
  const valueTokens = new Set(lexicalTokens(value));
  return callbackTokens.every((token) => valueTokens.has(token));
}

function validEvidence(ref: EvidenceRef): boolean {
  return Boolean(
    ref.id.trim() &&
    ref.source.trim() &&
    ref.summary.trim() &&
    Number.isFinite(Date.parse(ref.observedAt)),
  );
}

function cloneProvenance(origin: CallbackProvenanceOrigin, ref: EvidenceRef): CallbackProvenance {
  return {
    origin,
    evidence: { ...ref },
  };
}

function relationshipProvenance(personality: PersonalityState, callback: string): CallbackProvenance[] {
  return personality.relationship.evidence
    .filter(validEvidence)
    .filter((ref) => supportsCallback(ref.summary, callback))
    .map((ref) => cloneProvenance('relationship', ref));
}

function memoryProvenance(memories: readonly MemoryProposal[], callback: string): CallbackProvenance[] {
  return memories
    .filter((memory) => memory.disposition === 'SAVE' && supportsCallback(memory.content, callback))
    .flatMap((memory) => memory.evidence)
    .filter(validEvidence)
    .filter((ref) => supportsCallback(ref.summary, callback))
    .map((ref) => cloneProvenance('memory', ref));
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

function hippocampalProvenance(
  episodes: readonly HippocampalEpisode[],
  callback: string,
): CallbackProvenance[] {
  const output: CallbackProvenance[] = [];

  for (const episode of episodes) {
    if (!supportsCallback(episode.content, callback)) continue;

    const matchingRefs = episode.evidence
      .filter(validEvidence)
      .filter((ref) => supportsCallback(ref.summary, callback));

    if (matchingRefs.length > 0) {
      output.push(...matchingRefs.map((ref) => cloneProvenance('hippocampus', ref)));
    } else {
      output.push(cloneProvenance('hippocampus', directEpisodeEvidence(episode)));
    }
  }

  return output;
}

function dedupeProvenance(items: CallbackProvenance[]): CallbackProvenance[] {
  const seen = new Set<string>();
  const output: CallbackProvenance[] = [];

  for (const item of items) {
    if (seen.has(item.evidence.id)) continue;
    seen.add(item.evidence.id);
    output.push({
      origin: item.origin,
      evidence: { ...item.evidence },
    });
  }

  return output;
}

/**
 * Select a callback only when it is already present in governed Relationship
 * state and can be traced to actual Relationship, approved Memory, or
 * Hippocampus evidence. The selector never invents a callback.
 */
export function selectEvidenceBackedCallback(
  input: CallbackSelectionInput,
): VerifiedCallback | undefined {
  const normalized = normalizedCallback(input.callback);
  if (!normalized) return undefined;

  const knownCallback = input.personality.relationship.recurringCallbacks.some(
    (candidate) => normalizedCallback(candidate) === normalized,
  );
  if (!knownCallback) return undefined;

  const provenance = dedupeProvenance([
    ...relationshipProvenance(input.personality, input.callback),
    ...memoryProvenance(input.memories ?? [], input.callback),
    ...hippocampalProvenance(input.episodes ?? [], input.callback),
  ]);
  if (provenance.length === 0) return undefined;

  return {
    value: input.callback.trim(),
    provenance,
    [VERIFIED_CALLBACK]: true,
  };
}

export function isVerifiedCallback(value: unknown): value is VerifiedCallback {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<VerifiedCallback> & { [VERIFIED_CALLBACK]?: boolean };
  if (candidate[VERIFIED_CALLBACK] !== true) return false;
  if (typeof candidate.value !== 'string' || !candidate.value.trim()) return false;
  if (!Array.isArray(candidate.provenance) || candidate.provenance.length === 0) return false;

  return candidate.provenance.every(
    (item) =>
      Boolean(item) &&
      (item.origin === 'relationship' || item.origin === 'memory' || item.origin === 'hippocampus') &&
      validEvidence(item.evidence),
  );
}
