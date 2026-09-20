export type SafetyIncidentMode = 'drill' | 'live';

export interface SafetyDrillGuard {
  readonly mode: SafetyIncidentMode;
  readonly allowedRecipientIds: readonly string[];
  readonly allowExternalEmergencyServices: false;
  readonly allowEvidenceRelease: false;
}

export function assertDrillRecipient(guard: SafetyDrillGuard, recipientId: string): void {
  if (guard.mode !== 'drill') throw new Error('Not a safety drill');
  if (!guard.allowedRecipientIds.includes(recipientId)) throw new Error('Recipient not allowlisted for drill');
}

export function assertDrillIsNonEmergency(guard: SafetyDrillGuard): void {
  if (guard.allowExternalEmergencyServices || guard.allowEvidenceRelease) {
    throw new Error('Safety drill may not contact emergency services or release evidence');
  }
}
