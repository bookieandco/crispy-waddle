import { emergencyScenarioMatrix } from './emergency-scenarios.js';
import type { EmergencyIntegrationTrace } from './emergency-integration.js';

export interface ScenarioRunResult {
  readonly scenario: string;
  readonly passed: boolean;
  readonly failures: readonly string[];
}

export function evaluateScenarioTrace(
  scenario: string,
  trace: EmergencyIntegrationTrace,
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

  return { scenario, passed: failures.length === 0, failures };
}

export function assertScenarioTrace(scenario: string, trace: EmergencyIntegrationTrace): void {
  const result = evaluateScenarioTrace(scenario, trace);
  if (!result.passed) {
    throw new Error(`Emergency scenario failed: ${scenario}: ${result.failures.join('; ')}`);
  }
}
