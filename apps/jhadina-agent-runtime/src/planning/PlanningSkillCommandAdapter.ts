import type { GovernedSkillCommand } from "../governance/GovernedSkillCommand";
import type {
  PlanningDomainPort,
  PlanningProposal,
  PlanningTimelineEvent,
  PlanningTimelineEventInput,
} from "./PlanningDomainPort";

export class PlanningSkillCommandAdapter {
  constructor(private readonly planning: PlanningDomainPort) {}

  async execute(command: GovernedSkillCommand): Promise<unknown> {
    if (command.domain !== "planning") {
      throw new Error(`Unsupported planning command domain: ${command.domain}`);
    }

    switch (command.actionType) {
      case "timeline.event.create":
        return this.planning.createTimelineEvent(
          this.requirePayload<PlanningTimelineEventInput>(command),
        );

      case "scenario.change":
        return this.planning.changeScenario(
          this.requirePayload<{ scenarioId: string; changes: Record<string, unknown> }>(command),
        );

      case "proposal.create":
        return this.planning.createProposal(
          this.requirePayload<{ kind: string; payload: Record<string, unknown> }>(command),
        );

      case "proposal.apply":
        return this.planning.applyApprovedProposal(
          this.requirePayload<{ proposalId: string }>(command).proposalId,
        );

      default:
        throw new Error(`Unsupported planning action: ${command.actionType}`);
    }
  }

  private requirePayload<T>(command: GovernedSkillCommand): T {
    if (!command.payload || typeof command.payload !== "object") {
      throw new Error(`Invalid payload for planning action: ${command.actionType}`);
    }
    return command.payload as T;
  }
}

export type PlanningAdapterResult =
  | PlanningTimelineEvent
  | PlanningProposal
  | unknown;
