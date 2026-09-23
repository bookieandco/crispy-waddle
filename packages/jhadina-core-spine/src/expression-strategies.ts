import type { ExpressionRegister } from './types.js';

export interface ExpressionStrategyProfile {
  register: ExpressionRegister;
  cadence: 'tight' | 'conversational' | 'spacious';
  metaphorBias: 'none' | 'light' | 'moderate';
  bitDepthCap: 0 | 1 | 2 | 3;
  allowPlayfulDisagreement: boolean;
  symbolicFraming: 'off' | 'interpretive';
  storytellingDepth: 'none' | 'brief' | 'extended';
  edginessCap: 'none' | 'light' | 'moderate';
  reentryToPlayfulness: 'off' | 'cautious' | 'allowed';
  evidenceDiscipline: 'standard' | 'heightened' | 'strict';
  operationalSassCap: 'off' | 'light' | 'moderate';
  affectionateTeasing: boolean;
  workloadBoundary: 'implicit' | 'explicit';
  speakingRate: 'slow' | 'normal' | 'fast';
}

/**
 * Governed mechanics only. Source/reference personalities belong in audit
 * documentation; runtime generation never receives an instruction to imitate
 * a real person or fictional character.
 */
export const EXPRESSION_STRATEGIES: Readonly<Record<ExpressionRegister, ExpressionStrategyProfile>> =
  Object.freeze({
    default: {
      register: 'default', cadence: 'conversational', metaphorBias: 'light', bitDepthCap: 1,
      allowPlayfulDisagreement: true, symbolicFraming: 'off', storytellingDepth: 'brief',
      edginessCap: 'light', reentryToPlayfulness: 'allowed', evidenceDiscipline: 'standard',
      operationalSassCap: 'off', affectionateTeasing: false, workloadBoundary: 'implicit', speakingRate: 'normal',
    },
    reflective: {
      register: 'reflective', cadence: 'spacious', metaphorBias: 'moderate', bitDepthCap: 0,
      allowPlayfulDisagreement: false, symbolicFraming: 'interpretive', storytellingDepth: 'brief',
      edginessCap: 'none', reentryToPlayfulness: 'cautious', evidenceDiscipline: 'standard',
      operationalSassCap: 'off', affectionateTeasing: false, workloadBoundary: 'implicit', speakingRate: 'slow',
    },
    playful: {
      register: 'playful', cadence: 'conversational', metaphorBias: 'light', bitDepthCap: 2,
      allowPlayfulDisagreement: true, symbolicFraming: 'off', storytellingDepth: 'brief',
      edginessCap: 'moderate', reentryToPlayfulness: 'allowed', evidenceDiscipline: 'standard',
      operationalSassCap: 'light', affectionateTeasing: true, workloadBoundary: 'implicit', speakingRate: 'fast',
    },
    storytelling: {
      register: 'storytelling', cadence: 'conversational', metaphorBias: 'moderate', bitDepthCap: 2,
      allowPlayfulDisagreement: true, symbolicFraming: 'interpretive', storytellingDepth: 'extended',
      edginessCap: 'moderate', reentryToPlayfulness: 'allowed', evidenceDiscipline: 'standard',
      operationalSassCap: 'off', affectionateTeasing: false, workloadBoundary: 'implicit', speakingRate: 'normal',
    },
    'sacred-love': {
      register: 'sacred-love', cadence: 'spacious', metaphorBias: 'moderate', bitDepthCap: 0,
      allowPlayfulDisagreement: false, symbolicFraming: 'interpretive', storytellingDepth: 'brief',
      edginessCap: 'none', reentryToPlayfulness: 'cautious', evidenceDiscipline: 'heightened',
      operationalSassCap: 'off', affectionateTeasing: false, workloadBoundary: 'implicit', speakingRate: 'slow',
    },
    threshold: {
      register: 'threshold', cadence: 'spacious', metaphorBias: 'moderate', bitDepthCap: 1,
      allowPlayfulDisagreement: false, symbolicFraming: 'interpretive', storytellingDepth: 'brief',
      edginessCap: 'none', reentryToPlayfulness: 'cautious', evidenceDiscipline: 'standard',
      operationalSassCap: 'off', affectionateTeasing: false, workloadBoundary: 'implicit', speakingRate: 'slow',
    },
    'supportive-direct': {
      register: 'supportive-direct', cadence: 'conversational', metaphorBias: 'light', bitDepthCap: 1,
      allowPlayfulDisagreement: true, symbolicFraming: 'off', storytellingDepth: 'none',
      edginessCap: 'light', reentryToPlayfulness: 'cautious', evidenceDiscipline: 'standard',
      operationalSassCap: 'off', affectionateTeasing: false, workloadBoundary: 'implicit', speakingRate: 'normal',
    },
    creative: {
      register: 'creative', cadence: 'conversational', metaphorBias: 'moderate', bitDepthCap: 2,
      allowPlayfulDisagreement: true, symbolicFraming: 'interpretive', storytellingDepth: 'extended',
      edginessCap: 'moderate', reentryToPlayfulness: 'allowed', evidenceDiscipline: 'standard',
      operationalSassCap: 'light', affectionateTeasing: true, workloadBoundary: 'implicit', speakingRate: 'normal',
    },
    'anomaly-inquiry': {
      register: 'anomaly-inquiry', cadence: 'conversational', metaphorBias: 'light', bitDepthCap: 1,
      allowPlayfulDisagreement: true, symbolicFraming: 'interpretive', storytellingDepth: 'brief',
      edginessCap: 'light', reentryToPlayfulness: 'allowed', evidenceDiscipline: 'heightened',
      operationalSassCap: 'off', affectionateTeasing: false, workloadBoundary: 'implicit', speakingRate: 'normal',
    },
    'social-reaction': {
      register: 'social-reaction', cadence: 'conversational', metaphorBias: 'light', bitDepthCap: 2,
      allowPlayfulDisagreement: true, symbolicFraming: 'off', storytellingDepth: 'brief',
      edginessCap: 'moderate', reentryToPlayfulness: 'allowed', evidenceDiscipline: 'heightened',
      operationalSassCap: 'light', affectionateTeasing: true, workloadBoundary: 'implicit', speakingRate: 'fast',
    },
    'cultural-salon': {
      register: 'cultural-salon', cadence: 'spacious', metaphorBias: 'moderate', bitDepthCap: 2,
      allowPlayfulDisagreement: true, symbolicFraming: 'interpretive', storytellingDepth: 'extended',
      edginessCap: 'light', reentryToPlayfulness: 'allowed', evidenceDiscipline: 'standard',
      operationalSassCap: 'light', affectionateTeasing: true, workloadBoundary: 'implicit', speakingRate: 'normal',
    },
    'community-room': {
      register: 'community-room', cadence: 'conversational', metaphorBias: 'light', bitDepthCap: 2,
      allowPlayfulDisagreement: true, symbolicFraming: 'off', storytellingDepth: 'brief',
      edginessCap: 'moderate', reentryToPlayfulness: 'allowed', evidenceDiscipline: 'heightened',
      operationalSassCap: 'light', affectionateTeasing: true, workloadBoundary: 'implicit', speakingRate: 'fast',
    },
    investigative: {
      register: 'investigative', cadence: 'tight', metaphorBias: 'none', bitDepthCap: 0,
      allowPlayfulDisagreement: false, symbolicFraming: 'off', storytellingDepth: 'none',
      edginessCap: 'none', reentryToPlayfulness: 'cautious', evidenceDiscipline: 'strict',
      operationalSassCap: 'off', affectionateTeasing: false, workloadBoundary: 'implicit', speakingRate: 'normal',
    },
    clinical: {
      register: 'clinical', cadence: 'tight', metaphorBias: 'none', bitDepthCap: 0,
      allowPlayfulDisagreement: false, symbolicFraming: 'off', storytellingDepth: 'none',
      edginessCap: 'none', reentryToPlayfulness: 'off', evidenceDiscipline: 'strict',
      operationalSassCap: 'off', affectionateTeasing: false, workloadBoundary: 'implicit', speakingRate: 'slow',
    },
    'mythic-inquiry': {
      register: 'mythic-inquiry', cadence: 'conversational', metaphorBias: 'moderate', bitDepthCap: 1,
      allowPlayfulDisagreement: true, symbolicFraming: 'interpretive', storytellingDepth: 'extended',
      edginessCap: 'light', reentryToPlayfulness: 'allowed', evidenceDiscipline: 'heightened',
      operationalSassCap: 'off', affectionateTeasing: false, workloadBoundary: 'implicit', speakingRate: 'normal',
    },
    'intimacy-agency': {
      register: 'intimacy-agency', cadence: 'conversational', metaphorBias: 'light', bitDepthCap: 1,
      allowPlayfulDisagreement: true, symbolicFraming: 'off', storytellingDepth: 'brief',
      edginessCap: 'moderate', reentryToPlayfulness: 'allowed', evidenceDiscipline: 'standard',
      operationalSassCap: 'light', affectionateTeasing: true, workloadBoundary: 'implicit', speakingRate: 'normal',
    },
    'household-ops': {
      register: 'household-ops', cadence: 'conversational', metaphorBias: 'light', bitDepthCap: 1,
      allowPlayfulDisagreement: true, symbolicFraming: 'off', storytellingDepth: 'brief',
      edginessCap: 'moderate', reentryToPlayfulness: 'allowed', evidenceDiscipline: 'standard',
      operationalSassCap: 'moderate', affectionateTeasing: true, workloadBoundary: 'explicit', speakingRate: 'normal',
    },
    serious: {
      register: 'serious', cadence: 'tight', metaphorBias: 'none', bitDepthCap: 0,
      allowPlayfulDisagreement: false, symbolicFraming: 'off', storytellingDepth: 'none',
      edginessCap: 'none', reentryToPlayfulness: 'off', evidenceDiscipline: 'strict',
      operationalSassCap: 'off', affectionateTeasing: false, workloadBoundary: 'explicit', speakingRate: 'slow',
    },
  });

export function getExpressionStrategy(register: ExpressionRegister): ExpressionStrategyProfile {
  return EXPRESSION_STRATEGIES[register];
}
