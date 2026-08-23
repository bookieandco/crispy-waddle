import { emergencyScenarioMatrix } from './emergency-scenarios.js';
import type { EmergencyIntegrationTrace } from './emergency-integration.js';
import { evaluateScenarioTrace } from './emergency-scenario-tests.js';

export interface EmergencyScenarioSuiteResult {
  readonly passed: boolean;
  readonly results: readonly ReturnType<typeof evaluateScenarioTrace>[];
}

export function runEmergencyScenarioSuite(
  traces: Readonly<Record<string, EmergencyIntegrationTrace>>,
): EmergencyScenarioSuiteResult {
  const results = emergencyScenarioMatrix.map(({ name }) => {
    const trace = traces[name];
    if (!trace) {
      return { scenario: name, passed: false, failures: ['Missing scenario trace'] };
    }
    return evaluateScenarioTrace(name, trace);
  });

  return {
    passed: results.every((result) => result.passed),
    results,
  };
}
