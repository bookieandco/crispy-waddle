import { NextResponse } from "next/server";
import { getCommunicationService } from "@/lib/staffing/communication";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.organizationId || !body.createdBy || !Array.isArray(body.participantIds) || body.participantIds.length === 0) {
      return NextResponse.json({ error: "organizationId, createdBy, and participantIds are required" }, { status: 400 });
    }
    const conversation = await getCommunicationService().createConversation({
      organizationId: body.organizationId,
      createdBy: body.createdBy,
      subject: typeof body.subject === "string" ? body.subject : undefined,
      participantIds: body.participantIds,
    });
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create conversation" }, { status: 500 });
  }
}
