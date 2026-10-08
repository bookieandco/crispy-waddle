import { NextResponse } from "next/server";
import { EmployerInterviewService } from "../../../../../../packages/staffing-core/src/employer-interview.js";
import { assertSessionActor, requireStaffingContext, staffingErrorResponse } from "../../../../lib/request-context.js";

export const runtime = "nodejs";

const decisions = new Set(["INTERVIEW", "HOLD", "DECLINE"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.applicationId || !decisions.has(body.decision)) {
      return NextResponse.json({ error: "applicationId and a valid decision are required" }, { status: 400 });
    }
    const context = await requireStaffingContext(request, body.organizationId);
    assertSessionActor(body.employerUserId, context.userId, "employerUserId");

    const service = new EmployerInterviewService(
      context.db,
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    const result = await service.decide({
      organizationId: context.organizationId,
      applicationId: body.applicationId,
      employerUserId: context.userId,
      decision: body.decision,
      note: typeof body.note === "string" ? body.note : undefined,
    });
    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    return staffingErrorResponse(error, "Unable to record employer decision");
  }
}
