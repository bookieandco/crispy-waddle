import { NextResponse } from "next/server";
import { CommunicationService } from "../../../../../../packages/staffing-core/src/communication.js";
import { assertSessionActor, requireStaffingContext, staffingErrorResponse } from "../../../../lib/request-context.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.conversationId || typeof body.body !== "string" || !body.body.trim()) {
      return NextResponse.json({ error: "conversationId and body are required" }, { status: 400 });
    }
    const context = await requireStaffingContext(request, body.organizationId);
    assertSessionActor(body.senderId, context.userId, "senderId");

    const service = new CommunicationService(
      context.db,
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    const message = await service.sendMessage({
      organizationId: context.organizationId,
      conversationId: body.conversationId,
      senderId: context.userId,
      body: body.body,
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return staffingErrorResponse(error, "Unable to send message");
  }
}
