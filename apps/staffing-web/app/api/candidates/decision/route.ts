import { NextResponse } from "next/server";
import { CandidateReviewService } from "../../../../../../packages/staffing-core/src/candidate-review.js";
import { assertSessionActor, requireStaffingContext, staffingErrorResponse } from "../../../../lib/request-context.js";

export const runtime = "nodejs";

const decisions = new Set(["ADVANCE", "REFER", "HOLD", "REJECT"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.applicationId || !decisions.has(body.decision)) {
      return NextResponse.json({ error: "applicationId and a valid decision are required" }, { status: 400 });
    }
    const context = await requireStaffingContext(request, body.organizationId);
    assertSessionActor(body.reviewerId, context.userId, "reviewerId");

    const service = new CandidateReviewService(
      context.db,
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    const review = await service.decide({
      organizationId: context.organizationId,
      applicationId: body.applicationId,
      reviewerId: context.userId,
      decision: body.decision,
      note: typeof body.note === "string" ? body.note : undefined,
    });
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    return staffingErrorResponse(error, "Unable to record candidate decision");
  }
}
