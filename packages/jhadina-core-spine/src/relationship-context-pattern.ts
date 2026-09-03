import { projectBayesianPattern } from './bayesian-pattern.js';
import type { PatternObservation, Experience, EvidenceRef, MemoryProposal } from './types.js';
import type { PatternDetectionStrategy } from './pattern-engine.js';

function experienceEvidence(experience: Experience): EvidenceRef[] {
  if (experience.evidence.length > 0) return experience.evidence.map((ref) => ({ ...ref }));
  return [{
    id: experience.id,
    source: experience.source,
    observedAt: experience.occurredAt,
    summary: experience.content,
    immutable: true,
  }];
}

/**
 * Detects recurring interaction context without inferring personality behavior.
 * Shared source is the only relationship signal available from the current
 * MemoryProposal/EvidenceRef contract, so this remains a context hypothesis.
 */
export class RelationshipContextPatternStrategy implements PatternDetectionStrategy {
  detect(experience: Experience, memories: MemoryProposal[]): PatternObservation[] {
    const saved = memories.filter((memory) => memory.disposition === 'SAVE');
    const matchingMemories = saved.filter((memory) => memory.evidence.some((ref) => ref.source === experience.source));
    if (matchingMemories.length === 0) return [];

    const evidence = [
      ...experienceEvidence(experience),
      ...matchingMemories.flatMap((memory) => memory.evidence),
    ].filter((ref, index, refs) => refs.findIndex((candidate) => candidate.id === ref.id) === index);

    const contextKey = [
      `actor=${experience.actor}`,
      `source=${experience.source}`,
      `domain=${experience.domain ?? 'unspecified'}`,
    ].join('|');

    const raw: PatternObservation = {
      id: `relationship-context:${contextKey}`,
      pattern: `recurring relationship context: ${contextKey}`,
      evidence: evidence.map((ref) => ({ ...ref })),
      confidence: 0.5,
      occurrences: evidence.length,
      contradictions: [],
      lastObservedAt: experience.occurredAt,
      personalityEligible: false,
      personalityDimension: 'relationship',
    };

    return [projectBayesianPattern(raw, evidence.map(() => ({ support: 1, weight: 1 })) )];
  }
}
