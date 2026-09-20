import { projectBayesianPattern } from './bayesian-pattern.js';
import type { EvidenceRef, Experience, MemoryProposal, PatternObservation } from './types.js';
import type { PatternDetectionStrategy } from './pattern-engine.js';

type SemanticSignal = 'support' | 'contradict' | 'none';

const DIRECT_SUPPORT = [
  /\b(be|stay|keep it|keep this) direct\b/i,
  /\bdirect answers?\b/i,
  /\bstraight to (the )?point\b/i,
  /\bno sugarcoat(?:ing)?\b/i,
  /\bdon't sugarcoat\b/i,
];

const DIRECT_CONTRADICTION = [
  /\bnot (so )?direct\b/i,
  /\bless direct\b/i,
  /\bsoften (it|that|the tone)\b/i,
];

function signal(value: string): SemanticSignal {
  const support = DIRECT_SUPPORT.some((pattern) => pattern.test(value));
  const contradict = DIRECT_CONTRADICTION.some((pattern) => pattern.test(value));
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
 * Governed semantic detector for an explicit communication preference.
 *
 * It recognizes only narrow, auditable directness statements. It does not infer
 * directness from tone, sentiment, demographics, model judgment, or generic
 * recurrence confidence. Eligibility remains a separate governance decision.
 */
export class CommunicationDirectnessPatternStrategy implements PatternDetectionStrategy {
  detect(experience: Experience, memories: MemoryProposal[]): PatternObservation[] {
    const observations: Array<{ support: 0 | 1; evidence: EvidenceRef[] }> = [];
    const currentSignal = signal(experience.content);
    if (currentSignal === 'none') return [];
    observations.push({
      support: currentSignal === 'support' ? 1 : 0,
      evidence: experienceEvidence(experience),
    });

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

    // Only durable/approved evidence may flow into Personality. The live
    // Experience can shape the current Bayesian observation, but its mutable
    // request id must never become durable trait evidence or inflate state on
    // repeated requests.
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
      id: 'personality-signal:communication:directness',
      pattern: 'prefers direct communication',
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
