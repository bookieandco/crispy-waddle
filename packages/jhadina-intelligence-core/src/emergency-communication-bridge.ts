import type {
  EmergencyCommunicationIntent,
  EmergencyCommunicationReceipt,
  GovernedEmergencyCommunicationGateway,
} from '@jhadina/core-spine';
import type { CommunicationIntent } from './communication-contracts.js';

export interface EmergencyCommunicationDispatcher {
  dispatch(intent: CommunicationIntent): Promise<Readonly<{
    accepted: boolean;
    acknowledgedAt?: string;
    providerReference?: string;
  }>>;
}

export function toCommunicationIntent(
  input: EmergencyCommunicationIntent,
  authorizationEvidenceRef: string,
): CommunicationIntent {
  return {
    intentId: input.intentId,
    correlationId: input.incidentId,
    actorId: input.actorId,
    recipient: {
      endpointId: input.recipientId,
      kind: 'person',
      trustState: 'trusted',
      authorization: {
        capability: 'communications.send',
        granted: true,
        evidenceRef: authorizationEvidenceRef,
      },
    },
    capability: 'communications.send',
    contentRef: `safety-template:${input.templateId}:channel:${input.channel}`,
    createdAt: input.createdAt,
  };
}

export class GovernedEmergencyCommunicationAdapter implements GovernedEmergencyCommunicationGateway {
  constructor(
    private readonly dispatcher: EmergencyCommunicationDispatcher,
    private readonly authorizationEvidenceRef: string,
  ) {}

  async send(intent: EmergencyCommunicationIntent): Promise<EmergencyCommunicationReceipt> {
    const result = await this.dispatcher.dispatch(
      toCommunicationIntent(intent, this.authorizationEvidenceRef),
    );
    return {
      intentId: intent.intentId,
      accepted: result.accepted,
      acknowledgedAt: result.acknowledgedAt,
      providerReference: result.providerReference,
    };
  }
}
