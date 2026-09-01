import { hashActionProposal } from './approval.js'
import type { AuthoritativeActionProposal } from './governed-action.js'
import type { ConnectorAdapter, ConnectorExecutionRecord, ConnectorOperation, ConnectorRequest } from './index.js'
import type { ConnectorReconciliationEvidence, ConnectorReconciliationResult, ConnectorReconciliationStore, RecoveryResolution } from './reconciliation.js'
import { resolveRecovery } from './reconciliation.js'

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
    if (execution.operation !== proposal.intent.slice(proposal.target.length + 1)) throw new Error('Recovery operation does not match proposal intent')
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
      if (result.evidence.executionId !== execution.executionId) throw new Error('Reconciliation evidence execution mismatch')
      if (result.evidence.proposalHash !== proposalHash) throw new Error('Reconciliation evidence proposal mismatch')
      if (result.evidence.idempotencyKey !== execution.idempotencyKey) throw new Error('Reconciliation evidence idempotency mismatch')
      if (result.evidence.connectorId !== execution.connectorId || result.evidence.operation !== execution.operation) throw new Error('Reconciliation evidence connector binding mismatch')
      await this.reconciliation.record(result.evidence)
    }

    const resolution = resolveRecovery(result.status)
    const auditExecutionId = execution.executionId
    if (resolution !== 'retry_allowed') {
      await this.audit.record({ executionId: auditExecutionId, originalExecutionId: execution.executionId, proposalId: proposal.id, correlationId: proposal.correlationId, actorId: proposal.actor.id, connectorId: execution.connectorId, operation: execution.operation, proposalHash, resolution, evidence: result.evidence })
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
