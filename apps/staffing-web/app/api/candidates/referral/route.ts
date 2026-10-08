import { NextResponse } from "next/server";
import { CandidateReferralService } from "../../../../../../packages/staffing-core/src/referral.js";
import {
  assertSessionActor,
  requireActiveOrganizationUsers,
  requireStaffingContext,
  staffingErrorResponse,
} from "../../../../lib/request-context.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.applicationId || !body.employerUserId) {
      return NextResponse.json({ error: "applicationId and employerUserId are required" }, { status: 400 });
    }
    const context = await requireStaffingContext(request, body.organizationId);
    assertSessionActor(body.agencyUserId, context.userId, "agencyUserId");
    const employerUserId = String(body.employerUserId);
    await requireActiveOrganizationUsers(
      context.db,
      context.organizationId,
      [context.userId, employerUserId],
    );

    const service = new CandidateReferralService(
      context.db,
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    const referral = await service.refer({
      organizationId: context.organizationId,
      applicationId: body.applicationId,
      agencyUserId: context.userId,
      employerUserId,
      subject: typeof body.subject === "string" ? body.subject : undefined,
      message: typeof body.message === "string" ? body.message : undefined,
    });
    return NextResponse.json({ referral }, { status: 201 });
  } catch (error) {
    return staffingErrorResponse(error, "Unable to refer candidate");
  }
}
