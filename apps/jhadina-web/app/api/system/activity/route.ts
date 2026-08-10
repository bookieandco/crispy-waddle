import { NextResponse } from "next/server"
import { getSharedAgentAuditEvents } from "../../../../src/lib/agents/activity-audit"

export async function GET() {
  const events = getSharedAgentAuditEvents()
  return NextResponse.json({ ok: true, events })
}
