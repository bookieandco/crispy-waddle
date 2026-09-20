import type { EmergencyMessageChannel } from './emergency-notifications.js';

export interface EmergencyCommunicationIntent {
  readonly intentId: string;
  readonly incidentId: string;
  readonly actorId: string;
  readonly recipientId: string;
  readonly channel: EmergencyMessageChannel;
  readonly templateId: string;
  readonly createdAt: string;
}

export interface EmergencyCommunicationReceipt {
  readonly intentId: string;
  readonly accepted: boolean;
  readonly acknowledgedAt?: string;
  readonly providerReference?: string;
}

/**
 * Bridge only. Production implementations must dispatch through Jhadina's
 * governed communications runtime and return its durable delivery evidence.
 */
export interface GovernedEmergencyCommunicationGateway {
  send(intent: EmergencyCommunicationIntent): Promise<EmergencyCommunicationReceipt>;
}
