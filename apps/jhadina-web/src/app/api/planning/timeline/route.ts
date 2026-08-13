import { NextRequest, NextResponse } from "next/server";
import type { ID, PlanningTimelineReader } from "@jhadina/planning-core";

export interface PlanningTimelineRouteDependencies {
  reader: PlanningTimelineReader;
  authenticate(request: NextRequest): Promise<{ actorId: ID } | null>;
}

export function createPlanningTimelineRoute(deps: PlanningTimelineRouteDependencies) {
  return async function GET(request: NextRequest) {
    const identity = await deps.authenticate(request);
    if (!identity) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const planId = request.nextUrl.searchParams.get("planId");
    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    try {
      const events = await deps.reader.listTimeline(planId);
      return NextResponse.json({ planId, events });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to load planning timeline" },
        { status: 500 },
      );
    }
  };
}
