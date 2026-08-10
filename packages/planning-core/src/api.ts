import type { ID, Layer, Marker, PlanningProposal, Route, SpatialAnnotation, TimelineEvent } from "./index";
import type { CreatePlanInput, JhadinaPlanningService, ScenarioChange } from "./planning-service";

export type PlanningCommand =
  | { type: "create_plan"; input: CreatePlanInput }
  | { type: "add_layer"; planId: ID; layer: Layer; actorId: ID }
  | { type: "add_marker"; planId: ID; marker: Marker; actorId: ID }
  | { type: "add_route"; planId: ID; route: Route; actorId: ID }
  | { type: "add_annotation"; planId: ID; annotation: SpatialAnnotation; actorId: ID }
  | { type: "add_timeline_event"; planId: ID; event: TimelineEvent; actorId: ID }
  | { type: "create_scenario"; planId: ID; input: ScenarioChange; actorId: ID }
  | { type: "propose"; planId: ID; input: Omit<PlanningProposal, "id" | "planId" | "requestedAt" | "requestedBy">; actorId: ID };

export class JhadinaPlanningApi {
  constructor(private readonly service: JhadinaPlanningService) {}

  async command(command: PlanningCommand): Promise<unknown> {
    switch (command.type) {
      case "create_plan": return this.service.createPlan(command.input);
      case "add_layer": return this.service.addLayer(command.planId, command.layer, command.actorId);
      case "add_marker": return this.service.addMarker(command.planId, command.marker, command.actorId);
      case "add_route": return this.service.addRoute(command.planId, command.route, command.actorId);
      case "add_annotation": return this.service.addAnnotation(command.planId, command.annotation, command.actorId);
      case "add_timeline_event": return this.service.addTimelineEvent(command.planId, command.event, command.actorId);
      case "create_scenario": return this.service.createScenario(command.planId, command.input, command.actorId);
      case "propose": return this.service.propose(command.planId, command.input, command.actorId);
      default: return assertNever(command);
    }
  }

  async execute(proposal: PlanningProposal, actorId: ID): Promise<ID> {
    return this.service.execute(proposal, actorId);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported planning command: ${String(value)}`);
}
