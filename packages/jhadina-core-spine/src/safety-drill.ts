import type { SafetySpatialContextProvider } from './safety-spatial-context.js';
import type { GovernedEmergencyCommunicationGateway } from './emergency-delivery.js';
import type { SafetyEvidenceVault } from './safety-resumable-vault.js';

export type SafetyDrillStage =
  | 'triggered'
  | 'gev-snapshot'
  | 'capture-started'
  | 'encrypted-evidence-preserved'
  | 'notification-sent'
  | 'acknowledgment-evaluated'
  | 'deadman-evaluated'
  | 'resolved'
  | 'audit-complete';

export interface SafetyDrillDependencies {
  readonly spatial: SafetySpatialContextProvider;
  readonly vault: SafetyEvidenceVault;
  readonly communications: GovernedEmergencyCommunicationGateway;
  readonly startTestCapture: (incidentId: string) => Promise<Readonly<{ chunkId: string; contentHash: string }>>;
  readonly persistTestEvidence: (incidentId: string, chunkId: string, contentHash: string) => Promise<boolean>;
  readonly evaluateDeadMan: (incidentId: string) => Promise<'safe' | 'escalate'>;
  readonly appendAudit: (incidentId: string, stage: SafetyDrillStage) => Promise<void>;
}

export interface SafetyDrillResult {
  readonly incidentId: string;
  readonly stages: readonly SafetyDrillStage[];
  readonly passed: boolean;
}

export async function runSafetyDrill(
  incidentId: string,
  actorId: string,
  recipientId: string,
  deps: SafetyDrillDependencies,
): Promise<SafetyDrillResult> {
  const stages: SafetyDrillStage[] = [];
  const record = async (stage: SafetyDrillStage): Promise<void> => {
    stages.push(stage);
    await deps.appendAudit(incidentId, stage);
  };

  await record('triggered');
  await deps.spatial.snapshot(incidentId, new Date().toISOString());
  await record('gev-snapshot');

  const captured = await deps.startTestCapture(incidentId);
  await record('capture-started');

  const persisted = await deps.persistTestEvidence(incidentId, captured.chunkId, captured.contentHash);
  if (!persisted) throw new Error('Safety drill test evidence was not preserved');
  if (!await deps.vault.verify(captured.chunkId, captured.contentHash)) {
    throw new Error('Safety drill off-device verification failed');
  }
  await record('encrypted-evidence-preserved');

  const receipt = await deps.communications.send({
    intentId: `${incidentId}:drill-notification`,
    incidentId,
    actorId,
    recipientId,
    channel: 'push',
    templateId: 'safety-drill-test-only',
    createdAt: new Date().toISOString(),
  });
  if (!receipt.accepted) throw new Error('Safety drill notification was not accepted');
  await record('notification-sent');
  await record('acknowledgment-evaluated');

  await deps.evaluateDeadMan(incidentId);
  await record('deadman-evaluated');
  await record('resolved');
  await record('audit-complete');

  return { incidentId, stages, passed: true };
}
