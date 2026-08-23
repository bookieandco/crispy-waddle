import type { EmergencyExecutionContext } from './emergency-orchestrator.js';
import type { EmergencyNotificationPlan } from './emergency-notifications.js';
import type { EmergencyIntegrationTrace } from './emergency-integration.js';

export interface FakeEmergencyRun {
  readonly context: EmergencyExecutionContext;
  readonly notificationPlan: EmergencyNotificationPlan;
}

/**
 * Deterministic test seam. A concrete test suite can inject fake capture,
 * persistence, notification, and release adapters without touching real
 * devices, networks, recipients, or evidence stores.
 */
export interface EmergencyE2EHarness {
  run(input: FakeEmergencyRun): Promise<EmergencyIntegrationTrace>;
}

export function assertTraceContains(
  trace: EmergencyIntegrationTrace,
  ...required: EmergencyIntegrationTrace['stages'][number][]
): void {
  for (const stage of required) {
    if (!trace.stages.includes(stage)) {
      throw new Error(`Emergency E2E invariant failed: missing stage ${stage}`);
    }
  }
}
