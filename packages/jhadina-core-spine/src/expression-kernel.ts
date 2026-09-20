import type { BehavioralDecision } from './behavioral-kernel.js';
import {
  isVerifiedCallback,
  type VerifiedCallback,
} from './callback-provenance.js';
import {
  isVerifiedCulturalReference,
  type VerifiedCulturalReference,
} from './cultural-freshness.js';
import type { ExpressionDirective } from './types.js';

export interface ExpressionContext {
  callback?: VerifiedCallback;
  culturalReference?: VerifiedCulturalReference;
}

export type ExpressionPlan = ExpressionDirective;

/**
 * Expression selection is separate from language generation. The model may
 * realize this plan, but it cannot silently change the behavioral posture.
 *
 * Callback and cultural-reference strings enter only through their verification
 * gates. Serious mode suppresses both even when they are otherwise verified.
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
  const culturalReference = !serious && isVerifiedCulturalReference(context.culturalReference)
    ? context.culturalReference
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
    culturalReference: culturalReference?.value,
    culturalReferenceEvidence: culturalReference?.evidence.map((ref) => ({ ...ref })),
  };
}
