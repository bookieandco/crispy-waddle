import type { ID, PlanningPolicyBoundary, PlanningProposal } from "./index";
import { policyOutcomeEvent, type PlanningEventBus } from "./events";
import { planningEventId } from "./supabase-event-bus";

export interface PlanningPolicyGatewayResult {
  allowed: boolean;
  reason: string;
}

export class PlanningPolicyGateway {
  constructor(
    private readonly policy: PlanningPolicyBoundary,
    private readonly events: PlanningEventBus,
  ) {}

  async evaluate(
    proposal: PlanningProposal,
    actorId: ID,
  ): Promise<PlanningPolicyGatewayResult> {
    const result = await this.policy.evaluate(proposal);

    await this.events.publish(
      policyOutcomeEvent(
        proposal,
        actorId,
        result.allowed,
        result.reason,
        planningEventId(
          result.allowed ? "planning:policy-allowed" : "planning:policy-denied",
          proposal.id,
        ),
      ),
    );

    return result;
  }
}
