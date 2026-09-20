import type { PersonalityPort } from './spine.js';
import type {
  EvidenceRef,
  MemoryProposal,
  PatternObservation,
  PersonalityState,
  PersonalityTrait,
} from './types.js';
import { createBetaPrior, updateBetaBelief } from './bayesian-inference.js';

export interface PersonalityStateRepository {
  load(): Promise<PersonalityState>;
  save(expectedVersion: number, next: PersonalityState): Promise<void>;
}

export interface PersonalityCorePolicy {
  minimumEvidence: number;
  acceptanceConfidence: number;
  minimumStability: number;
  contradictionPenalty: number;
}

export const DEFAULT_PERSONALITY_CORE_POLICY: PersonalityCorePolicy = {
  minimumEvidence: 3,
  acceptanceConfidence: 0.8,
  minimumStability: 0.7,
  contradictionPenalty: 0.25,
};

export const DEFAULT_PERSONALITY_VOICE = {
  directness: 0.7,
  warmth: 0.6,
  humor: 0.7,
  profanityTolerance: 0.6,
  quipFrequency: 0.35,
  verbosity: 0.55,
  disagreementDirectness: 0.8,
};

export const DEFAULT_PERSONALITY_TASTE = {
  novelty: 0.6,
  experimentation: 0.6,
  conventionTolerance: 0.5,
  aestheticIntensity: 0.6,
  evidence: [] as EvidenceRef[],
};

export const DEFAULT_PERSONALITY_RELATIONSHIP = {
  familiarity: 0,
  calibrationConfidence: 0,
  preferredInteractionModes: [] as string[],
  recurringCallbacks: [] as string[],
  evidence: [] as EvidenceRef[],
};

export function emptyPersonalityState(now = new Date().toISOString()): PersonalityState {
  return {
    version: 0,
    traits: [],
    voice: { ...DEFAULT_PERSONALITY_VOICE },
    taste: { ...DEFAULT_PERSONALITY_TASTE, evidence: [] },
    relationship: { ...DEFAULT_PERSONALITY_RELATIONSHIP, evidence: [] },
    independentAssessmentRequired: true,
    updatedAt: now,
  };
}

function isFiniteUnit(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function normalizeStatement(statement: string): string {
  return statement.trim().replace(/\s+/g, ' ').toLowerCase();
}

function validEvidence(ref: EvidenceRef): boolean {
  return Boolean(ref.id.trim() && ref.source.trim() && ref.summary.trim() && Number.isFinite(Date.parse(ref.observedAt)));
}

function uniqueEvidence(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.id)) return false;
    seen.add(ref.id);
    return true;
  });
}

function approvedMemoryEvidence(memories: MemoryProposal[]): Set<string> {
  const ids = new Set<string>();
  for (const memory of memories) {
    if (memory.disposition !== 'SAVE') continue;
    for (const evidence of memory.evidence) ids.add(evidence.id);
  }
  return ids;
}

function evidenceIsAllowed(ref: EvidenceRef, approvedMemoryIds: Set<string>): boolean {
  if (!validEvidence(ref)) return false;
  if (ref.source === 'memory' && !approvedMemoryIds.has(ref.id)) return false;
  return true;
}

function traitStatus(
  evidenceCount: number,
  confidence: number,
  stability: number,
  contradictions: number,
  policy: PersonalityCorePolicy,
): PersonalityTrait['status'] {
  if (contradictions > 0) return 'contested';
  if (evidenceCount >= policy.minimumEvidence && confidence >= policy.acceptanceConfidence && stability >= policy.minimumStability) {
    return 'accepted';
  }
  return evidenceCount > 0 ? 'candidate' : 'retired';
}

/**
 * Pure projection from explicitly personality-eligible PatternObservations.
 * Bayesian evidence updating supplies the belief/confidence estimate; this
 * function still owns the separate governance gates for eligibility, stability,
 * contradiction, and durable personality state.
 */
export function projectPersonality(
  current: PersonalityState,
  patterns: PatternObservation[],
  memories: MemoryProposal[],
  now = new Date().toISOString(),
  policy: PersonalityCorePolicy = DEFAULT_PERSONALITY_CORE_POLICY,
  idFactory: () => string = () => crypto.randomUUID(),
): PersonalityState {
  const approvedMemoryIds = approvedMemoryEvidence(memories);
  const nextTraits = [...current.traits];
  let changed = false;

  for (const pattern of patterns) {
    if (!pattern.personalityEligible || !pattern.personalityDimension) continue;
    if (!isFiniteUnit(pattern.confidence) || !Number.isInteger(pattern.occurrences) || pattern.occurrences <= 0) continue;

    const evidence = uniqueEvidence(pattern.evidence.filter((ref) => evidenceIsAllowed(ref, approvedMemoryIds)));
    const contradictions = uniqueEvidence(pattern.contradictions.filter((ref) => evidenceIsAllowed(ref, approvedMemoryIds)));
    if (evidence.length === 0) continue;

    const key = `${pattern.personalityDimension}:${normalizeStatement(pattern.pattern)}`;
    const existingIndex = nextTraits.findIndex((trait) => `${trait.dimension}:${normalizeStatement(trait.statement)}` === key);
    const existing = existingIndex >= 0 ? nextTraits[existingIndex] : undefined;
    const mergedEvidence = uniqueEvidence([...(existing?.evidence ?? []), ...evidence]);
    const mergedContradictions = uniqueEvidence([...(existing?.contradictions ?? []), ...contradictions]);

    // Treat the pattern's confidence as the observed support for this trait.
    // Existing trait evidence becomes the prior; new evidence contributes
    // weighted pseudo-counts. This prevents a single observation from replacing
    // accumulated belief while preserving the existing governance thresholds.
    const prior = existing
      ? createBetaPrior(
          Math.max(existing.confidence * Math.max(existing.evidence.length, 1), 0.000001),
          Math.max((1 - existing.confidence) * Math.max(existing.evidence.length, 1), 0.000001),
        )
      : createBetaPrior(1, 1);
    const posterior = updateBetaBelief(prior, [
      { support: pattern.confidence, weight: Math.max(pattern.occurrences, 1) },
    ]);

    const confidenceBeforePenalty = posterior.mean;
    const confidence = Math.max(
      0,
      Math.min(1, confidenceBeforePenalty * (mergedContradictions.length > 0 ? 1 - policy.contradictionPenalty : 1)),
    );
    const stability = Math.max(
      existing?.stability ?? 0,
      Math.min(1, mergedEvidence.length / Math.max(policy.minimumEvidence, 1)),
    );
    const status = traitStatus(mergedEvidence.length, confidence, stability, mergedContradictions.length, policy);

    const trait: PersonalityTrait = {
      id: existing?.id ?? idFactory(),
      statement: existing?.statement ?? pattern.pattern.trim(),
      dimension: pattern.personalityDimension,
      confidence,
      stability,
      evidence: mergedEvidence,
      contradictions: mergedContradictions,
      status,
      firstObservedAt: existing?.firstObservedAt ?? pattern.lastObservedAt,
      lastObservedAt: pattern.lastObservedAt,
      revision: existing?.revision ?? 0,
    };

    if (!existing || JSON.stringify(existing) !== JSON.stringify(trait)) {
      changed = true;
      if (existingIndex >= 0) nextTraits[existingIndex] = trait;
      else nextTraits.push(trait);
    }
  }

  const independentAssessmentRequired = nextTraits.some(
    (trait) => trait.status === 'contested' || (trait.dimension === 'opinion' && trait.confidence < 0.8),
  );

  if (!changed && independentAssessmentRequired === current.independentAssessmentRequired) return current;

  return {
    ...current,
    version: current.version + 1,
    traits: nextTraits,
    independentAssessmentRequired,
    updatedAt: now,
  };
}

/** Stateful port adapter. Persistence remains outside the pure personality logic. */
export function createPersonalityPort(
  repository: PersonalityStateRepository,
  policy: PersonalityCorePolicy = DEFAULT_PERSONALITY_CORE_POLICY,
): PersonalityPort {
  return {
    async build(patterns, memories) {
      const current = await repository.load();
      const next = projectPersonality(current, patterns, memories, new Date().toISOString(), policy);
      if (next !== current) await repository.save(current.version, next);
      return next;
    },
  };
}
