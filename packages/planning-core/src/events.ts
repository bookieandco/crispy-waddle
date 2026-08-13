import type { ID, PlanningPlan, PlanningProposal } from "./index";

export const PLANNING_EVENT_TYPES = [
  "PLAN_CREATED",
  "PLAN_UPDATED",
  "LAYER_CHANGED",
  "MARKER_ADDED",
  "ROUTE_CHANGED",
  "SCENARIO_CREATED",
  "SCENARIO_UPDATED",
  "TIMELINE_EVENT_CREATED",
  "PLANNING_PROPOSAL_CREATED",
  "POLICY_ALLOWED",
  "POLICY_DENIED",
  "ACTION_EXECUTED",
] as const;

export type PlanningEventType = (typeof PLANNING_EVENT_TYPES)[number];

export interface PlanningEvent<TPayload = Record<string, unknown>> {
  id: ID;
  type: PlanningEventType;
  planId: ID;
  occurredAt: string;
  actorId: ID;
  payload: TPayload;
}

export interface PlanningEventBus {
  publish<TPayload = Record<string, unknown>>(event: PlanningEvent<TPayload>): Promise<void>;
}

export class InMemoryPlanningEventBus implements PlanningEventBus {
  private readonly events: PlanningEvent[] = [];

  async publish<TPayload = Record<string, unknown>>(event: PlanningEvent<TPayload>): Promise<void> {
    this.events.push(structuredClone(event) as PlanningEvent);
  }

  list(): PlanningEvent[] {
    return this.events.map((event) => structuredClone(event));
  }
}

export function planCreatedEvent(
  plan: PlanningPlan,
  actorId: ID,
  eventId: ID,
): PlanningEvent<PlanningPlan> {
  return {
    id: eventId,
    type: "PLAN_CREATED",
    planId: plan.id,
    occurredAt: new Date().toISOString(),
    actorId,
    payload: structuredClone(plan),
  };
}

export function proposalCreatedEvent(
  proposal: PlanningProposal,
  actorId: ID,
  eventId: ID,
): PlanningEvent<PlanningProposal> {
  return {
    id: eventId,
    type: "PLANNING_PROPOSAL_CREATED",
    planId: proposal.planId,
    occurredAt: new Date().toISOString(),
    actorId,
    payload: structuredClone(proposal),
  };
}

export function policyOutcomeEvent(
  proposal: PlanningProposal,
  actorId: ID,
  allowed: boolean,
  reason: string,
  eventId: ID,
): PlanningEvent {
  return {
    id: eventId,
    type: allowed ? "POLICY_ALLOWED" : "POLICY_DENIED",
    planId: proposal.planId,
    occurredAt: new Date().toISOString(),
    actorId,
    payload: {
      proposalId: proposal.id,
      actionType: proposal.actionType,
      reason,
    },
  };
}
