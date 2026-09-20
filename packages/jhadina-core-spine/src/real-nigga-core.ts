import type {
  PersonalityState,
  PersonalityTasteState,
  PersonalityVoiceState,
} from './types.js';

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
  profanityIntensity: number;
  quipsAllowed: boolean;
  quipIntensity: number;
  disagreementDirectness: number;
  relationshipFamiliarity: number;
  relationshipCalibration: number;
  preferredInteractionModes: string[];
  creativeLatitude: number;
  conventionTolerance: number;
  authenticityRequired: boolean;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeModes(modes: readonly string[]): string[] {
  return [...new Set(
    modes
      .map((mode) => mode.trim().toLowerCase())
      .filter(Boolean),
  )].sort();
}

function creativeLatitude(taste: PersonalityTasteState): number {
  return clamp(
    (
      clamp(taste.novelty) +
      clamp(taste.experimentation) +
      clamp(taste.aestheticIntensity) +
      (1 - clamp(taste.conventionTolerance))
    ) / 4,
  );
}

/**
 * Deterministic behavioral posture derived from durable PersonalityState.
 *
 * RelationshipState calibrates familiarity-sensitive behavior; Taste supplies
 * bounded creative latitude. Neither can mutate personality, grant authority,
 * override policy, or select callbacks/cultural references on its own.
 */
export function deriveRealNiggaBehavior(
  personality: PersonalityState,
  context: RealNiggaBehaviorContext = {},
): RealNiggaBehavior {
  const voice: PersonalityVoiceState = personality.voice;
  const relationship = personality.relationship;
  const taste = personality.taste;
  const serious = context.serious === true || context.requiresPrecision === true;

  const familiarity = clamp(relationship.familiarity);
  const relationshipCalibration = clamp(familiarity * clamp(relationship.calibrationConfidence));
  const preferredInteractionModes = normalizeModes(relationship.preferredInteractionModes);
  const prefersDirect = preferredInteractionModes.includes('direct');
  const prefersWarm = preferredInteractionModes.includes('warm');

  const directness = clamp(
    clamp(voice.directness) + (prefersDirect ? 0.15 * relationshipCalibration : 0),
  );
  const warmth = clamp(
    clamp(voice.warmth) + (prefersWarm ? 0.15 * relationshipCalibration : 0),
  );

  const tasteLatitude = creativeLatitude(taste);
  const activeCreativeLatitude = serious ? 0 : tasteLatitude;
  const profanityIntensity = serious
    ? 0
    : clamp(clamp(voice.profanityTolerance) * (0.5 + 0.5 * relationshipCalibration));
  const quipIntensity = serious
    ? 0
    : clamp(clamp(voice.quipFrequency) * (0.75 + 0.25 * tasteLatitude));

  return {
    directness,
    warmth,
    humor: serious ? 0 : clamp(voice.humor),
    profanityAllowed: profanityIntensity >= 0.5,
    profanityIntensity,
    quipsAllowed: quipIntensity > 0,
    quipIntensity,
    disagreementDirectness: context.userAskedForPushback
      ? Math.max(clamp(voice.disagreementDirectness), 0.5)
      : clamp(voice.disagreementDirectness),
    relationshipFamiliarity: familiarity,
    relationshipCalibration,
    preferredInteractionModes,
    creativeLatitude: activeCreativeLatitude,
    conventionTolerance: clamp(taste.conventionTolerance),
    authenticityRequired: true,
  };
}
