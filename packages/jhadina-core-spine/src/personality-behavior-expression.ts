import type { PersonalityState } from './types.js';
import { decideBehavior, type BehavioralKernelContext } from './behavioral-kernel.js';
import { planExpression, type ExpressionContext } from './expression-kernel.js';
import { deriveRealNiggaBehavior } from './real-nigga-core.js';

export interface PersonalityBehaviorExpressionContext extends BehavioralKernelContext, ExpressionContext {}

export interface PersonalityBehaviorExpressionPlan {
  behavior: ReturnType<typeof deriveRealNiggaBehavior>;
  decision: ReturnType<typeof decideBehavior>;
  expression: ReturnType<typeof planExpression>;
}

/** Pure vertical slice: durable personality -> posture -> behavior -> expression plan. */
export function buildPersonalityBehaviorExpressionPlan(
  personality: PersonalityState,
  context: PersonalityBehaviorExpressionContext = {},
): PersonalityBehaviorExpressionPlan {
  const decision = decideBehavior(personality, context);
  return {
    behavior: decision.posture,
    decision,
    expression: planExpression(decision, context),
  };
}
