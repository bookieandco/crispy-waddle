import { NextResponse } from "next/server";
import { CommunicationService } from "../../../../../../packages/staffing-core/src/communication.js";
import { createSqlExecutor } from "../../../../lib/postgres.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.organizationId || !body.conversationId || !body.senderId || typeof body.body !== "string" || !body.body.trim()) {
      return NextResponse.json({ error: "organizationId, conversationId, senderId, and body are required" }, { status: 400 });
    }
    const client = (globalThis as typeof globalThis & { STAFFING_SQL?: Parameters<typeof createSqlExecutor>[0] }).STAFFING_SQL;
    if (!client) return NextResponse.json({ error: "Staffing database adapter is not configured" }, { status: 503 });
    const service = new CommunicationService(
      createSqlExecutor(client),
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    const message = await service.sendMessage({
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
