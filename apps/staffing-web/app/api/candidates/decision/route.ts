import { NextResponse } from "next/server";
import { getCandidateReviewService } from "@/lib/staffing/candidate-review";

const decisions = new Set(["ADVANCE", "REFER", "HOLD", "REJECT"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.organizationId || !body.applicationId || !body.reviewerId || !decisions.has(body.decision)) {
      return NextResponse.json({ error: "organizationId, applicationId, reviewerId and a valid decision are required" }, { status: 400 });
    }
    const review = await getCandidateReviewService().decide({
      organizationId: body.organizationId,
      applicationId: body.applicationId,
      reviewerId: body.reviewerId,
      decision: body.decision,
      note: typeof body.note === "string" ? body.note : undefined,
    });
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record candidate decision" }, { status: 500 });
  }
}
