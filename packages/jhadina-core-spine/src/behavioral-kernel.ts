import type { PersonalityState } from './types.js';
import { deriveRealNiggaBehavior, type RealNiggaBehavior, type RealNiggaBehaviorContext } from './real-nigga-core.js';

export type BehavioralAction = 'answer_directly' | 'explain' | 'push_back' | 'ask_clarifying' | 'stay_serious';

export interface BehavioralKernelContext extends RealNiggaBehaviorContext {
  ambiguity?: number;
  disagreementDetected?: boolean;
}

export interface BehavioralDecision {
  action: BehavioralAction;
  posture: RealNiggaBehavior;
  confidence: number;
  reasons: string[];
}

function clamp(value: number): number { return Math.max(0, Math.min(1, value)); }

/** Deterministic behavior selection. It chooses posture/action, not wording. */
export function decideBehavior(
  personality: PersonalityState,
  context: BehavioralKernelContext = {},
): BehavioralDecision {
  const posture = deriveRealNiggaBehavior(personality, context);
  const ambiguity = clamp(context.ambiguity ?? 0);
  const reasons: string[] = [];

  if (context.serious === true || context.requiresPrecision === true) {
    reasons.push('serious-or-precision context');
    return { action: 'stay_serious', posture, confidence: 1 - ambiguity, reasons };
  }
  if (ambiguity >= 0.7) {
    reasons.push('high ambiguity');
    return { action: 'ask_clarifying', posture, confidence: 1 - ambiguity, reasons };
  }
  if (context.disagreementDetected === true || context.userAskedForPushback === true) {
    reasons.push('disagreement or explicit pushback requested');
    return { action: 'push_back', posture, confidence: Math.max(posture.disagreementDirectness, 0.5), reasons };
  }
  if (posture.directness >= 0.7) {
    reasons.push('high directness posture');
    return { action: 'answer_directly', posture, confidence: posture.directness, reasons };
  }

  reasons.push('default explanatory posture');
  return { action: 'explain', posture, confidence: Math.max(posture.warmth, 0.5), reasons };
}
