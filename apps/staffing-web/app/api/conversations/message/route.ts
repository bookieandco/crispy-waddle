import { NextResponse } from "next/server";
import { getCommunicationService } from "@/lib/staffing/communication";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.organizationId || !body.conversationId || !body.senderId || typeof body.body !== "string" || !body.body.trim()) {
      return NextResponse.json({ error: "organizationId, conversationId, senderId, and body are required" }, { status: 400 });
    }
    const message = await getCommunicationService().sendMessage({
      organizationId: body.organizationId,
      conversationId: body.conversationId,
      senderId: body.senderId,
      body: body.body,
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send message" }, { status: 500 });
  }
}
