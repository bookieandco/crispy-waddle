import { NextResponse } from "next/server";
import { CandidateReferralService } from "../../../../../../packages/staffing-core/src/referral.js";
import { createSqlExecutor } from "../../../../lib/postgres.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.organizationId || !body.applicationId || !body.agencyUserId || !body.employerUserId) return NextResponse.json({ error: "organizationId, applicationId, agencyUserId and employerUserId are required" }, { status: 400 });
    const client = (globalThis as typeof globalThis & { STAFFING_SQL?: Parameters<typeof createSqlExecutor>[0] }).STAFFING_SQL;
    if (!client) return NextResponse.json({ error: "Staffing database adapter is not configured" }, { status: 503 });
    const service = new CandidateReferralService(
      createSqlExecutor(client),
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    const referral = await service.refer({ organizationId: body.organizationId, applicationId: body.applicationId, agencyUserId: body.agencyUserId, employerUserId: body.employerUserId, subject: typeof body.subject === "string" ? body.subject : undefined, message: typeof body.message === "string" ? body.message : undefined });
    return NextResponse.json({ referral }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to refer candidate" }, { status: 500 }); }
}
