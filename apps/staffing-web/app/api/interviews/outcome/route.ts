import { NextResponse } from "next/server";
import { InterviewOutcomeService } from "../../../../../../packages/staffing-core/src/interview-outcome.js";
import { assertSessionActor, requireStaffingContext, staffingErrorResponse } from "../../../../lib/request-context.js";

export const runtime = "nodejs";

const outcomes = new Set(["PASS", "HOLD", "FAIL"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.interviewId || !outcomes.has(body.outcome)) {
      return NextResponse.json({ error: "interviewId and a valid outcome are required" }, { status: 400 });
    }
    const context = await requireStaffingContext(request, body.organizationId);
    assertSessionActor(body.employerUserId, context.userId, "employerUserId");

    const service = new InterviewOutcomeService(
      context.db,
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    const result = await service.record({
      organizationId: context.organizationId,
      interviewId: body.interviewId,
      employerUserId: context.userId,
      outcome: body.outcome,
      note: typeof body.note === "string" ? body.note : undefined,
    });
    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    return staffingErrorResponse(error, "Unable to record interview outcome");
  }
}
