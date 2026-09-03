import type { PersonalityState } from './types.js';
import { decideBehavior, type BehavioralKernelContext, type BehavioralDecision } from './behavioral-kernel.js';
import { planExpression, type ExpressionContext, type ExpressionPlan } from './expression-kernel.js';

export interface PersonalityBehaviorInput {
  personality: PersonalityState;
  behavior?: BehavioralKernelContext;
  expression?: ExpressionContext;
}

export interface PersonalityBehaviorResult {
  behavior: BehavioralDecision;
  expression: ExpressionPlan;
}

/**
 * Pure vertical slice from durable personality state to governed expression.
 * No language generation, persistence, policy, or action authority lives here.
 */
export function buildPersonalityBehavior(input: PersonalityBehaviorInput): PersonalityBehaviorResult {
  const behavior = decideBehavior(input.personality, input.behavior);
  const expression = planExpression(behavior, input.expression);
  return { behavior, expression };
}
