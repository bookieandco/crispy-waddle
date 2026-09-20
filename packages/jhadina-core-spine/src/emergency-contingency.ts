export type EmergencyCapability =
  | 'audio'
  | 'video'
  | 'location'
  | 'network'
  | 'off-device-storage'
  | 'push'
  | 'sms'
  | 'email'
  | 'call';

export interface EmergencyCapabilitySnapshot {
  readonly available: readonly EmergencyCapability[];
}

export type EmergencyContingencyCondition =
  | 'network-unavailable'
  | 'camera-unavailable'
  | 'location-unavailable'
  | 'off-device-storage-unavailable'
  | 'device-restarted'
  | 'no-acknowledgment'
  | 'severity-increased';

export type EmergencyContingencyAction =
  | 'queue-encrypted-evidence'
  | 'continue-audio'
  | 'continue-location'
  | 'retry-persistence'
  | 'escalate-next-step'
  | 'use-next-authorized-channel'
  | 'resume-incident';

export interface EmergencyContingency {
  readonly id: string;
  readonly condition: EmergencyContingencyCondition;
  readonly priority: number;
  readonly actions: readonly EmergencyContingencyAction[];
  readonly requiresPreAuthorization: boolean;
}

export function resolveEmergencyContingencies(
  configured: readonly EmergencyContingency[],
  condition: EmergencyContingencyCondition,
): readonly EmergencyContingency[] {
  return configured
    .filter((item) => item.condition === condition)
    .slice()
    .sort((a, b) => b.priority - a.priority);
}
