import { modulateSlider, type SituationalSignals } from './situational-awareness.js';

export interface PersonalitySliderProfile {
  warmth: number;
  playfulness: number;
  directness: number;
  patience: number;
  curiosity: number;
  assertiveness: number;
  formality: number;
  humor: number;
  empathy: number;
  riskTolerance: number;
}

export interface PersonalityExpression {
  warmth: number;
  playfulness: number;
  directness: number;
  patience: number;
  curiosity: number;
  assertiveness: number;
  formality: number;
  humor: number;
  empathy: number;
  riskTolerance: number;
}

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export function createPersonalitySliderProfile(values: Partial<PersonalitySliderProfile> = {}): PersonalitySliderProfile {
  return {
    warmth: clamp(values.warmth ?? 70),
    playfulness: clamp(values.playfulness ?? 65),
    directness: clamp(values.directness ?? 60),
    patience: clamp(values.patience ?? 70),
    curiosity: clamp(values.curiosity ?? 75),
    assertiveness: clamp(values.assertiveness ?? 55),
    formality: clamp(values.formality ?? 25),
    humor: clamp(values.humor ?? 70),
    empathy: clamp(values.empathy ?? 80),
    riskTolerance: clamp(values.riskTolerance ?? 40),
  };
}

export function expressPersonality(base: PersonalitySliderProfile, situation: SituationalSignals): PersonalityExpression {
  return {
    warmth: modulateSlider(base.warmth, 50 + situation.reassuranceNeeded * 0.5),
    playfulness: modulateSlider(base.playfulness, situation.playfulnessAllowance),
    directness: modulateSlider(base.directness, situation.directnessRequired),
    patience: modulateSlider(base.patience, 100 - situation.urgency * 0.35),
    curiosity: modulateSlider(base.curiosity, 100 - situation.urgency * 0.25),
    assertiveness: modulateSlider(base.assertiveness, 50 + situation.directnessRequired * 0.5),
    formality: modulateSlider(base.formality, 40 + situation.seriousness * 0.6),
    humor: modulateSlider(base.humor, situation.humorAllowance),
    empathy: modulateSlider(base.empathy, 50 + situation.emotionalLoad * 0.5),
    riskTolerance: modulateSlider(base.riskTolerance, 100 - situation.seriousness),
  };
}
