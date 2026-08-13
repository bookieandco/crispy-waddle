import type { ID, PlanningProposal } from "./index";
import { PlanningPolicyGateway } from "./policy-gateway";
import type { PlanningEventBus } from "./events";
import { planningEventId } from "./supabase-event-bus";

export interface PlanningActionExecutor {
  execute(request: {
    proposalId: ID;
    actionType: string;
    payload: Record<string, unknown>;
    actorId: ID;
  }): Promise<{ executionId: ID }>;
}

export class GuardedPlanningExecutor {
  constructor(
    private readonly policy: PlanningPolicyGateway,
    private readonly executor: PlanningActionExecutor,
    private readonly events: PlanningEventBus,
  ) {}

  async execute(proposal: PlanningProposal, actorId: ID): Promise<ID> {
    const decision = await this.policy.evaluate(proposal, actorId);

    if (!decision.allowed) {
      throw new Error(`Planning proposal denied: ${decision.reason}`);
    }

    const result = await this.executor.execute({
      proposalId: proposal.id,
      actionType: proposal.actionType,
      payload: proposal.payload,
      actorId,
    });

    await this.events.publish({
      id: planningEventId("planning:action-executed", proposal.id),
      type: "ACTION_EXECUTED",
      planId: proposal.planId,
      occurredAt: new Date().toISOString(),
      actorId,
      payload: {
        proposalId: proposal.id,
        executionId: result.executionId,
        actionType: proposal.actionType,
      },
    });

    return result.executionId;
  }
}
