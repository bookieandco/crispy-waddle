import type {
  ID,
  Layer,
  Marker,
  PlanningPlan,
  PlanningProposal,
  PlanningRegistry,
  Route,
  Scenario,
  SpatialAnnotation,
  TimelineEvent,
} from "./index";
import { type PlanningEventBus } from "./events";
import { PlanningPolicyGateway } from "./policy-gateway";
import { GuardedPlanningExecutor } from "./executor-adapter";

export interface PlanningIdFactory {
  next(prefix: string): ID;
}

export interface CreatePlanInput {
  name: string;
  actorId: ID;
  metadata?: Record<string, unknown>;
}

export interface ScenarioChange {
  name: string;
  changes: Record<string, unknown>;
  status?: Scenario["status"];
}

export interface PlanningService {
  createPlan(input: CreatePlanInput): Promise<PlanningPlan>;
  addLayer(planId: ID, layer: Layer, actorId: ID): Promise<PlanningPlan>;
  addMarker(planId: ID, marker: Marker, actorId: ID): Promise<PlanningPlan>;
  addRoute(planId: ID, route: Route, actorId: ID): Promise<PlanningPlan>;
  addAnnotation(planId: ID, annotation: SpatialAnnotation, actorId: ID): Promise<PlanningPlan>;
  addTimelineEvent(planId: ID, event: TimelineEvent, actorId: ID): Promise<PlanningPlan>;
  createScenario(planId: ID, input: ScenarioChange, actorId: ID): Promise<Scenario>;
  propose(planId: ID, input: Omit<PlanningProposal, "id" | "planId" | "requestedAt" | "requestedBy">, actorId: ID): Promise<PlanningProposal>;
  execute(proposal: PlanningProposal, actorId: ID): Promise<ID>;
}

export class JhadinaPlanningService implements PlanningService {
  constructor(
    private readonly registry: PlanningRegistry,
    private readonly events: PlanningEventBus,
    private readonly policy: PlanningPolicyGateway,
    private readonly executor: GuardedPlanningExecutor,
    private readonly ids: PlanningIdFactory,
  ) {}

  async createPlan(input: CreatePlanInput): Promise<PlanningPlan> {
    const plan: PlanningPlan = {
      id: this.ids.next("plan"), name: input.name, version: 1,
      layers: [], markers: [], routes: [], annotations: [], measurements: [], scenarios: [], timeline: [],
      metadata: input.metadata,
    };
    await this.registry.savePlan(plan);
    return plan;
  }

  async addLayer(planId: ID, layer: Layer, actorId: ID): Promise<PlanningPlan> {
    return this.mutate(planId, actorId, "LAYER_CHANGED", (plan) => ({ ...plan, layers: [...plan.layers, layer] }));
  }
  async addMarker(planId: ID, marker: Marker, actorId: ID): Promise<PlanningPlan> {
    return this.mutate(planId, actorId, "MARKER_ADDED", (plan) => ({ ...plan, markers: [...plan.markers, marker] }));
  }
  async addRoute(planId: ID, route: Route, actorId: ID): Promise<PlanningPlan> {
    return this.mutate(planId, actorId, "ROUTE_CHANGED", (plan) => ({ ...plan, routes: [...plan.routes, route] }));
  }
  async addAnnotation(planId: ID, annotation: SpatialAnnotation, actorId: ID): Promise<PlanningPlan> {
    return this.mutate(planId, actorId, "LAYER_CHANGED", (plan) => ({ ...plan, annotations: [...plan.annotations, annotation] }));
  }
  async addTimelineEvent(planId: ID, event: TimelineEvent, actorId: ID): Promise<PlanningPlan> {
    return this.mutate(planId, actorId, "TIMELINE_EVENT_CREATED", (plan) => ({ ...plan, timeline: [...plan.timeline, event] }));
  }

  async createScenario(planId: ID, input: ScenarioChange, actorId: ID): Promise<Scenario> {
    const plan = await this.requirePlan(planId);
    const scenario: Scenario = { id: this.ids.next("scenario"), name: input.name, basePlanId: planId, changes: input.changes, status: input.status ?? "draft" };
    await this.registry.savePlan({ ...plan, version: plan.version + 1, scenarios: [...plan.scenarios, scenario] });
    await this.events.publish({ id: this.ids.next("event"), type: "SCENARIO_CREATED", planId, occurredAt: new Date().toISOString(), actorId, payload: scenario });
    return scenario;
  }

  async propose(planId: ID, input: Omit<PlanningProposal, "id" | "planId" | "requestedAt" | "requestedBy">, actorId: ID): Promise<PlanningProposal> {
    await this.requirePlan(planId);
    const proposal: PlanningProposal = { ...input, id: this.ids.next("proposal"), planId, requestedAt: new Date().toISOString(), requestedBy: actorId };
    await this.registry.createProposal(proposal);
    await this.policy.evaluate(proposal, actorId);
    return proposal;
  }

  async execute(proposal: PlanningProposal, actorId: ID): Promise<ID> {
    return this.executor.execute(proposal, actorId);
  }

  private async mutate(planId: ID, actorId: ID, eventType: "LAYER_CHANGED" | "MARKER_ADDED" | "ROUTE_CHANGED" | "TIMELINE_EVENT_CREATED", updater: (plan: PlanningPlan) => PlanningPlan): Promise<PlanningPlan> {
    const plan = await this.requirePlan(planId);
    const updated = { ...updater(plan), version: plan.version + 1 };
    await this.registry.savePlan(updated);
    await this.events.publish({ id: this.ids.next("event"), type: eventType, planId, occurredAt: new Date().toISOString(), actorId, payload: updated });
    return updated;
  }

  private async requirePlan(planId: ID): Promise<PlanningPlan> {
    const plan = await this.registry.getPlan(planId);
    if (!plan) throw new Error(`Planning plan not found: ${planId}`);
    return plan;
  }
}
