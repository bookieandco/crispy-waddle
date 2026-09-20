import { projectBayesianPattern } from './bayesian-pattern.js';
import type { MemoryProposal, PatternObservation, Experience, EvidenceRef } from './types.js';
import type { PatternPort } from './spine.js';

export interface PatternDetectionStrategy {
  detect(experience: Experience, memories: MemoryProposal[]): PatternObservation[];
}

type TermPolarity = 'support' | 'contradict' | 'ambiguous' | 'none';

interface TermObservation {
  support: 0 | 1;
  evidence: EvidenceRef[];
}

const DIRECT_NEGATORS = new Set([
  'not',
  'never',
  'no',
  'avoid',
  'avoids',
  'avoided',
  'avoiding',
  'without',
  'less',
]);

const NEGATION_MODIFIERS = new Set([
  'very',
  'really',
  'too',
  'so',
  'especially',
]);

function lexicalTokens(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [];
}

function tokenize(value: string): string[] {
  return [...new Set(lexicalTokens(value))];
}

function containsTerm(value: string, term: string): boolean {
  return tokenize(value).includes(term);
}

/**
 * Conservative lexical polarity only. This is not a semantic/commonsense
 * classifier: exact term mentions count as support unless the same mention is
 * explicitly negated by a small deterministic vocabulary. Ambiguous text is
 * withheld rather than guessed.
 */
function classifyTermPolarity(value: string, term: string): TermPolarity {
  const tokens = lexicalTokens(value);
  let support = false;
  let contradict = false;

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index] !== term) continue;

    const previous = tokens[index - 1];
    const twoBack = tokens[index - 2];
    const explicitlyNegated =
      (previous !== undefined && DIRECT_NEGATORS.has(previous)) ||
      (
        previous !== undefined &&
        twoBack !== undefined &&
        NEGATION_MODIFIERS.has(previous) &&
        DIRECT_NEGATORS.has(twoBack)
      );

    if (explicitlyNegated) contradict = true;
    else support = true;
  }

  if (support && contradict) return 'ambiguous';
  if (support) return 'support';
  if (contradict) return 'contradict';
  return 'none';
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

function directExperienceEvidence(experience: Experience): EvidenceRef {
  return {
    id: experience.id,
    source: experience.source,
    observedAt: experience.occurredAt,
    summary: experienceSignal(experience).trim(),
    immutable: true,
  };
}

function currentObservationForTerm(experience: Experience, term: string): TermObservation | undefined {
  const polarity = classifyTermPolarity(experienceSignal(experience), term);
  if (polarity === 'none' || polarity === 'ambiguous') return undefined;

  const matchingRefs = uniqueEvidence(
    experience.evidence
      .filter(validEvidence)
      .filter((ref) => classifyTermPolarity(ref.summary, term) === polarity)
      .map((ref) => ({ ...ref })),
  );

  return {
    support: polarity === 'support' ? 1 : 0,
    evidence: matchingRefs.length > 0 ? matchingRefs : [directExperienceEvidence(experience)],
  };
}

/**
 * Build at most one Bayesian observation per approved memory. Multiple evidence
 * refs can substantiate that observation, but they do not become independent
 * pseudo-observations and therefore cannot inflate confidence.
 */
function memoryObservationForTerm(memory: MemoryProposal, term: string): TermObservation | undefined {
  if (memory.disposition !== 'SAVE') return undefined;

  const polarity = classifyTermPolarity(memory.content, term);
  if (polarity === 'none' || polarity === 'ambiguous') return undefined;

  const evidence = uniqueEvidence(
    memory.evidence
      .filter(validEvidence)
      .filter((ref) => classifyTermPolarity(ref.summary, term) === polarity)
      .map((ref) => ({ ...ref })),
  );
  if (evidence.length === 0) return undefined;

  return {
    support: polarity === 'support' ? 1 : 0,
    evidence,
  };
}

function independentObservations(observations: TermObservation[]): TermObservation[] {
  const usedEvidenceIds = new Set<string>();
  const independent: TermObservation[] = [];

  for (const observation of observations) {
    const novelEvidence = observation.evidence.filter((ref) => !usedEvidenceIds.has(ref.id));
    if (novelEvidence.length === 0) continue;
    for (const ref of novelEvidence) usedEvidenceIds.add(ref.id);
    independent.push({
      support: observation.support,
      evidence: novelEvidence.map((ref) => ({ ...ref })),
    });
  }

  return independent;
}

/**
 * Conservative first Pattern strategy: identify exact lexical signals that
 * recur across the current Experience and pattern-specific approved memories.
 *
 * Bayesian support is observation-based, not EvidenceRef-count-based:
 * current Experience = at most one observation; each SAVE memory = at most one
 * independent observation. Explicitly negated exact-term observations are
 * carried as contradictions. This strategy emits hypotheses only and never
 * grants personality eligibility.
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
      const currentObservation = currentObservationForTerm(experience, term);
      if (!currentObservation) continue;

      const historicalObservations = memories
        .map((memory) => memoryObservationForTerm(memory, term))
        .filter((observation): observation is TermObservation => observation !== undefined);

      const termObservations = independentObservations([
        currentObservation,
        ...historicalObservations,
      ]);

      // Recurrence requires at least two independent, pattern-specific
      // observations. Proposal text alone never establishes an observation.
      if (termObservations.length < 2) continue;

      const evidence = uniqueEvidence(
        termObservations
          .filter((observation) => observation.support === 1)
          .flatMap((observation) => observation.evidence),
      );
      const contradictions = uniqueEvidence(
        termObservations
          .filter((observation) => observation.support === 0)
          .flatMap((observation) => observation.evidence),
      );

      const raw: PatternObservation = {
        id: `recurrence:${term}`,
        pattern: `recurring term: ${term}`,
        evidence,
        confidence: 0.5,
        occurrences: termObservations.length,
        contradictions,
        lastObservedAt: experience.occurredAt,
        personalityEligible: false,
        personalityDimension: undefined,
      };

      observations.push(
        projectBayesianPattern(
          raw,
          termObservations.map((observation) => ({
            support: observation.support,
            weight: 1,
          })),
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
