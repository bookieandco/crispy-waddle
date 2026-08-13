import { NextResponse } from "next/server";
import { InterviewOutcomeService } from "../../../../../../packages/staffing-core/src/interview-outcome.js";
import { createSqlExecutor } from "../../../../lib/postgres.js";

export const runtime = "nodejs";

const outcomes = new Set(["PASS", "HOLD", "FAIL"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.organizationId || !body.interviewId || !body.employerUserId || !outcomes.has(body.outcome)) return NextResponse.json({ error: "organizationId, interviewId, employerUserId and a valid outcome are required" }, { status: 400 });
    const client = (globalThis as typeof globalThis & { STAFFING_SQL?: Parameters<typeof createSqlExecutor>[0] }).STAFFING_SQL;
    if (!client) return NextResponse.json({ error: "Staffing database adapter is not configured" }, { status: 503 });
    const service = new InterviewOutcomeService(
      createSqlExecutor(client),
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    const result = await service.record({ organizationId: body.organizationId, interviewId: body.interviewId, employerUserId: body.employerUserId, outcome: body.outcome, note: typeof body.note === "string" ? body.note : undefined });
    return NextResponse.json({ result }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record interview outcome" }, { status: 500 }); }
}
