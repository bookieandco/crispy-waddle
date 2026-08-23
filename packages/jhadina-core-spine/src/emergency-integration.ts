import type { EmergencyExecutionContext } from './emergency-orchestrator.js';
import type { EmergencyNotificationPlan } from './emergency-notifications.js';
import type { EvidenceReleaseAuthorization } from './emergency-release.js';

export interface EmergencyIntegrationTrace {
  readonly incidentId: string;
  readonly stages: readonly (
    | 'triggered'
    | 'protocol-selected'
    | 'evidence-capture-started'
    | 'evidence-persisted'
    | 'notifications-sent'
    | 'acknowledged'
    | 'escalated'
    | 'release-authorized'
    | 'release-executed'
    | 'resolved'
  )[];
}

export interface EmergencyIntegrationHarness {
  run(context: EmergencyExecutionContext, notificationPlan: EmergencyNotificationPlan): Promise<EmergencyIntegrationTrace>;
}

export function assertEmergencyReleaseIsPreAuthorized(
  authorization: EvidenceReleaseAuthorization | null,
): asserts authorization is EvidenceReleaseAuthorization {
  if (!authorization) {
    throw new Error('Integration invariant violated: evidence release was not pre-authorized');
  }
}
