import { createHash } from 'node:crypto'
import type { ConnectorExecutionRecord, ConnectorOperation, ConnectorRequest } from './index.js'

/** A recovery decision is evidence-driven; an LLM or caller cannot assert execution state. */
export type ConnectorReconciliationStatus =
  | 'unknown'
  | 'confirmed_executed'
  | 'confirmed_not_executed'
  | 'indeterminate'

export interface ConnectorReconciliationEvidence {
  readonly executionId: string
  readonly proposalHash: string
  readonly idempotencyKey: string
  readonly connectorId: string
  readonly operation: string
  readonly status: ConnectorReconciliationStatus
  readonly providerReference?: string
  readonly providerState?: string
  readonly observedAt: string
  readonly checkedAt: string
  readonly adapterVersion: number
  readonly source: string
  readonly evidenceHash: string
}

export interface ConnectorReconciliationResult {
  readonly status: ConnectorReconciliationStatus
  readonly evidence: ConnectorReconciliationEvidence
}

export interface ConnectorReconciliationStore {
  get(executionId: string): Promise<ConnectorReconciliationEvidence | undefined>
  record(evidence: ConnectorReconciliationEvidence): Promise<boolean>
}

/** Optional provider capability for recovering an interrupted external execution. */
export interface ConnectorReconciler {
  reconcile<TInput>(
    operation: ConnectorOperation,
    request: ConnectorRequest<TInput>,
    execution: ConnectorExecutionRecord,
  ): Promise<ConnectorReconciliationResult>
}

export type RecoveryResolution = 'retry_allowed' | 'already_executed' | 'blocked'

export function resolveRecovery(status: ConnectorReconciliationStatus): RecoveryResolution {
  switch (status) {
    case 'confirmed_not_executed': return 'retry_allowed'
    case 'confirmed_executed': return 'already_executed'
    case 'unknown':
    case 'indeterminate': return 'blocked'
  }
}

/** Deterministic payload used by persistence/audit layers when hashing evidence. */
export function reconciliationEvidencePayload(
  evidence: Omit<ConnectorReconciliationEvidence, 'evidenceHash'>,
): string {
  return JSON.stringify({
    executionId: evidence.executionId,
    proposalHash: evidence.proposalHash,
    idempotencyKey: evidence.idempotencyKey,
    connectorId: evidence.connectorId,
    operation: evidence.operation,
    status: evidence.status,
    providerReference: evidence.providerReference ?? null,
    providerState: evidence.providerState ?? null,
    observedAt: evidence.observedAt,
    checkedAt: evidence.checkedAt,
    adapterVersion: evidence.adapterVersion,
    source: evidence.source,
  })
}

/** Computes the tamper-evident SHA-256 identity of reconciliation evidence. */
export function hashReconciliationEvidence(
  evidence: Omit<ConnectorReconciliationEvidence, 'evidenceHash'>,
): string {
  return createHash('sha256').update(reconciliationEvidencePayload(evidence)).digest('hex')
}

/** Verifies the evidence hash before any recovery decision is trusted. */
export function verifyReconciliationEvidenceHash(
  evidence: ConnectorReconciliationEvidence,
): boolean {
  const { evidenceHash: _evidenceHash, ...payload } = evidence
  return hashReconciliationEvidence(payload) === evidence.evidenceHash
}

/** Only an evidence-backed provider result may unlock recovery. */
export function canRetryAfterReconciliation(
  evidence: ConnectorReconciliationEvidence | undefined,
): boolean {
  return evidence?.status === 'confirmed_not_executed'
}

export function blocksProviderRetry(
  evidence: ConnectorReconciliationEvidence | undefined,
): boolean {
  return !canRetryAfterReconciliation(evidence)
}
