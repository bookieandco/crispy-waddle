import { NextResponse } from "next/server";
import { getTimesheetService } from "@/lib/staffing/timesheets";

const statuses = new Set(["SUBMITTED", "APPROVED", "REJECTED"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.organizationId || !body.timesheetId || !body.actorId || !statuses.has(body.status)) return NextResponse.json({ error: "organizationId, timesheetId, actorId and a valid status are required" }, { status: 400 });
    const timesheet = await getTimesheetService().transition({ organizationId: body.organizationId, timesheetId: body.timesheetId, actorId: body.actorId, status: body.status });
    return NextResponse.json({ timesheet });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to transition timesheet" }, { status: 500 }); }
}
