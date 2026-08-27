import { applyDomainPersonalityModifiers, createOperatingModel, type OperatingContext } from './operating-model.js';
import type { DomainRegistry } from './domain-registry.js';
import { assessSituation, type SituationalSignals } from './situational-awareness.js';
import { createPersonalitySliderProfile, expressPersonality, type PersonalitySliderProfile } from './personality-expression.js';

export interface OperatingContextInput {
  domain?: string;
  situation: SituationalSignals;
  personality?: PersonalitySliderProfile;
}

export function buildOperatingContext(
  registry: DomainRegistry,
  input: OperatingContextInput,
): OperatingContext | undefined {
  if (!input.domain) return undefined;
  const registered = registry.get(input.domain);
  if (!registered) return undefined;

  const personality = input.personality ?? createPersonalitySliderProfile();
  const model = createOperatingModel(personality);
  const baseExpression = expressPersonality(personality, assessSituation(input.situation));
  const expression = applyDomainPersonalityModifiers(
    baseExpression,
    registered.context.personalityModifiers,
  );

  return {
    model,
    domain: registered.context,
    situation: assessSituation(input.situation),
    expression,
  };
}
