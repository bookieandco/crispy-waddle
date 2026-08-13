import { NextResponse } from "next/server";
import { EmployerInterviewService } from "../../../../../../packages/staffing-core/src/employer-interview.js";
import { createSqlExecutor } from "../../../../lib/postgres.js";

export const runtime = "nodejs";

const decisions = new Set(["INTERVIEW", "HOLD", "DECLINE"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.organizationId || !body.applicationId || !body.employerUserId || !decisions.has(body.decision)) {
      return NextResponse.json({ error: "organizationId, applicationId, employerUserId and a valid decision are required" }, { status: 400 });
    }
    const client = (globalThis as typeof globalThis & { STAFFING_SQL?: Parameters<typeof createSqlExecutor>[0] }).STAFFING_SQL;
    if (!client) return NextResponse.json({ error: "Staffing database adapter is not configured" }, { status: 503 });

    const service = new EmployerInterviewService(
      createSqlExecutor(client),
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    const result = await service.decide({
      organizationId: body.organizationId,
      applicationId: body.applicationId,
      employerUserId: body.employerUserId,
      decision: body.decision,
      note: typeof body.note === "string" ? body.note : undefined,
    });
    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record employer decision" }, { status: 500 });
  }
}
