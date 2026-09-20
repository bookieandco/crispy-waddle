import {
  DEFAULT_PERSONALITY_RELATIONSHIP,
  DEFAULT_PERSONALITY_TASTE,
  DEFAULT_PERSONALITY_VOICE,
} from './personality-core.js';
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
  /** 0 = terse, 1 = highly detailed. */
  verbosity: number;
  /** 0 = casual, 1 = formal. */
  formality: number;
  /** 0 = simplified, 1 = deeply technical. */
  reasoningDepth: number;
  /** Presentation preference only; never grants autonomous execution authority. */
  workflowContinuity: number;
  explanationStyle: 'standard' | 'step-by-step' | 'evidence-first';
  decisionPresentation: 'balanced' | 'options';
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

function acceptedCalibration(personality: PersonalityState, statement: string): number {
  const trait = personality.traits.find(
    (candidate) =>
      candidate.status === 'accepted' &&
      candidate.statement.trim().toLowerCase() === statement,
  );
  return trait ? clamp(trait.confidence * trait.stability) : 0;
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
  const voice: PersonalityVoiceState = personality.voice ?? DEFAULT_PERSONALITY_VOICE;
  const relationship = personality.relationship ?? DEFAULT_PERSONALITY_RELATIONSHIP;
  const taste: PersonalityTasteState = personality.taste ?? DEFAULT_PERSONALITY_TASTE;
  const serious = context.serious === true || context.requiresPrecision === true;

  const familiarity = clamp(relationship.familiarity);
  const relationshipCalibration = clamp(familiarity * clamp(relationship.calibrationConfidence));
  const learnedDirectnessCalibration = acceptedCalibration(personality, 'prefers direct communication');
  const learnedConcisionCalibration = acceptedCalibration(personality, 'prefers concise communication');
  const learnedWarmthCalibration = acceptedCalibration(personality, 'prefers warm communication');
  const learnedFormalityCalibration = acceptedCalibration(personality, 'prefers formal communication');
  const learnedHumorCalibration = acceptedCalibration(personality, 'prefers humorous communication');
  const learnedProfanityCalibration = acceptedCalibration(personality, 'allows conversational profanity');
  const learnedPushbackCalibration = acceptedCalibration(personality, 'prefers active pushback');
  const learnedTechnicalDepthCalibration = acceptedCalibration(personality, 'prefers technical depth');
  const learnedWorkflowCalibration = acceptedCalibration(personality, 'prefers continuous workflow');
  const learnedStepByStepCalibration = acceptedCalibration(personality, 'prefers step-by-step explanations');
  const learnedEvidenceFirstCalibration = acceptedCalibration(personality, 'prefers evidence-first explanations');
  const learnedOptionsCalibration = acceptedCalibration(personality, 'prefers multiple options');
  const learnedExperimentationCalibration = acceptedCalibration(personality, 'prefers experimental creativity');
  const learnedFamiliarToneCalibration = acceptedCalibration(personality, 'prefers familiar tone');
  const preferredInteractionModes = normalizeModes(relationship.preferredInteractionModes);
  const prefersDirect = preferredInteractionModes.includes('direct');
  const prefersWarm = preferredInteractionModes.includes('warm');

  const directness = clamp(
    clamp(voice.directness) +
      (prefersDirect ? 0.15 * relationshipCalibration : 0) +
      0.15 * learnedDirectnessCalibration,
  );
  const warmth = clamp(
    clamp(voice.warmth) +
      (prefersWarm ? 0.15 * relationshipCalibration : 0) +
      0.15 * learnedWarmthCalibration +
      0.1 * learnedFamiliarToneCalibration,
  );
  const verbosity = clamp(
    clamp(voice.verbosity) - 0.25 * learnedConcisionCalibration,
  );
  const formality = clamp(0.5 + 0.35 * learnedFormalityCalibration);
  const reasoningDepth = clamp(
    0.5 + 0.35 * learnedTechnicalDepthCalibration + (context.requiresPrecision ? 0.15 : 0),
  );
  const workflowContinuity = clamp(0.5 + 0.35 * learnedWorkflowCalibration);
  const explanationStyle: RealNiggaBehavior['explanationStyle'] =
    learnedEvidenceFirstCalibration > 0
      ? 'evidence-first'
      : learnedStepByStepCalibration > 0
        ? 'step-by-step'
        : 'standard';
  const decisionPresentation: RealNiggaBehavior['decisionPresentation'] =
    learnedOptionsCalibration > 0 ? 'options' : 'balanced';

  const tasteLatitude = clamp(
    creativeLatitude(taste) + 0.2 * learnedExperimentationCalibration,
  );
  const activeCreativeLatitude = serious ? 0 : tasteLatitude;
  const profanityIntensity = serious
    ? 0
    : clamp(
        clamp(voice.profanityTolerance) * (0.5 + 0.5 * relationshipCalibration) +
        0.25 * learnedProfanityCalibration,
      );
  const quipIntensity = serious
    ? 0
    : clamp(clamp(voice.quipFrequency) * (0.75 + 0.25 * tasteLatitude));

  return {
    directness,
    warmth,
    verbosity,
    formality: serious ? Math.max(formality, 0.75) : formality,
    reasoningDepth,
    workflowContinuity,
    explanationStyle,
    decisionPresentation,
    humor: serious ? 0 : clamp(clamp(voice.humor) + 0.2 * learnedHumorCalibration),
    profanityAllowed: profanityIntensity >= 0.5,
    profanityIntensity,
    quipsAllowed: quipIntensity > 0,
    quipIntensity,
    disagreementDirectness: context.userAskedForPushback
      ? Math.max(clamp(voice.disagreementDirectness), 0.5)
      : clamp(clamp(voice.disagreementDirectness) + 0.25 * learnedPushbackCalibration),
    relationshipFamiliarity: familiarity,
    relationshipCalibration,
    preferredInteractionModes,
    creativeLatitude: activeCreativeLatitude,
    conventionTolerance: clamp(taste.conventionTolerance),
    authenticityRequired: true,
  };
}
