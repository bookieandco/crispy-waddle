import { projectBayesianPattern } from './bayesian-pattern.js';
import type { MemoryProposal, PatternObservation, Experience, EvidenceRef } from './types.js';
import type { PatternPort } from './spine.js';

export interface PatternDetectionStrategy {
  detect(experience: Experience, memories: MemoryProposal[]): PatternObservation[];
}

function tokenize(value: string): string[] {
  return [...new Set(value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [])];
}

function experienceEvidence(experience: Experience): EvidenceRef[] {
  if (experience.evidence.length > 0) {
    return experience.evidence.map((ref) => ({ ...ref }));
  }

  return [{
    id: experience.id,
    source: experience.source,
    observedAt: experience.occurredAt,
    summary: experience.content,
    immutable: true,
  }];
}

function approvedMemoryEvidence(memories: MemoryProposal[]): EvidenceRef[] {
  return memories
    .filter((memory) => memory.disposition === 'SAVE')
    .flatMap((memory) => memory.evidence)
    .filter((ref) => ref.id.trim() && ref.source.trim() && ref.summary.trim())
    .map((ref) => ({ ...ref }));
}

/**
 * Conservative first Pattern strategy: identify terms that recur between the
 * current experience and approved/save memory evidence. It emits hypotheses
 * only; it never marks them personality-eligible.
 */
export class RecurrencePatternStrategy implements PatternDetectionStrategy {
  detect(experience: Experience, memories: MemoryProposal[]): PatternObservation[] {
    const experienceTerms = tokenize([experience.domain ?? '', experience.outcome ?? '', experience.content].join(' '));
    const memoryTerms = new Set(
      memories
        .filter((memory) => memory.disposition === 'SAVE')
        .flatMap((memory) => tokenize(memory.content)),
    );
    const recurringTerms = experienceTerms.filter((term) => memoryTerms.has(term));
    if (recurringTerms.length === 0) return [];

    const currentEvidence = experienceEvidence(experience);
    const savedEvidence = approvedMemoryEvidence(memories);
    const allEvidence = [...currentEvidence, ...savedEvidence];
    const evidenceCount = Math.max(1, allEvidence.length);

    return recurringTerms.map((term) => {
      const evidence = allEvidence.map((ref) => ({ ...ref }));
      const raw: PatternObservation = {
        id: `recurrence:${term}`,
        pattern: `recurring term: ${term}`,
        evidence,
        confidence: 0.5,
        occurrences: evidenceCount,
        contradictions: [],
        lastObservedAt: experience.occurredAt,
        personalityEligible: false,
        personalityDimension: undefined,
      };

      return projectBayesianPattern(
        raw,
        evidence.map(() => ({ support: 1, weight: 1 })),
      );
    }).sort((a, b) => a.id.localeCompare(b.id) || a.lastObservedAt.localeCompare(b.lastObservedAt) || a.pattern.localeCompare(b.pattern));
  }
}

export class DeterministicPatternPort implements PatternPort {
  constructor(private readonly strategy: PatternDetectionStrategy = new RecurrencePatternStrategy()) {}

  async detect(experience: Experience, memories: MemoryProposal[]): Promise<PatternObservation[]> {
    return this.strategy.detect(experience, memories);
  }
}

export function createPatternPort(strategy?: PatternDetectionStrategy): PatternPort {
  return new DeterministicPatternPort(strategy);
}
