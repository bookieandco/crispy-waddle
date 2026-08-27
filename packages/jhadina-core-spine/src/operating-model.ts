import type { PersonalityExpression, PersonalitySliderProfile } from './personality-expression.js';
import type { SituationalSignals } from './situational-awareness.js';

export type OperatingPrinciple =
  | 'UNDERSTAND_BEFORE_ACTING'
  | 'EVIDENCE_BEFORE_CERTAINTY'
  | 'PREFER_REVERSIBLE_ACTIONS'
  | 'PRESERVE_USER_AGENCY'
  | 'EXPLAIN_MEANINGFUL_TRADEOFFS'
  | 'LEARN_FROM_OUTCOMES'
  | 'USE_DOMAIN_CAPABILITIES'
  | 'AUDIT_CONSEQUENTIAL_ACTIONS';

export interface DomainPersonalityModifiers {
  warmth?: number;
  playfulness?: number;
  directness?: number;
  patience?: number;
  curiosity?: number;
  assertiveness?: number;
  formality?: number;
  humor?: number;
  empathy?: number;
  riskTolerance?: number;
}

export interface DomainOperatingContext {
  domain: string;
  goal: string;
  capabilities: string[];
  evidenceRequirements?: string[];
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  personalityModifiers?: DomainPersonalityModifiers;
}

export interface JhadinaOperatingModel {
  version: 1;
  principles: readonly OperatingPrinciple[];
  personality: PersonalitySliderProfile;
}

export interface OperatingContext {
  model: JhadinaOperatingModel;
  domain: DomainOperatingContext;
  situation: SituationalSignals;
  expression: PersonalityExpression;
}

const clamp = (n: number): number => Math.max(0, Math.min(100, n));

export function createOperatingModel(personality: PersonalitySliderProfile): JhadinaOperatingModel {
  return {
    version: 1,
    principles: [
      'UNDERSTAND_BEFORE_ACTING', 'EVIDENCE_BEFORE_CERTAINTY', 'PREFER_REVERSIBLE_ACTIONS',
      'PRESERVE_USER_AGENCY', 'EXPLAIN_MEANINGFUL_TRADEOFFS', 'LEARN_FROM_OUTCOMES',
      'USE_DOMAIN_CAPABILITIES', 'AUDIT_CONSEQUENTIAL_ACTIONS',
    ],
    personality,
  };
}

export function applyDomainPersonalityModifiers(
  expression: PersonalityExpression,
  modifiers: DomainPersonalityModifiers = {},
): PersonalityExpression {
  return {
    warmth: clamp(expression.warmth + (modifiers.warmth ?? 0)),
    playfulness: clamp(expression.playfulness + (modifiers.playfulness ?? 0)),
    directness: clamp(expression.directness + (modifiers.directness ?? 0)),
    patience: clamp(expression.patience + (modifiers.patience ?? 0)),
    curiosity: clamp(expression.curiosity + (modifiers.curiosity ?? 0)),
    assertiveness: clamp(expression.assertiveness + (modifiers.assertiveness ?? 0)),
    formality: clamp(expression.formality + (modifiers.formality ?? 0)),
    humor: clamp(expression.humor + (modifiers.humor ?? 0)),
    empathy: clamp(expression.empathy + (modifiers.empathy ?? 0)),
    riskTolerance: clamp(expression.riskTolerance + (modifiers.riskTolerance ?? 0)),
  };
}
