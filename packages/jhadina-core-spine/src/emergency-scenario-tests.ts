import { emergencyScenarioMatrix } from './emergency-scenarios.js';
import type { EmergencyIntegrationTrace } from './emergency-integration.js';

export type ScenarioObservedEffect = string;

export interface ScenarioRunResult {
  readonly scenario: string;
  readonly passed: boolean;
  readonly failures: readonly string[];
}

export function evaluateScenarioTrace(
  scenario: string,
  trace: EmergencyIntegrationTrace,
  observedEffects: readonly ScenarioObservedEffect[] = [],
): ScenarioRunResult {
  const expectation = emergencyScenarioMatrix.find((item) => item.name === scenario);
  if (!expectation) {
    return { scenario, passed: false, failures: [`Unknown scenario: ${scenario}`] };
  }

  const failures: string[] = [];
  for (const requiredStage of expectation.requiredStages) {
    if (!trace.stages.includes(requiredStage as EmergencyIntegrationTrace['stages'][number])) {
      failures.push(`Missing required stage: ${requiredStage}`);
    }
  }
  for (const forbiddenEffect of expectation.forbiddenEffects) {
    if (observedEffects.includes(forbiddenEffect)) {
      failures.push(`Forbidden effect observed: ${forbiddenEffect}`);
    }
  }

  return { scenario, passed: failures.length === 0, failures };
}

export function assertScenarioTrace(
  scenario: string,
  trace: EmergencyIntegrationTrace,
  observedEffects: readonly ScenarioObservedEffect[] = [],
): void {
  const result = evaluateScenarioTrace(scenario, trace, observedEffects);
  if (!result.passed) {
    throw new Error(`Emergency scenario failed: ${scenario}: ${result.failures.join('; ')}`);
  }
}
