import type { AuditReceipt, AuditSink, PolicyDecision, PolicyEngine } from './action-governance.js'
import type { AuthoritativeActionProposal } from './governed-action.js'
import type { ConnectorGateway, ConnectorResponse } from './index.js'

export interface AskPipelineResult<T = unknown> {
  readonly proposal: AuthoritativeActionProposal
  readonly decision: PolicyDecision
  readonly response?: ConnectorResponse<T>
  readonly audit?: AuditReceipt
}

export class AskExecutionPipeline {
  constructor(
    private readonly policy: PolicyEngine,
    private readonly gateway: ConnectorGateway,
    private readonly audit: AuditSink,
  ) {}

  async execute<T>(proposal: AuthoritativeActionProposal, input: { connectorId: string; operation: string; idempotencyKey: string }): Promise<AskPipelineResult<T>> {
    const decision = await this.policy.decide(proposal)

    if (decision.effect !== 'allow') {
      const receipt: AuditReceipt = {
        id: `audit_${proposal.id}`,
        proposalId: proposal.id,
        correlationId: proposal.correlationId,
        actorId: proposal.actor.id,
        capability: proposal.capability,
        target: proposal.target,
        status: decision.effect,
        policy: decision,
        recordedAt: new Date().toISOString(),
      }
      await this.audit.record(receipt)
      return { proposal, decision, audit: receipt }
    }

    const response = await this.gateway.execute<T>({
      proposal,
      connectorId: input.connectorId,
      operation: input.operation,
      idempotencyKey: input.idempotencyKey,
    })

    return { proposal, decision, response }
  }
}
