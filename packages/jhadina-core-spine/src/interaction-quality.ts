import { decideBehavior } from './behavioral-kernel.js';
import { emptyPersonalityState } from './personality-core.js';
import { planExpression } from './expression-kernel.js';
import {
  createSessionExpressionState,
  rememberSessionBit,
  updateSessionExpressionState,
} from './session-expression.js';
import type { ExpressionRegister, PersonalityState } from './types.js';
import { voiceDeliveryFromExpression } from './voice-runtime.js';

export type InteractionQualityGateId =
  | 'identity-continuity'
  | 'semantic-invariance'
  | 'disagreement-without-hostility'
  | 'distress-high-stakes-override'
  | 'precision-technical-override'
  | 'sacred-love-boundary'
  | 'fringe-evidence-boundary'
  | 'clinical-evidence-boundary'
  | 'intimacy-agency-boundary'
  | 'cultural-salon-bounds'
  | 'session-ephemerality'
  | 'discomfort-kills-bit'
  | 'voice-expression-parity';

export interface InteractionQualityGate {
  id: InteractionQualityGateId;
  ready: boolean;
  detail: string;
}

export interface InteractionQualityCertification {
  status: 'READY' | 'DEGRADED';
  contractVersion: 'JHADINA-INTERACTION-QUALITY.FINAL';
  gates: readonly InteractionQualityGate[];
}

function familiarPersonality(): PersonalityState {
  const state = emptyPersonalityState('2026-09-23T00:00:00.000Z');
  return {
    ...state,
    relationship: {
      ...state.relationship!,
      familiarity: 1,
      calibrationConfidence: 1,
      preferredInteractionModes: ['direct', 'warm'],
    },
  };
}

function gate(id: InteractionQualityGateId, ready: boolean, detail: string): InteractionQualityGate {
  return Object.freeze({ id, ready, detail });
}

const ORDINARY_CONTINUITY_REGISTERS: readonly ExpressionRegister[] = Object.freeze([
  'default',
  'reflective',
  'playful',
  'storytelling',
  'threshold',
  'supportive-direct',
  'creative',
  'social-reaction',
  'cultural-salon',
  'community-room',
  'intimacy-agency',
  'household-ops',
]);

/**
 * Deterministic interaction-quality certification.
 *
 * This checks the governed posture and expression contracts that must remain
 * stable before model wording is allowed to vary. It never scores a person,
 * infers emotion, or grants action authority.
 */
export function certifyInteractionQuality(
  personality: PersonalityState = familiarPersonality(),
): InteractionQualityCertification {
  const baselineDecision = decideBehavior(personality, { register: 'default' });
  const continuityDecisions = ORDINARY_CONTINUITY_REGISTERS.map((register) =>
    decideBehavior(personality, {
      register,
      banterEligible: register === 'playful' || register === 'community-room' || register === 'cultural-salon',
      symbolicFramingEligible: register === 'threshold' || register === 'reflective',
      intimacyEligible: register === 'intimacy-agency',
      operationalContext: register === 'household-ops',
    }),
  );

  const identityContinuity = gate(
    'identity-continuity',
    continuityDecisions.every((decision) =>
      decision.posture.authenticityRequired === true &&
      decision.posture.relationshipFamiliarity === baselineDecision.posture.relationshipFamiliarity &&
      decision.posture.relationshipCalibration === baselineDecision.posture.relationshipCalibration,
    ),
    'Register changes preserve one relationship-calibrated Jhadina identity rather than switching personas.',
  );

  const semanticInvariance = gate(
    'semantic-invariance',
    continuityDecisions.every((decision) =>
      decision.action === baselineDecision.action &&
      decision.posture.directness === baselineDecision.posture.directness &&
      decision.posture.reasoningDepth === baselineDecision.posture.reasoningDepth,
    ),
    'Ordinary register changes alter presentation mechanics without changing the semantic behavioral action.',
  );

  const disagreementDecision = decideBehavior(personality, {
    register: 'playful',
    disagreementDetected: true,
    banterEligible: true,
  });
  const disagreement = planExpression(disagreementDecision);
  const disagreementWithoutHostility = gate(
    'disagreement-without-hostility',
    disagreementDecision.action === 'push_back' &&
      disagreement.mode === 'pushback' &&
      disagreement.allowPlayfulDisagreement === true &&
      disagreement.edginess !== 'none' &&
      disagreement.evidenceDiscipline === 'standard',
    'Jhadina can push back directly while keeping disagreement inside the governed presentation budget.',
  );

  const seriousDecision = decideBehavior(personality, {
    register: 'playful',
    distress: true,
    highStakes: true,
    banterEligible: true,
    symbolicFramingEligible: true,
    intimacyEligible: true,
    operationalContext: true,
  });
  const serious = planExpression(seriousDecision);
  const distressOverride = gate(
    'distress-high-stakes-override',
    seriousDecision.action === 'stay_serious' &&
      serious.register === 'serious' &&
      serious.allowProfanity === false &&
      serious.allowQuip === false &&
      serious.bitDepth === 0 &&
      serious.operationalSass === 'off' &&
      serious.affectionateTeasing === false &&
      serious.symbolicFraming === 'off' &&
      serious.evidenceDiscipline === 'strict',
    'Distress/high-stakes context overrides humor, intimacy, symbolism, sass, and banter.',
  );

  const precisionDecision = decideBehavior(personality, {
    register: 'creative',
    requiresPrecision: true,
    banterEligible: true,
    symbolicFramingEligible: true,
    operationalContext: true,
  });
  const precision = planExpression(precisionDecision);
  const precisionTechnicalOverride = gate(
    'precision-technical-override',
    precisionDecision.action === 'stay_serious' &&
      precision.register === 'serious' &&
      precision.creativeStyle === 'conventional' &&
      precision.evidenceDiscipline === 'strict' &&
      precision.bitDepth === 0 &&
      precision.metaphorDensity === 'none',
    'Precision-sensitive technical work suppresses creative flourish without reducing reasoning depth.',
  );

  const sacredDecision = decideBehavior(personality, {
    register: 'sacred-love',
    symbolicFramingEligible: true,
    intimacyEligible: true,
    banterEligible: false,
  });
  const sacred = planExpression(sacredDecision);
  const sacredLoveBoundary = gate(
    'sacred-love-boundary',
    sacred.register === 'sacred-love' &&
      sacred.symbolicFraming === 'interpretive' &&
      sacred.evidenceDiscipline === 'heightened' &&
      sacred.bitDepth === 0 &&
      sacred.edginess === 'none',
    'Sacred/relationship symbolism stays interpretive and does not inherit factual authority.',
  );

  const mythicDecision = decideBehavior(personality, {
    register: 'mythic-inquiry',
    symbolicFramingEligible: true,
    banterEligible: true,
  });
  const mythic = planExpression(mythicDecision);
  const perceptualDecision = decideBehavior(personality, {
    register: 'perceptual-inquiry',
    symbolicFramingEligible: true,
    banterEligible: false,
  });
  const perceptual = planExpression(perceptualDecision);
  const fringeEvidenceBoundary = gate(
    'fringe-evidence-boundary',
    mythic.symbolicFraming === 'interpretive' &&
      mythic.evidenceDiscipline === 'heightened' &&
      perceptual.symbolicFraming === 'interpretive' &&
      perceptual.evidenceDiscipline === 'strict' &&
      perceptual.bitDepth === 0,
    'Mythic curiosity remains available while altered-perception claims use stricter evidence discipline.',
  );

  const clinicalDecision = decideBehavior(personality, {
    register: 'clinical',
    banterEligible: true,
    intimacyEligible: true,
  });
  const clinical = planExpression(clinicalDecision);
  const clinicalBoundary = gate(
    'clinical-evidence-boundary',
    clinical.register === 'clinical' &&
      clinical.evidenceDiscipline === 'strict' &&
      clinical.bitDepth === 0 &&
      clinical.edginess === 'none' &&
      clinical.symbolicFraming === 'off' &&
      clinical.affectionateTeasing === false,
    'Clinical discussion is precise and non-performative even when familiarity is high.',
  );

  const intimacyDecision = decideBehavior(personality, {
    register: 'intimacy-agency',
    intimacyEligible: true,
    banterEligible: true,
  });
  const intimacy = planExpression(intimacyDecision);
  const intimacyBoundary = gate(
    'intimacy-agency-boundary',
    intimacy.register === 'intimacy-agency' &&
      intimacy.symbolicFraming === 'off' &&
      intimacy.storytellingDepth === 'brief' &&
      intimacy.edginess !== 'none' &&
      intimacy.evidenceDiscipline === 'standard',
    'Adult intimacy can be conversational without turning fantasy, history, or openness into factual inference.',
  );

  const salonDecision = decideBehavior(personality, {
    register: 'cultural-salon',
    banterEligible: true,
    symbolicFramingEligible: true,
  });
  const salon = planExpression(salonDecision);
  const culturalSalonBounds = gate(
    'cultural-salon-bounds',
    salon.register === 'cultural-salon' &&
      salon.storytellingDepth === 'extended' &&
      salon.edginess !== 'moderate' &&
      salon.evidenceDiscipline === 'standard' &&
      salon.operationalSass !== 'moderate',
    'Cultural storytelling may be expansive without turning roast energy into unrestricted edginess.',
  );

  const remembered = rememberSessionBit(createSessionExpressionState(), {
    id: 'quality-bit',
    phrase: 'orientation crystals',
    origin: 'shared',
    createdAtTurn: 1,
  });
  const sessionEphemerality = gate(
    'session-ephemerality',
    remembered.bits.length === 1 && remembered.bits[0]?.durable === false,
    'Running jokes remain explicitly ephemeral and cannot self-promote into durable Memory.',
  );

  const discomfortSession = updateSessionExpressionState(remembered, {
    userBuildingBit: true,
    discomfortDetected: true,
  });
  const playfulDecision = decideBehavior(personality, {
    register: 'playful',
    banterEligible: true,
  });
  const discomfortExpression = planExpression(playfulDecision, { session: discomfortSession });
  const discomfortKillsBit = gate(
    'discomfort-kills-bit',
    discomfortExpression.bitDepth === 0 && discomfortExpression.affectionateTeasing === false,
    'Observable discomfort immediately kills the bit and affectionate teasing.',
  );

  const thresholdDecision = decideBehavior(personality, {
    register: 'threshold',
    symbolicFramingEligible: true,
  });
  const threshold = planExpression(thresholdDecision);
  const thresholdDelivery = voiceDeliveryFromExpression(threshold);
  const playful = planExpression(playfulDecision);
  const playfulDelivery = voiceDeliveryFromExpression(playful);
  const voiceExpressionParity = gate(
    'voice-expression-parity',
    thresholdDelivery.style === 'threshold' &&
      thresholdDelivery.rate < playfulDelivery.rate &&
      thresholdDelivery.pauseScale > playfulDelivery.pauseScale,
    'Voice pacing follows the same governed register without changing semantic authority.',
  );

  const gates = Object.freeze([
    identityContinuity,
    semanticInvariance,
    disagreementWithoutHostility,
    distressOverride,
    precisionTechnicalOverride,
    sacredLoveBoundary,
    fringeEvidenceBoundary,
    clinicalBoundary,
    intimacyBoundary,
    culturalSalonBounds,
    sessionEphemerality,
    discomfortKillsBit,
    voiceExpressionParity,
  ]);

  return Object.freeze({
    status: gates.every((item) => item.ready) ? 'READY' : 'DEGRADED',
    contractVersion: 'JHADINA-INTERACTION-QUALITY.FINAL',
    gates,
  });
}
