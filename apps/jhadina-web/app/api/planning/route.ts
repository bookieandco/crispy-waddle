import { NextRequest, NextResponse } from "next/server";
import type { PlanningProposal } from "@jhadina/planning-core";
import type { PlanningService } from "@jhadina/planning-core";

/**
 * Application boundary only. Production wiring must inject the authenticated
 * Jhadina PlanningService from the app composition root; this route never
 * bypasses the Planning API, policy gateway, or guarded executor.
 */
export interface PlanningRouteDependencies {
  service: PlanningService;
  authenticate(request: NextRequest): Promise<{ actorId: string } | null>;
}

export function createPlanningRoute(deps: PlanningRouteDependencies) {
  return async function POST(request: NextRequest) {
    const identity = await deps.authenticate(request);
    if (!identity) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
      switch (body.operation) {
        case "create_plan":
          return NextResponse.json(
            await deps.service.createPlan({
              name: String(body.name ?? ""),
              actorId: identity.actorId,
              metadata: (body.metadata as Record<string, unknown> | undefined),
            }),
            { status: 201 },
          );
        case "add_layer":
          return NextResponse.json(await deps.service.addLayer(String(body.planId), body.layer as never, identity.actorId));
        case "add_marker":
          return NextResponse.json(await deps.service.addMarker(String(body.planId), body.marker as never, identity.actorId));
        case "add_route":
          return NextResponse.json(await deps.service.addRoute(String(body.planId), body.route as never, identity.actorId));
        case "add_annotation":
          return NextResponse.json(await deps.service.addAnnotation(String(body.planId), body.annotation as never, identity.actorId));
        case "add_timeline_event":
          return NextResponse.json(await deps.service.addTimelineEvent(String(body.planId), body.event as never, identity.actorId));
        case "create_scenario":
          return NextResponse.json(await deps.service.createScenario(String(body.planId), body.input as never, identity.actorId));
        case "propose":
          return NextResponse.json(await deps.service.propose(
            String(body.planId),
            body.input as Omit<PlanningProposal, "id" | "planId" | "requestedAt" | "requestedBy">,
            identity.actorId,
          ), { status: 201 });
        case "execute":
          return NextResponse.json({ executionId: await deps.service.execute(body.proposal as PlanningProposal, identity.actorId) });
        default:
          return NextResponse.json({ error: "Unsupported planning operation" }, { status: 400 });
      }
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Planning operation failed" },
        { status: 400 },
      );
    }
  };
}
