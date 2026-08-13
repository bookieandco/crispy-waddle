import { NextResponse } from "next/server";
import { TransactionalTimesheetWorkflow } from "../../../../../../packages/staffing-core/src/timesheet-workflow.js";
import { createSqlExecutor } from "../../../../lib/postgres.js";

export const runtime = "nodejs";

const statuses = new Set(["SUBMITTED", "APPROVED", "REJECTED"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.organizationId || !body.timesheetId || !body.actorId || !statuses.has(body.status)) return NextResponse.json({ error: "organizationId, timesheetId, actorId and a valid status are required" }, { status: 400 });
    const client = (globalThis as typeof globalThis & { STAFFING_SQL?: Parameters<typeof createSqlExecutor>[0] }).STAFFING_SQL;
    if (!client) return NextResponse.json({ error: "Staffing database adapter is not configured" }, { status: 503 });
    const workflow = new TransactionalTimesheetWorkflow(
      createSqlExecutor(client),
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    // actorId is validated above but not yet persisted on the transition -
    // the underlying staffing_timesheets table has no actor column.
    const timesheet = await workflow.transition(body.timesheetId, body.organizationId, body.status);
    return NextResponse.json({ timesheet });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to transition timesheet" }, { status: 500 }); }
}
