import { decideBehavior, type BehavioralDecision, type BehavioralKernelContext } from './behavioral-kernel.js';
import { planExpression, type ExpressionContext, type ExpressionPlan } from './expression-kernel.js';
import {
  createPersonalityEligibilityClassifier,
  type PersonalityEligibilityRule,
} from './personality-eligibility.js';
import { projectPersonality, type PersonalityCorePolicy } from './personality-core.js';
import type { MemoryProposal, PatternObservation, PersonalityState } from './types.js';

export interface PersonalityBehaviorRuntimeInput {
  personality: PersonalityState;
  patterns: PatternObservation[];
  memories: MemoryProposal[];
  eligibilityRules?: readonly PersonalityEligibilityRule[];
  behaviorContext?: BehavioralKernelContext;
  expressionContext?: ExpressionContext;
  now?: string;
  personalityPolicy?: PersonalityCorePolicy;
  idFactory?: () => string;
}

export interface PersonalityBehaviorRuntimeResult {
  patterns: PatternObservation[];
  personality: PersonalityState;
  behavior: BehavioralDecision;
  expression: ExpressionPlan;
}

/**
 * Pure governed vertical slice:
 * Pattern hypotheses
 * -> explicit Personality eligibility
 * -> PersonalityState projection
 * -> Real Nigga posture / Behavioral Kernel
 * -> ExpressionPlan.
 *
 * The eligibility classifier is deny-by-default and recomputes detector flags;
 * Bayesian confidence alone never admits a pattern into Personality.
 */
export function runPersonalityBehaviorRuntime(
  input: PersonalityBehaviorRuntimeInput,
): PersonalityBehaviorRuntimeResult {
  const classifier = createPersonalityEligibilityClassifier(input.eligibilityRules);
  const patterns = classifier.project(input.patterns);

  const personality = projectPersonality(
    input.personality,
    patterns,
    input.memories,
    input.now,
    input.personalityPolicy,
    input.idFactory,
  );
  const behavior = decideBehavior(personality, input.behaviorContext);
  const expression = planExpression(behavior, input.expressionContext);
  return { patterns, personality, behavior, expression };
}
