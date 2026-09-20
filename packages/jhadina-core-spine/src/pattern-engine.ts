import { projectBayesianPattern } from './bayesian-pattern.js';
import type { MemoryProposal, PatternObservation, Experience, EvidenceRef } from './types.js';
import type { PatternPort } from './spine.js';

export interface PatternDetectionStrategy {
  detect(experience: Experience, memories: MemoryProposal[]): PatternObservation[];
}

function tokenize(value: string): string[] {
  return [...new Set(value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [])];
}

function containsTerm(value: string, term: string): boolean {
  return tokenize(value).includes(term);
}

function validEvidence(ref: EvidenceRef): boolean {
  return Boolean(ref.id.trim() && ref.source.trim() && ref.summary.trim());
}

function uniqueEvidence(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.id)) return false;
    seen.add(ref.id);
    return true;
  });
}

function experienceSignal(experience: Experience): string {
  return [experience.domain ?? '', experience.outcome ?? '', experience.content].join(' ');
}

/**
 * Attribute the current observation to evidence that actually supports the
 * candidate term. If the Experience's attached refs are broader than the term,
 * the Experience itself is the canonical direct observation.
 */
function experienceEvidenceForTerm(experience: Experience, term: string): EvidenceRef[] {
  const matchingRefs = experience.evidence
    .filter(validEvidence)
    .filter((ref) => containsTerm(ref.summary, term))
    .map((ref) => ({ ...ref }));

  if (matchingRefs.length > 0) return uniqueEvidence(matchingRefs);

  return [{
    id: experience.id,
    source: experience.source,
    observedAt: experience.occurredAt,
    summary: experienceSignal(experience).trim(),
    immutable: true,
  }];
}

/**
 * Historical recurrence support is pattern-specific at both levels:
 * the approved memory must mention the term and each attributed EvidenceRef
 * must itself support that term. Broad evidence attached to a SAVE memory is
 * not allowed to inflate an unrelated pattern.
 */
function approvedMemoryEvidenceForTerm(memories: MemoryProposal[], term: string): EvidenceRef[] {
  return uniqueEvidence(
    memories
      .filter((memory) => memory.disposition === 'SAVE' && containsTerm(memory.content, term))
      .flatMap((memory) => memory.evidence)
      .filter(validEvidence)
      .filter((ref) => containsTerm(ref.summary, term))
      .map((ref) => ({ ...ref })),
  );
}

/**
 * Conservative first Pattern strategy: identify terms that recur between the
 * current experience and pattern-specific approved/save memory evidence. It
 * emits hypotheses only; it never marks them personality-eligible.
 */
export class RecurrencePatternStrategy implements PatternDetectionStrategy {
  detect(experience: Experience, memories: MemoryProposal[]): PatternObservation[] {
    const experienceTerms = tokenize(experienceSignal(experience));
    const memoryTerms = new Set(
      memories
        .filter((memory) => memory.disposition === 'SAVE')
        .flatMap((memory) => tokenize(memory.content)),
    );
    const recurringTerms = experienceTerms.filter((term) => memoryTerms.has(term));
    if (recurringTerms.length === 0) return [];

    const observations: PatternObservation[] = [];

    for (const term of recurringTerms) {
      const savedEvidence = approvedMemoryEvidenceForTerm(memories, term);

      // A recurring lexical term is not a supported recurrence unless at least
      // one historical EvidenceRef is specifically attributable to that term.
      if (savedEvidence.length === 0) continue;

      const currentEvidence = experienceEvidenceForTerm(experience, term);
      const evidence = uniqueEvidence([...currentEvidence, ...savedEvidence]);
      const raw: PatternObservation = {
        id: `recurrence:${term}`,
        pattern: `recurring term: ${term}`,
        evidence,
        confidence: 0.5,
        occurrences: evidence.length,
        contradictions: [],
        lastObservedAt: experience.occurredAt,
        personalityEligible: false,
        personalityDimension: undefined,
      };

      observations.push(
        projectBayesianPattern(
          raw,
          evidence.map(() => ({ support: 1, weight: 1 })),
        ),
      );
    }

    return observations.sort(
      (a, b) =>
        a.id.localeCompare(b.id) ||
        a.lastObservedAt.localeCompare(b.lastObservedAt) ||
        a.pattern.localeCompare(b.pattern),
    );
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
