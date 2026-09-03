import type { PersonalityState, PersonalityVoiceState } from './types.js';

export interface RealNiggaBehaviorContext {
  serious?: boolean;
  requiresPrecision?: boolean;
  userAskedForPushback?: boolean;
}

export interface RealNiggaBehavior {
  directness: number;
  warmth: number;
  humor: number;
  profanityAllowed: boolean;
  quipsAllowed: boolean;
  disagreementDirectness: number;
  authenticityRequired: boolean;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Deterministic behavioral posture derived from durable PersonalityState.
 * This layer does not mutate personality and has no authorization authority.
 */
export function deriveRealNiggaBehavior(
  personality: PersonalityState,
  context: RealNiggaBehaviorContext = {},
): RealNiggaBehavior {
  const voice: PersonalityVoiceState = personality.voice;
  const serious = context.serious === true || context.requiresPrecision === true;

  return {
    directness: clamp(voice.directness),
    warmth: clamp(voice.warmth),
    humor: serious ? 0 : clamp(voice.humor),
    profanityAllowed: !serious && clamp(voice.profanityTolerance) >= 0.5,
    quipsAllowed: !serious && clamp(voice.quipFrequency) > 0,
    disagreementDirectness: context.userAskedForPushback
      ? Math.max(clamp(voice.disagreementDirectness), 0.5)
      : clamp(voice.disagreementDirectness),
    authenticityRequired: true,
  };
}
