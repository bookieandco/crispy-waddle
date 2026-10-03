import type { PersonalityState } from './types.js';
import { decideBehavior, type BehavioralKernelContext } from './behavioral-kernel.js';
import { planExpression, type ExpressionContext } from './expression-kernel.js';
import { deriveRealNiggaBehavior } from './real-nigga-core.js';
import { selectQuip, type QuipCandidate, type QuipPlan } from './quip-engine.js';
import {
  advanceBanterBit,
  type BanterBitInput,
  type BanterBitTransition,
} from './banter-bit-engine.js';

export interface PersonalityBehaviorExpressionContext extends BehavioralKernelContext, ExpressionContext {
  /** Up to three short candidates generated for this turn; selection is governed here. */
  quipCandidates?: readonly QuipCandidate[];
  quipMinimumScore?: number;
  /** Optional state transition request for an active/new ephemeral bit. */
  banterInput?: Omit<BanterBitInput, 'humor'>;
}

export interface PersonalityBehaviorExpressionPlan {
  behavior: ReturnType<typeof deriveRealNiggaBehavior>;
  decision: ReturnType<typeof decideBehavior>;
  quip?: QuipPlan;
  banterTransition?: BanterBitTransition;
  expression: ReturnType<typeof planExpression>;
}

/**
 * Governed vertical slice:
 * durable personality -> posture -> behavior -> conversation craft -> expression.
 *
 * Candidate text can be proposed upstream, but Core Spine decides whether a quip
 * survives ranking and whether a banter bit may advance. Neither path grants
 * authority or changes factual conclusions.
 */
export function buildPersonalityBehaviorExpressionPlan(
  personality: PersonalityState,
  context: PersonalityBehaviorExpressionContext = {},
): PersonalityBehaviorExpressionPlan {
  const decision = decideBehavior(personality, context);
  const selectedQuip = context.quip ?? (
    context.quipCandidates && context.quipCandidates.length > 0
      ? selectQuip(decision, {
          candidates: context.quipCandidates,
          session: context.session,
          minimumScore: context.quipMinimumScore,
        })
      : undefined
  );

  const banterTransition = context.banterInput && context.session
    ? advanceBanterBit(context.session, context.banter, {
        ...context.banterInput,
        humor: decision.posture.humor,
      })
    : undefined;
  const banter = banterTransition?.runtime ?? context.banter;

  return {
    behavior: decision.posture,
    decision,
    ...(selectedQuip ? { quip: selectedQuip } : {}),
    ...(banterTransition ? { banterTransition } : {}),
    expression: planExpression(decision, {
      ...context,
      ...(selectedQuip ? { quip: selectedQuip } : {}),
      ...(banter ? { banter } : {}),
      ...(banterTransition ? { session: banterTransition.session } : {}),
    }),
  };
}
