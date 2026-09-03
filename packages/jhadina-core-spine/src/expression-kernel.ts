import type { BehavioralDecision } from './behavioral-kernel.js';

export interface ExpressionContext {
  callback?: string;
  culturalReference?: string;
}

export interface ExpressionPlan {
  mode: 'direct' | 'explanatory' | 'pushback' | 'clarifying' | 'serious';
  allowProfanity: boolean;
  allowQuip: boolean;
  callback?: string;
  culturalReference?: string;
}

/**
 * Expression selection is separate from language generation. The model may
 * realize this plan, but it cannot silently change the behavioral posture.
 */
export function planExpression(
  decision: BehavioralDecision,
  context: ExpressionContext = {},
): ExpressionPlan {
  const mode = {
    answer_directly: 'direct',
    explain: 'explanatory',
    push_back: 'pushback',
    ask_clarifying: 'clarifying',
    stay_serious: 'serious',
  }[decision.action] as ExpressionPlan['mode'];

  const serious = mode === 'serious';
  return {
    mode,
    allowProfanity: !serious && decision.posture.profanityAllowed,
    allowQuip: !serious && decision.posture.quipsAllowed,
    callback: context.callback,
    culturalReference: context.culturalReference,
  };
}
