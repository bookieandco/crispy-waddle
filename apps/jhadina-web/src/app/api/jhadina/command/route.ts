import { NextRequest, NextResponse } from "next/server"
import { handleJhadinaCommand } from "@/lib/intelligence/jhadina-command"
import type { JhadinaWorldId } from "@/lib/jhadina/jhadina-world-registry"
import { requireAuthenticatedUserId } from "@/lib/auth/require-authenticated-user"

export const dynamic = "force-dynamic"

/** Phase 1 Step 6 — Ask Jhadina's real, governed entry point. */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const activeTask = typeof body?.activeTask === "string" ? body.activeTask.trim() : ""

  if (!activeTask) return NextResponse.json({ success: false, error: "activeTask is required" }, { status: 400 })

  try {
    const userId = await requireAuthenticatedUserId()
    const result = await handleJhadinaCommand({
      userId,
      activeTask,
      surface: typeof body?.surface === "string" ? (body.surface as JhadinaWorldId) : undefined,
      route: typeof body?.route === "string" ? body.route : undefined,
      activeProject: typeof body?.activeProject === "string" ? body.activeProject : undefined,
    })
    return NextResponse.json({ success: true, data: { proposal: result.proposal, candidate: result.candidate, approvalReceiptId: result.approvalReceiptId, verified: result.verified, verificationReason: result.verificationReason } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Command failed"
    const status = message.includes("identity") || message.includes("session") || message.includes("Authenticated") ? 401 : message.includes("denied by policy") ? 403 : message.includes("Approval required") || message.includes("Invalid approval receipt") ? 409 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
