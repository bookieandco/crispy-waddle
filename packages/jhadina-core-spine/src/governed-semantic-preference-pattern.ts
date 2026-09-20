import { projectBayesianPattern } from './bayesian-pattern.js';
import type {
  EvidenceRef,
  Experience,
  MemoryProposal,
  PatternObservation,
  PersonalityDimension,
} from './types.js';
import type { PatternDetectionStrategy } from './pattern-engine.js';

type SemanticSignal = 'support' | 'contradict' | 'none';

export interface GovernedSemanticPreferenceDefinition {
  id: string;
  statement: string;
  dimension: PersonalityDimension;
  support: readonly RegExp[];
  contradict: readonly RegExp[];
}

export const GOVERNED_SEMANTIC_PREFERENCES: readonly GovernedSemanticPreferenceDefinition[] = [
  {
    id: 'personality-signal:communication:warmth',
    statement: 'prefers warm communication',
    dimension: 'communication',
    support: [/\b(be|sound|stay) (warmer|warm|friendlier|friendly)\b/i, /\bmore (warm|friendly|empathetic)\b/i],
    contradict: [/\b(be|sound|stay) (colder|cold|detached)\b/i, /\bless (warm|friendly)\b/i],
  },
  {
    id: 'personality-signal:communication:formality',
    statement: 'prefers formal communication',
    dimension: 'communication',
    support: [/\b(be|stay|keep it) (formal|professional)\b/i, /\bmore (formal|professional)\b/i],
    contradict: [/\b(be|stay|keep it) (casual|informal|conversational)\b/i, /\bless formal\b/i],
  },
  {
    id: 'personality-signal:humor:enabled',
    statement: 'prefers humorous communication',
    dimension: 'humor',
    support: [/\b(be|make it) (funny|funnier|humorous)\b/i, /\bmore (humor|jokes?)\b/i],
    contradict: [/\b(no|without) (humor|jokes?)\b/i, /\bkeep it serious\b/i, /\bless (humor|joking)\b/i],
  },
  {
    id: 'personality-signal:communication:profanity',
    statement: 'allows conversational profanity',
    dimension: 'communication',
    support: [/\b(profanity|swearing|cussing) is (fine|okay|ok)\b/i, /\byou can (swear|cuss)\b/i],
    contradict: [/\b(no|without) (profanity|swearing|cussing)\b/i, /\bdon't (swear|cuss)\b/i],
  },
  {
    id: 'personality-signal:communication:pushback',
    statement: 'prefers active pushback',
    dimension: 'communication',
    support: [/\b(push back|challenge me|tell me when i(?:'|’)m wrong)\b/i, /\bchallenge my assumptions\b/i],
    contradict: [/\bdon't push back\b/i, /\bno pushback\b/i, /\bdon't challenge me\b/i],
  },
  {
    id: 'personality-signal:communication:technical-depth',
    statement: 'prefers technical depth',
    dimension: 'communication',
    support: [/\b(be|go) (technical|deeper|in-depth)\b/i, /\btechnical (detail|details|depth)\b/i, /\bgo deeper\b/i],
    contradict: [/\b(keep it|make it) simple\b/i, /\bless technical\b/i, /\bno technical (detail|details|jargon)\b/i],
  },
  {
    id: 'personality-signal:preference:continuous-workflow',
    statement: 'prefers continuous workflow',
    dimension: 'preference',
    support: [/\bwork uninterrupted\b/i, /\bcontinue uninterrupted\b/i, /\bkeep going without (stopping|checkpoints?)\b/i],
    contradict: [/\bstop after each (step|part|portion)\b/i, /\bcheckpoint after each (step|part|portion)\b/i, /\bwait for me after each (step|part|portion)\b/i],
  },
  {
    id: 'personality-signal:communication:step-by-step',
    statement: 'prefers step-by-step explanations',
    dimension: 'communication',
    support: [/\bstep[- ]by[- ]step\b/i, /\bwalk me through (it|this)\b/i],
    contradict: [/\bno step[- ]by[- ]step\b/i, /\bskip the walkthrough\b/i],
  },
  {
    id: 'personality-signal:communication:evidence-first',
    statement: 'prefers evidence-first explanations',
    dimension: 'communication',
    support: [/\b(evidence|sources?) first\b/i, /\blead with (the )?(evidence|sources?)\b/i],
    contradict: [/\bdon't lead with (the )?(evidence|sources?)\b/i, /\bevidence last\b/i],
  },
  {
    id: 'personality-signal:preference:multiple-options',
    statement: 'prefers multiple options',
    dimension: 'preference',
    support: [/\bgive me (a few|several|multiple) options\b/i, /\bshow me options\b/i],
    contradict: [/\bgive me one recommendation\b/i, /\bjust pick one\b/i, /\bno list of options\b/i],
  },
  {
    id: 'personality-signal:taste:experimentation',
    statement: 'prefers experimental creativity',
    dimension: 'taste',
    support: [/\b(be|make it) (experimental|unconventional|bold)\b/i, /\btry something new\b/i, /\bmore experimental\b/i],
    contradict: [/\bkeep it conventional\b/i, /\bless experimental\b/i, /\bdon't experiment\b/i],
  },
  {
    id: 'personality-signal:relationship:familiar-tone',
    statement: 'prefers familiar tone',
    dimension: 'relationship',
    support: [/\b(be|sound) more familiar\b/i, /\btalk to me like you know me\b/i, /\buse a familiar tone\b/i],
    contradict: [/\bkeep it impersonal\b/i, /\bless familiar\b/i, /\bdon't be familiar\b/i],
  },
];

function semanticSignal(value: string, definition: GovernedSemanticPreferenceDefinition): SemanticSignal {
  const support = definition.support.some((pattern) => pattern.test(value));
  const contradict = definition.contradict.some((pattern) => pattern.test(value));
  if (support === contradict) return 'none';
  return support ? 'support' : 'contradict';
}

function unique(refs: readonly EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  const output: EvidenceRef[] = [];
  for (const ref of refs) {
    if (seen.has(ref.id)) continue;
    seen.add(ref.id);
    output.push({ ...ref });
  }
  return output;
}

function evidenceFor(
  value: string,
  refs: readonly EvidenceRef[],
  definition: GovernedSemanticPreferenceDefinition,
): EvidenceRef[] {
  return unique(refs.filter((ref) => semanticSignal(ref.summary, definition) !== 'none'));
}

/**
 * Explicit, narrow semantic detector family for governed presentation
 * preferences. It never grants eligibility itself. Only durable evidence is
 * emitted; the current request participates in Bayesian interpretation but
 * cannot become durable Personality evidence.
 */
export class GovernedSemanticPreferenceStrategy implements PatternDetectionStrategy {
  constructor(
    private readonly definitions: readonly GovernedSemanticPreferenceDefinition[] =
      GOVERNED_SEMANTIC_PREFERENCES,
  ) {}

  detect(experience: Experience, memories: MemoryProposal[]): PatternObservation[] {
    const patterns: PatternObservation[] = [];

    for (const definition of this.definitions) {
      const current = semanticSignal(experience.content, definition);
      if (current === 'none') continue;

      const observations: Array<{ support: 0 | 1; evidence: EvidenceRef[] }> = [{
        support: current === 'support' ? 1 : 0,
        evidence: evidenceFor(experience.content, experience.evidence, definition),
      }];

      for (const memory of memories) {
        if (memory.disposition !== 'SAVE') continue;
        const memorySignal = semanticSignal(memory.content, definition);
        if (memorySignal === 'none') continue;
        const refs = evidenceFor(memory.content, memory.evidence, definition);
        if (refs.length === 0) continue;
        observations.push({ support: memorySignal === 'support' ? 1 : 0, evidence: refs });
      }

      const used = new Set<string>();
      const independent = observations.flatMap((observation) => {
        const refs = observation.evidence.filter((ref) => !used.has(ref.id));
        if (refs.length === 0) return [];
        refs.forEach((ref) => used.add(ref.id));
        return [{ ...observation, evidence: refs }];
      });
      if (independent.length < 2) continue;

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
        id: definition.id,
        pattern: definition.statement,
        evidence,
        contradictions,
        occurrences: independent.length,
        confidence: 0.5,
        lastObservedAt: experience.occurredAt,
        personalityEligible: false,
        personalityDimension: definition.dimension,
      };

      patterns.push(projectBayesianPattern(
        raw,
        independent.map((item) => ({ support: item.support, weight: 1 })),
      ));
    }

    return patterns.sort((left, right) => left.id.localeCompare(right.id));
  }
}
