import { NextResponse } from "next/server";
import { TimesheetService } from "../../../../../packages/staffing-core/src/timesheets.js";
import { PostgresTimesheetStore } from "../../../../../packages/staffing-core/src/postgres-timesheets.js";
import { assertSessionActor, requireStaffingContext, staffingErrorResponse } from "../../../lib/request-context.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.placementId || !body.periodStart || !body.periodEnd) {
      return NextResponse.json({ error: "placementId, periodStart and periodEnd are required" }, { status: 400 });
    }
    const context = await requireStaffingContext(request, body.organizationId);
    assertSessionActor(body.workerId, context.userId, "workerId");

    const service = new TimesheetService(
      new PostgresTimesheetStore(context.db),
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    const timesheet = await service.create({
      organizationId: context.organizationId,
      placementId: body.placementId,
      workerId: context.userId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      regularHours: Number(body.regularHours ?? 0),
      overtimeHours: Number(body.overtimeHours ?? 0),
    });
    return NextResponse.json({ timesheet }, { status: 201 });
  } catch (error) {
    return staffingErrorResponse(error, "Unable to create timesheet");
  }
}
