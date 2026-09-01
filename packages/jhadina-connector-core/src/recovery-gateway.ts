import { hashActionProposal } from './approval.js'
import type { AuthoritativeActionProposal } from './governed-action.js'
import type { ConnectorAdapter, ConnectorExecutionRecord, ConnectorOperation, ConnectorRequest } from './index.js'
import type { ConnectorReconciliationEvidence, ConnectorReconciliationResult, ConnectorReconciliationStore, RecoveryResolution } from './reconciliation.js'
import { hashReconciliationEvidence, resolveRecovery, verifyReconciliationEvidenceHash } from './reconciliation.js'

export interface RecoveryAttemptStore {
  claimRecoveryAttempt(input: {
    originalExecutionId: string
    proposalHash: string
    newExecutionId: string
    newIdempotencyKey: string
    connectorId: string
    operation: string
    actorId: string
    correlationId: string
    approvalId?: string
  }): Promise<boolean>
}

export interface RecoveryAudit {
  record(event: {
    executionId: string
    originalExecutionId: string
    proposalId: string
    correlationId: string
    actorId: string
    connectorId: string
    operation: string
    proposalHash: string
    resolution: RecoveryResolution
    evidence: ConnectorReconciliationEvidence
  }): Promise<void>
}

export interface GovernedRecoveryResult {
  readonly resolution: RecoveryResolution
  readonly evidence: ConnectorReconciliationEvidence
  readonly retryExecutionId?: string
  readonly retryIdempotencyKey?: string
}

/**
 * Recovery is deliberately separate from normal execute(). It can only observe a
 * durable recovery_required execution, obtain provider evidence, and then either
 * block, terminally reconcile, or atomically create a fresh retry execution.
 */
export class ConnectorRecoveryGateway {
  constructor(
    private readonly adapters: { get(id: string): ConnectorAdapter | undefined },
    private readonly reconciliation: ConnectorReconciliationStore,
    private readonly recoveryAttempts: RecoveryAttemptStore,
    private readonly audit: RecoveryAudit,
  ) {}

  async reconcileRecovery(
    proposal: AuthoritativeActionProposal,
    execution: ConnectorExecutionRecord,
  ): Promise<GovernedRecoveryResult> {
    const proposalHash = hashActionProposal(proposal)
    if (execution.state !== 'recovery_required') throw new Error('Only recovery_required executions can be reconciled')
    if (execution.proposalHash !== proposalHash) throw new Error('Recovery proposal hash does not match original execution')
    if (execution.connectorId !== proposal.target) throw new Error('Recovery connector does not match proposal target')
    if (proposal.intent !== `${proposal.target}.${execution.operation}`) throw new Error('Recovery operation does not match proposal intent')
    if (execution.actorId !== proposal.actor.id) throw new Error('Recovery actor does not match original execution')
    if (execution.correlationId !== proposal.correlationId) throw new Error('Recovery correlation does not match original execution')

    const adapter = this.adapters.get(execution.connectorId)
    if (!adapter) throw new Error(`Connector not registered: ${execution.connectorId}`)
    const operation = adapter.manifest.operations.find((candidate) => candidate.name === execution.operation)
    if (!operation) throw new Error(`Operation not registered: ${execution.connectorId}.${execution.operation}`)
    if (operation.capability !== proposal.capability) throw new Error('Recovery capability does not match connector operation')

    const existingEvidence = await this.reconciliation.get(execution.executionId)
    let result: ConnectorReconciliationResult
    if (existingEvidence) {
      validateEvidence(existingEvidence, execution, proposalHash, operation)
      result = { status: existingEvidence.status, evidence: existingEvidence }
    } else {
      if (!adapter.reconcile) throw new Error(`Connector does not support reconciliation: ${execution.connectorId}.${execution.operation}`)
      const request: ConnectorRequest = {
        connectorId: execution.connectorId,
        operation: execution.operation,
        capability: proposal.capability,
        input: proposal.parameters.input,
        idempotencyKey: execution.idempotencyKey,
        correlationId: execution.correlationId,
        actorId: execution.actorId,
        sessionId: proposal.sessionId,
        risk: proposal.risk,
      }
      result = await adapter.reconcile(operation, request, execution)
      validateEvidence(result.evidence, execution, proposalHash, operation)
      await this.reconciliation.record(result.evidence)
    }

    const resolution = resolveRecovery(result.status)
    if (resolution !== 'retry_allowed') {
      await this.audit.record({ executionId: execution.executionId, originalExecutionId: execution.executionId, proposalId: proposal.id, correlationId: proposal.correlationId, actorId: proposal.actor.id, connectorId: execution.connectorId, operation: execution.operation, proposalHash, resolution, evidence: result.evidence })
      return { resolution, evidence: result.evidence }
    }

    const retryExecutionId = `exec_recovery_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
    const retryIdempotencyKey = `recovery_${execution.idempotencyKey}_${retryExecutionId}`
    const claimed = await this.recoveryAttempts.claimRecoveryAttempt({
      originalExecutionId: execution.executionId,
      proposalHash,
      newExecutionId: retryExecutionId,
      newIdempotencyKey: retryIdempotencyKey,
      connectorId: execution.connectorId,
      operation: execution.operation,
      actorId: execution.actorId,
      correlationId: execution.correlationId,
      approvalId: execution.approvalId,
    })
    if (!claimed) throw new Error('Recovery attempt could not be atomically claimed')

    await this.audit.record({ executionId: retryExecutionId, originalExecutionId: execution.executionId, proposalId: proposal.id, correlationId: proposal.correlationId, actorId: proposal.actor.id, connectorId: execution.connectorId, operation: execution.operation, proposalHash, resolution, evidence: result.evidence })
    return { resolution, evidence: result.evidence, retryExecutionId, retryIdempotencyKey }
  }
}

function validateEvidence(
  evidence: ConnectorReconciliationEvidence,
  execution: ConnectorExecutionRecord,
  proposalHash: string,
  operation: ConnectorOperation,
): void {
  if (evidence.executionId !== execution.executionId) throw new Error('Reconciliation evidence execution mismatch')
  if (evidence.proposalHash !== proposalHash || evidence.proposalHash !== execution.proposalHash) throw new Error('Reconciliation evidence proposal mismatch')
  if (evidence.idempotencyKey !== execution.idempotencyKey) throw new Error('Reconciliation evidence idempotency mismatch')
  if (evidence.connectorId !== execution.connectorId) throw new Error('Reconciliation evidence connector binding mismatch')
  if (evidence.operation !== execution.operation || evidence.operation !== operation.name) throw new Error('Reconciliation evidence operation binding mismatch')
  if (evidence.adapterVersion !== operationVersion(operation)) throw new Error('Reconciliation evidence adapter operation version mismatch')
  if (!Number.isInteger(evidence.adapterVersion) || evidence.adapterVersion < 1) throw new Error('Reconciliation evidence adapter version is invalid')
  if (!evidence.source.trim()) throw new Error('Reconciliation evidence source is required')
  if (!Number.isFinite(new Date(evidence.observedAt).getTime()) || !Number.isFinite(new Date(evidence.checkedAt).getTime())) throw new Error('Reconciliation evidence timestamps are invalid')
  if (!verifyReconciliationEvidenceHash(evidence)) throw new Error('Reconciliation evidence hash is invalid')
  if (evidence.status === 'confirmed_executed' && !evidence.providerReference && !evidence.providerState) throw new Error('Confirmed execution requires provider evidence')
}

/** ConnectorOperation is currently versioned by its adapter manifest; keep this isolated for future operation-level versioning. */
function operationVersion(_operation: ConnectorOperation): number {
  return 1
}
