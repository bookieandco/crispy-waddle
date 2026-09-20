import type { DeadManState } from './safety-deadman.js';
import type { SafetyTimelineEvent } from './safety-incident-timeline.js';

export interface DurableSafetyIncident {
  readonly incidentId: string;
  readonly ownerUserId: string;
  readonly protocolId: string;
  readonly deadManState: DeadManState;
  readonly deadlineAt?: string;
  readonly updatedAt: string;
  readonly timeline: readonly SafetyTimelineEvent[];
}

export interface DurableSafetyIncidentStore {
  load(incidentId: string): Promise<DurableSafetyIncident | null>;
  save(snapshot: DurableSafetyIncident, expectedUpdatedAt?: string): Promise<'saved' | 'conflict'>;
}

export interface SafetyIncidentRpcClient {
  loadIncident(incidentId: string): Promise<DurableSafetyIncident | null>;
  saveIncident(snapshot: DurableSafetyIncident, expectedUpdatedAt?: string): Promise<boolean>;
}

export class RpcDurableSafetyIncidentStore implements DurableSafetyIncidentStore {
  constructor(private readonly client: SafetyIncidentRpcClient) {}

  load(incidentId: string): Promise<DurableSafetyIncident | null> {
    return this.client.loadIncident(incidentId);
  }

  async save(snapshot: DurableSafetyIncident, expectedUpdatedAt?: string): Promise<'saved' | 'conflict'> {
    return (await this.client.saveIncident(snapshot, expectedUpdatedAt)) ? 'saved' : 'conflict';
  }
}
