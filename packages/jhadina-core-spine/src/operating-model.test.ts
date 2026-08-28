import { describe, expect, it } from 'vitest';
import { createPersonalitySliderProfile, expressPersonality } from './personality-expression.js';
import { assessSituation } from './situational-awareness.js';
import { applyDomainPersonalityModifiers, createOperatingModel } from './operating-model.js';

describe('Jhadina operating model', () => {
  it('preserves the global personality while producing a domain expression', () => {
    const personality = createPersonalitySliderProfile({ humor: 80, directness: 60 });
    const model = createOperatingModel(personality);
    const situation = assessSituation({ topicSeverity: 20, humorSignal: 80 });
    const expression = expressPersonality(model.personality, situation);
    const domainExpression = applyDomainPersonalityModifiers(expression, { humor: 15, directness: 10 });

    expect(model.personality.humor).toBe(80);
    expect(domainExpression.humor).toBeGreaterThan(expression.humor);
    expect(domainExpression.directness).toBeGreaterThan(expression.directness);
  });

  it('clamps domain modifiers and keeps the operating principles deterministic', () => {
    const model = createOperatingModel(createPersonalitySliderProfile());
    const expression = expressPersonality(model.personality, assessSituation({}));
    const modified = applyDomainPersonalityModifiers(expression, { humor: 100, riskTolerance: -100 });

    expect(modified.humor).toBe(100);
    expect(modified.riskTolerance).toBe(0);
    expect(model.principles).toContain('EVIDENCE_BEFORE_CERTAINTY');
    expect(model.principles).toContain('PRESERVE_USER_AGENCY');
  });
});
