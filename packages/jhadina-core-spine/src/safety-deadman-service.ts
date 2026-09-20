import type { DurableSafetyIncident, DurableSafetyIncidentStore } from './safety-durable-runtime.js';

export interface SafetyDeadManLease {
  readonly incidentId: string;
  readonly leaseId: string;
  readonly leasedUntil: string;
}

export interface SafetyDeadManLeaseStore {
  claimDue(now: string, leaseSeconds: number, limit: number): Promise<readonly SafetyDeadManLease[]>;
  complete(lease: SafetyDeadManLease, next: DurableSafetyIncident): Promise<'completed' | 'stale'>;
}

export interface SafetyDeadManWorker {
  evaluate(incident: DurableSafetyIncident): Promise<DurableSafetyIncident>;
}

export async function runDeadManServiceTick(
  now: string,
  leases: SafetyDeadManLeaseStore,
  incidents: DurableSafetyIncidentStore,
  worker: SafetyDeadManWorker,
): Promise<readonly string[]> {
  const claimed = await leases.claimDue(now, 120, 50);
  const completed: string[] = [];
  for (const lease of claimed) {
    const incident = await incidents.load(lease.incidentId);
    if (!incident) continue;
    const next = await worker.evaluate(incident);
    if (await leases.complete(lease, next) === 'completed') completed.push(lease.incidentId);
  }
  return completed;
}
