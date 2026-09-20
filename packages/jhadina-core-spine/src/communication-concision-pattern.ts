import { projectBayesianPattern } from './bayesian-pattern.js';
import type { EvidenceRef, Experience, MemoryProposal, PatternObservation } from './types.js';
import type { PatternDetectionStrategy } from './pattern-engine.js';

type SemanticSignal = 'support' | 'contradict' | 'none';

const CONCISE_SUPPORT = [
  /\b(be|stay|keep it|keep this) concise\b/i,
  /\bkeep (it|this|answers?) (short|brief)\b/i,
  /\b(short|brief|concise) answers?\b/i,
  /\bno long (answer|answers|explanation|explanations)\b/i,
  /\bget to the point quickly\b/i,
];

const CONCISE_CONTRADICTION = [
  /\b(more|extra) detail(?:ed)?\b/i,
  /\bexplain (it|this|that) more\b/i,
  /\b(be|stay) thorough\b/i,
  /\b(longer|detailed|thorough) answers?\b/i,
  /\bdon't (be )?(so )?(brief|concise)\b/i,
  /\bless (brief|concise)\b/i,
];

function signal(value: string): SemanticSignal {
  const support = CONCISE_SUPPORT.some((pattern) => pattern.test(value));
  const contradict = CONCISE_CONTRADICTION.some((pattern) => pattern.test(value));
  if (support === contradict) return 'none';
  return support ? 'support' : 'contradict';
}

function unique(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.id)) return false;
    seen.add(ref.id);
    return true;
  }).map((ref) => ({ ...ref }));
}

function experienceEvidence(experience: Experience): EvidenceRef[] {
  const matching = experience.evidence.filter((ref) => signal(ref.summary) !== 'none');
  if (matching.length > 0) return unique(matching);
  return [{
    id: experience.id,
    source: experience.source,
    observedAt: experience.occurredAt,
    summary: experience.content,
    immutable: false,
  }];
}

function memoryEvidence(memory: MemoryProposal): EvidenceRef[] {
  return unique(memory.evidence.filter((ref) => signal(ref.summary) !== 'none'));
}

/**
 * Narrow semantic detector for an explicit answer-length preference.
 *
 * Concision is intentionally separate from directness: a user can ask for a
 * detailed answer that is still direct, or a brief answer that is warm.
 */
export class CommunicationConcisionPatternStrategy implements PatternDetectionStrategy {
  detect(experience: Experience, memories: MemoryProposal[]): PatternObservation[] {
    const currentSignal = signal(experience.content);
    if (currentSignal === 'none') return [];

    const observations: Array<{ support: 0 | 1; evidence: EvidenceRef[] }> = [{
      support: currentSignal === 'support' ? 1 : 0,
      evidence: experienceEvidence(experience),
    }];

    for (const memory of memories) {
      if (memory.disposition !== 'SAVE') continue;
      const memorySignal = signal(memory.content);
      if (memorySignal === 'none') continue;
      const evidence = memoryEvidence(memory);
      if (evidence.length === 0) continue;
      observations.push({
        support: memorySignal === 'support' ? 1 : 0,
        evidence,
      });
    }

    const used = new Set<string>();
    const independent = observations.flatMap((observation) => {
      const evidence = observation.evidence.filter((ref) => !used.has(ref.id));
      if (evidence.length === 0) return [];
      evidence.forEach((ref) => used.add(ref.id));
      return [{ ...observation, evidence }];
    });
    if (independent.length < 2) return [];

    const evidence = unique(
      independent
        .filter((item) => item.support === 1)
        .flatMap((item) => item.evidence)
        .filter((ref) => ref.immutable === true),
    );
    const contradictions = unique(
      independent
        .filter((item) => item.support === 0)
        .flatMap((item) => item.evidence)
        .filter((ref) => ref.immutable === true),
    );

    const raw: PatternObservation = {
      id: 'personality-signal:communication:concision',
      pattern: 'prefers concise communication',
      evidence,
      contradictions,
      occurrences: independent.length,
      confidence: 0.5,
      lastObservedAt: experience.occurredAt,
      personalityEligible: false,
      personalityDimension: 'communication',
    };

    return [projectBayesianPattern(raw, independent.map((item) => ({ support: item.support, weight: 1 })))];
  }
}
