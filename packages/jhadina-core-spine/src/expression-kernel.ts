import type { BehavioralDecision } from './behavioral-kernel.js';
import {
  isVerifiedCallback,
  type CallbackProvenance,
  type VerifiedCallback,
} from './callback-provenance.js';

export interface ExpressionContext {
  callback?: VerifiedCallback;
  culturalReference?: string;
}

export interface ExpressionPlan {
  mode: 'direct' | 'explanatory' | 'pushback' | 'clarifying' | 'serious';
  allowProfanity: boolean;
  allowQuip: boolean;
  callback?: string;
  callbackProvenance?: CallbackProvenance[];
  culturalReference?: string;
}

/**
 * Expression selection is separate from language generation. The model may
 * realize this plan, but it cannot silently change the behavioral posture.
 *
 * Callback strings are accepted only through the evidence-backed selector.
 * Serious mode suppresses callbacks even when they are otherwise verified.
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
  const callback = !serious && isVerifiedCallback(context.callback)
    ? context.callback
    : undefined;

  return {
    mode,
    allowProfanity: !serious && decision.posture.profanityAllowed,
    allowQuip: !serious && decision.posture.quipsAllowed,
    callback: callback?.value,
    callbackProvenance: callback?.provenance.map((item) => ({
      origin: item.origin,
      evidence: { ...item.evidence },
    })),
    culturalReference: context.culturalReference,
  };
}
