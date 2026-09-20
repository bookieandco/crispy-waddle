import type { EmergencyIntegrationTrace } from './emergency-integration.js';
import { evaluateScenarioTrace, type ScenarioObservedEffect } from './emergency-scenario-tests.js';

export interface EmergencyAdversarialCase {
  readonly scenario: string;
  readonly trace: EmergencyIntegrationTrace;
  readonly observedEffects: readonly ScenarioObservedEffect[];
  readonly duplicateActionIds?: readonly string[];
}

export interface EmergencyAdversarialResult {
  readonly scenario: string;
  readonly passed: boolean;
  readonly failures: readonly string[];
}

export function evaluateEmergencyAdversarialCase(
  input: EmergencyAdversarialCase,
): EmergencyAdversarialResult {
  const result = evaluateScenarioTrace(input.scenario, input.trace, input.observedEffects);
  const failures = [...result.failures];
  const ids = input.duplicateActionIds ?? [];
  if (new Set(ids).size !== ids.length) failures.push('Duplicate action execution detected');
  return { scenario: input.scenario, passed: failures.length === 0, failures };
}

export function assertEmergencyAdversarialSuite(
  cases: readonly EmergencyAdversarialCase[],
): void {
  const failures = cases
    .map(evaluateEmergencyAdversarialCase)
    .filter((result) => !result.passed);
  if (failures.length) {
    throw new Error('Emergency adversarial suite failed: ' + failures.map((item) => item.scenario).join(', '));
  }
}
