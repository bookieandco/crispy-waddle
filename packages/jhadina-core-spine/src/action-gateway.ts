import type { ActionRequest, ActionResult, DecisionProposal, PolicyDecision } from './types.js';
import type { ActionPort } from './spine.js';

export interface ActionPlanner {
  prepare(proposal: DecisionProposal, policy: PolicyDecision): Promise<ActionRequest | undefined>;
}

export interface CapabilityExecutor {
  execute(request: ActionRequest): Promise<ActionResult>;
}

/**
 * Generic governed action boundary. Domain adapters provide planning and
 * capability executors; this gateway never bypasses policy and never knows
 * transport details.
 */
export class GovernedActionGateway implements ActionPort {
  constructor(
    private readonly planner: ActionPlanner,
    private readonly executors: ReadonlyMap<string, CapabilityExecutor>,
  ) {}

  async prepare(proposal: DecisionProposal, policy: PolicyDecision): Promise<ActionRequest | undefined> {
    if (!policy.allowed || policy.proposalId !== proposal.id || policy.requiredApproval) {
      return undefined;
    }

    const request = await this.planner.prepare(proposal, policy);
    if (!request || request.proposalId !== proposal.id) {
      return undefined;
    }

    if (!this.executors.has(request.capability)) {
      return undefined;
    }

    return request;
  }

  async execute(request: ActionRequest): Promise<ActionResult> {
    const executor = this.executors.get(request.capability);
    if (!executor) {
      return {
        id: `failed:${request.id}`,
        requestId: request.id,
        success: false,
        error: `no executor registered for capability: ${request.capability}`,
        completedAt: new Date().toISOString(),
      };
    }

    return executor.execute(request);
  }
}
