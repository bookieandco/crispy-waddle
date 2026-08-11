import { NextResponse } from "next/server";
import { getTimesheetService } from "@/lib/staffing/timesheets";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.organizationId || !body.placementId || !body.workerId || !body.periodStart || !body.periodEnd) return NextResponse.json({ error: "organizationId, placementId, workerId, periodStart and periodEnd are required" }, { status: 400 });
    const timesheet = await getTimesheetService().create({ organizationId: body.organizationId, placementId: body.placementId, workerId: body.workerId, periodStart: body.periodStart, periodEnd: body.periodEnd, regularHours: Number(body.regularHours ?? 0), overtimeHours: Number(body.overtimeHours ?? 0) });
    return NextResponse.json({ timesheet }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create timesheet" }, { status: 500 }); }
}
