import { NextResponse } from "next/server";
import { CommunicationService } from "../../../../../packages/staffing-core/src/communication.js";
import {
  assertSessionActor,
  requireActiveOrganizationUsers,
  requireStaffingContext,
  staffingErrorResponse,
} from "../../../lib/request-context.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!Array.isArray(body.participantIds) || body.participantIds.length === 0) {
      return NextResponse.json({ error: "participantIds are required" }, { status: 400 });
    }
    const context = await requireStaffingContext(request, body.organizationId);
    assertSessionActor(body.createdBy, context.userId, "createdBy");

    const participantIds = Array.from(new Set([context.userId, ...body.participantIds.map(String)]));
    await requireActiveOrganizationUsers(context.db, context.organizationId, participantIds);

    const service = new CommunicationService(
      context.db,
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    const conversation = await service.createConversation({
      organizationId: context.organizationId,
      createdBy: context.userId,
      subject: typeof body.subject === "string" ? body.subject : undefined,
      participantIds,
    });
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    return staffingErrorResponse(error, "Unable to create conversation");
  }
}
