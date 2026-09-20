import type {
  EvidenceRef,
  PatternObservation,
  PersonalityDimension,
} from './types.js';

export type PersonalityEligibilityReason =
  | 'eligible'
  | 'no_matching_rule'
  | 'ambiguous_rule'
  | 'dimension_mismatch'
  | 'insufficient_observations'
  | 'insufficient_evidence'
  | 'contradicted'
  | 'invalid_evidence'
  | 'mutable_evidence';

export interface PersonalityEligibilityRule {
  /** Stable governance/audit identifier. */
  ruleId: string;
  /** Only explicitly designated semantic detector families may be admitted. */
  patternIdPrefix: string;
  /** Dimension assigned by governance, never by Bayesian confidence. */
  dimension: PersonalityDimension;
  minimumObservations: number;
  minimumEvidence: number;
  maximumContradictions: number;
  requireImmutableEvidence: boolean;
}

export interface PersonalityEligibilityDecision {
  patternId: string;
  eligible: boolean;
  dimension?: PersonalityDimension;
  ruleId?: string;
  reason: PersonalityEligibilityReason;
}

/**
 * Empty by design. The generic lexical recurrence and relationship-context
 * detectors are hypotheses, not durable personality classifiers.
 *
 * Semantic detector families must be explicitly added here (or injected by a
 * governed composition root) before their observations can reach Personality.
 */
export const DEFAULT_PERSONALITY_ELIGIBILITY_RULES: readonly PersonalityEligibilityRule[] = [{
  ruleId: 'communication-directness-v1',
  patternIdPrefix: 'personality-signal:communication:directness',
  dimension: 'communication',
  minimumObservations: 3,
  minimumEvidence: 3,
  maximumContradictions: 3,
  requireImmutableEvidence: false,
}];

function validEvidence(ref: EvidenceRef): boolean {
  return Boolean(
    ref.id.trim() &&
    ref.source.trim() &&
    ref.summary.trim() &&
    Number.isFinite(Date.parse(ref.observedAt)),
  );
}

function uniqueEvidence(refs: readonly EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  const output: EvidenceRef[] = [];

  for (const ref of refs) {
    if (seen.has(ref.id)) continue;
    seen.add(ref.id);
    output.push({ ...ref });
  }

  return output;
}

function validateRule(rule: PersonalityEligibilityRule): void {
  if (!rule.ruleId.trim()) throw new RangeError('eligibility ruleId must not be empty');
  if (!rule.patternIdPrefix.trim()) throw new RangeError('eligibility patternIdPrefix must not be empty');
  if (!Number.isInteger(rule.minimumObservations) || rule.minimumObservations < 2) {
    throw new RangeError('eligibility minimumObservations must be an integer >= 2');
  }
  if (!Number.isInteger(rule.minimumEvidence) || rule.minimumEvidence < 2) {
    throw new RangeError('eligibility minimumEvidence must be an integer >= 2');
  }
  if (!Number.isInteger(rule.maximumContradictions) || rule.maximumContradictions < 0) {
    throw new RangeError('eligibility maximumContradictions must be a non-negative integer');
  }
}

/**
 * Explicit Pattern -> Personality governance boundary.
 *
 * Bayesian confidence is intentionally absent from the admission rules.
 * Confidence can describe a pattern belief; it cannot grant personality
 * eligibility. Detector-provided personalityEligible values are ignored and
 * recomputed here from an explicit allowlisted rule.
 */
export class GovernedPersonalityEligibilityClassifier {
  private readonly rules: readonly PersonalityEligibilityRule[];

  constructor(rules: readonly PersonalityEligibilityRule[] = DEFAULT_PERSONALITY_ELIGIBILITY_RULES) {
    for (const rule of rules) validateRule(rule);
    this.rules = rules.map((rule) => ({ ...rule }));
  }

  classify(pattern: PatternObservation): PersonalityEligibilityDecision {
    const matchingRules = this.rules.filter((rule) => pattern.id.startsWith(rule.patternIdPrefix));

    if (matchingRules.length === 0) {
      return {
        patternId: pattern.id,
        eligible: false,
        reason: 'no_matching_rule',
      };
    }

    if (matchingRules.length > 1) {
      return {
        patternId: pattern.id,
        eligible: false,
        reason: 'ambiguous_rule',
      };
    }

    const rule = matchingRules[0];

    if (pattern.personalityDimension !== rule.dimension) {
      return {
        patternId: pattern.id,
        eligible: false,
        ruleId: rule.ruleId,
        reason: 'dimension_mismatch',
      };
    }

    if (!Number.isInteger(pattern.occurrences) || pattern.occurrences < rule.minimumObservations) {
      return {
        patternId: pattern.id,
        eligible: false,
        ruleId: rule.ruleId,
        reason: 'insufficient_observations',
      };
    }

    const evidence = uniqueEvidence(pattern.evidence);
    const contradictions = uniqueEvidence(pattern.contradictions);

    if (evidence.some((ref) => !validEvidence(ref)) || contradictions.some((ref) => !validEvidence(ref))) {
      return {
        patternId: pattern.id,
        eligible: false,
        ruleId: rule.ruleId,
        reason: 'invalid_evidence',
      };
    }

    if (evidence.length < rule.minimumEvidence) {
      return {
        patternId: pattern.id,
        eligible: false,
        ruleId: rule.ruleId,
        reason: 'insufficient_evidence',
      };
    }

    if (contradictions.length > rule.maximumContradictions) {
      return {
        patternId: pattern.id,
        eligible: false,
        ruleId: rule.ruleId,
        reason: 'contradicted',
      };
    }

    if (
      rule.requireImmutableEvidence &&
      [...evidence, ...contradictions].some((ref) => ref.immutable !== true)
    ) {
      return {
        patternId: pattern.id,
        eligible: false,
        ruleId: rule.ruleId,
        reason: 'mutable_evidence',
      };
    }

    return {
      patternId: pattern.id,
      eligible: true,
      dimension: rule.dimension,
      ruleId: rule.ruleId,
      reason: 'eligible',
    };
  }

  project(patterns: readonly PatternObservation[]): PatternObservation[] {
    return patterns.map((pattern) => {
      const decision = this.classify(pattern);
      return {
        ...pattern,
        evidence: pattern.evidence.map((ref) => ({ ...ref })),
        contradictions: pattern.contradictions.map((ref) => ({ ...ref })),
        personalityEligible: decision.eligible,
        personalityDimension: decision.eligible ? decision.dimension : undefined,
      };
    });
  }
}

export function createPersonalityEligibilityClassifier(
  rules: readonly PersonalityEligibilityRule[] = DEFAULT_PERSONALITY_ELIGIBILITY_RULES,
): GovernedPersonalityEligibilityClassifier {
  return new GovernedPersonalityEligibilityClassifier(rules);
}
