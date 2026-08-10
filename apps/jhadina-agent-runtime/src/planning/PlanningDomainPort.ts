export interface PlanningTimelineEventInput {
  date: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface PlanningTimelineEvent {
  id: string;
  date: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface PlanningScenarioChange {
  scenarioId: string;
  changes: Record<string, unknown>;
}

export interface PlanningProposal {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  status: "proposed" | "approved" | "rejected";
}

/** Stable domain boundary between Jhadina governance and Planning Core. */
export interface PlanningDomainPort {
  createTimelineEvent(input: PlanningTimelineEventInput): Promise<PlanningTimelineEvent>;
  changeScenario(input: PlanningScenarioChange): Promise<unknown>;
  createProposal(input: { kind: string; payload: Record<string, unknown> }): Promise<PlanningProposal>;
  applyApprovedProposal(proposalId: string): Promise<unknown>;
}
