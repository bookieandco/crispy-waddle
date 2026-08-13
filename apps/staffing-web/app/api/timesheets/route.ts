import { NextResponse } from "next/server";
import { TimesheetService } from "../../../../../packages/staffing-core/src/timesheets.js";
import { PostgresTimesheetStore } from "../../../../../packages/staffing-core/src/postgres-timesheets.js";
import { createSqlExecutor } from "../../../lib/postgres.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.organizationId || !body.placementId || !body.workerId || !body.periodStart || !body.periodEnd) return NextResponse.json({ error: "organizationId, placementId, workerId, periodStart and periodEnd are required" }, { status: 400 });
    const client = (globalThis as typeof globalThis & { STAFFING_SQL?: Parameters<typeof createSqlExecutor>[0] }).STAFFING_SQL;
    if (!client) return NextResponse.json({ error: "Staffing database adapter is not configured" }, { status: 503 });
    const service = new TimesheetService(
      new PostgresTimesheetStore(createSqlExecutor(client)),
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    const timesheet = await service.create({ organizationId: body.organizationId, placementId: body.placementId, workerId: body.workerId, periodStart: body.periodStart, periodEnd: body.periodEnd, regularHours: Number(body.regularHours ?? 0), overtimeHours: Number(body.overtimeHours ?? 0) });
    return NextResponse.json({ timesheet }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create timesheet" }, { status: 500 }); }
}
