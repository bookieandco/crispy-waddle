import { NextResponse } from "next/server";
import { CommunicationService } from "../../../../../packages/staffing-core/src/communication.js";
import { createSqlExecutor } from "../../../lib/postgres.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.organizationId || !body.createdBy || !Array.isArray(body.participantIds) || body.participantIds.length === 0) {
      return NextResponse.json({ error: "organizationId, createdBy, and participantIds are required" }, { status: 400 });
    }
    const client = (globalThis as typeof globalThis & { STAFFING_SQL?: Parameters<typeof createSqlExecutor>[0] }).STAFFING_SQL;
    if (!client) return NextResponse.json({ error: "Staffing database adapter is not configured" }, { status: 503 });
    const service = new CommunicationService(
      createSqlExecutor(client),
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    const conversation = await service.createConversation({
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
