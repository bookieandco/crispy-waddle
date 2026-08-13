import { NextResponse } from "next/server";
import { CandidateReviewService } from "../../../../../../packages/staffing-core/src/candidate-review.js";
import { createSqlExecutor } from "../../../../lib/postgres.js";

export const runtime = "nodejs";

const decisions = new Set(["ADVANCE", "REFER", "HOLD", "REJECT"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.organizationId || !body.applicationId || !body.reviewerId || !decisions.has(body.decision)) {
      return NextResponse.json({ error: "organizationId, applicationId, reviewerId and a valid decision are required" }, { status: 400 });
    }
    const client = (globalThis as typeof globalThis & { STAFFING_SQL?: Parameters<typeof createSqlExecutor>[0] }).STAFFING_SQL;
    if (!client) return NextResponse.json({ error: "Staffing database adapter is not configured" }, { status: 503 });

    const service = new CandidateReviewService(
      createSqlExecutor(client),
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    const review = await service.decide({
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
