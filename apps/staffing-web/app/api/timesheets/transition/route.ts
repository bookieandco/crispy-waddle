import { NextResponse } from "next/server";
import { TransactionalTimesheetWorkflow } from "../../../../../../packages/staffing-core/src/timesheet-workflow.js";
import { assertSessionActor, requireStaffingContext, staffingErrorResponse } from "../../../../lib/request-context.js";

export const runtime = "nodejs";

const statuses = new Set(["SUBMITTED", "APPROVED", "REJECTED"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.timesheetId || !statuses.has(body.status)) {
      return NextResponse.json({ error: "timesheetId and a valid status are required" }, { status: 400 });
    }
    const context = await requireStaffingContext(request, body.organizationId);
    assertSessionActor(body.actorId, context.userId, "actorId");

    const workflow = new TransactionalTimesheetWorkflow(
      context.db,
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    const timesheet = await workflow.transition(
      body.timesheetId,
      context.organizationId,
      body.status,
      typeof body.note === "string" ? body.note : "",
    );
    return NextResponse.json({ timesheet });
  } catch (error) {
    return staffingErrorResponse(error, "Unable to transition timesheet");
  }
}
