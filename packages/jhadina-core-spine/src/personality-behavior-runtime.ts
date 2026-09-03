import { decideBehavior, type BehavioralDecision, type BehavioralKernelContext } from './behavioral-kernel.js';
import { planExpression, type ExpressionContext, type ExpressionPlan } from './expression-kernel.js';
import { projectPersonality, type PersonalityCorePolicy } from './personality-core.js';
import type { MemoryProposal, PatternObservation, PersonalityState } from './types.js';

export interface PersonalityBehaviorRuntimeInput {
  personality: PersonalityState;
  patterns: PatternObservation[];
  memories: MemoryProposal[];
  behaviorContext?: BehavioralKernelContext;
  expressionContext?: ExpressionContext;
  now?: string;
  personalityPolicy?: PersonalityCorePolicy;
  idFactory?: () => string;
}

export interface PersonalityBehaviorRuntimeResult {
  personality: PersonalityState;
  behavior: BehavioralDecision;
  expression: ExpressionPlan;
}

/**
 * Pure vertical slice for the governed personality-to-expression path.
 * Personality projection happens before behavioral selection; expression is
 * planned from the resulting behavioral decision and never mutates state.
 */
export function runPersonalityBehaviorRuntime(
  input: PersonalityBehaviorRuntimeInput,
): PersonalityBehaviorRuntimeResult {
  const personality = projectPersonality(
    input.personality,
    input.patterns,
    input.memories,
    input.now,
    input.personalityPolicy,
    input.idFactory,
  );
  const behavior = decideBehavior(personality, input.behaviorContext);
  const expression = planExpression(behavior, input.expressionContext);
  return { personality, behavior, expression };
}
