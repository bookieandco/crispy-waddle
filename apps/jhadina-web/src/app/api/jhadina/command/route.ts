import { NextRequest, NextResponse } from "next/server"
import { handleJhadinaCommand } from "@/lib/intelligence/jhadina-command"
import type { JhadinaWorldId } from "@/lib/jhadina/jhadina-world-registry"

export const dynamic = "force-dynamic"

/**
 * Phase 1 Step 6 — Ask Jhadina's real, governed entry point.
 *
 * A thin HTTP adapter, same shape as
 * apps/jhadina-web/src/app/api/growth/drafts/approve/route.ts: reads the
 * claimed identity from a header, reads the command from the body, and
 * calls `handleJhadinaCommand()` (Phase 1 Step 5) with no overrides —
 * meaning this route always uses the real
 * createRequestIdentityVerifier()/createIntelligenceAuditLedger()/
 * createProductionIntelligenceRouter() defaults. Nothing here is a new
 * executor, policy engine, audit ledger, or memory abstraction; the
 * governed lifecycle this route triggers is exactly what Step 5 already
 * tests.
 *
 * The real Supabase-session identity check happens inside
 * createRequestIdentityVerifier() — the header below is only a *claim*,
 * verified against the actual signed-in session server-side, same as
 * every other governed route in this app.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const claimedUserId = req.headers.get("x-jhadina-user-id") || ""
  const activeTask = typeof body?.activeTask === "string" ? body.activeTask.trim() : ""

  if (!claimedUserId) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 })
  }
  if (!activeTask) {
    return NextResponse.json({ success: false, error: "activeTask is required" }, { status: 400 })
  }

  try {
    const result = await handleJhadinaCommand({
      userId: claimedUserId,
      activeTask,
      surface: typeof body?.surface === "string" ? (body.surface as JhadinaWorldId) : undefined,
      route: typeof body?.route === "string" ? body.route : undefined,
      activeProject: typeof body?.activeProject === "string" ? body.activeProject : undefined,
    })

    return NextResponse.json({
      success: true,
      data: {
        proposal: result.proposal,
        candidate: result.candidate,
        approvalReceiptId: result.approvalReceiptId,
        verified: result.verified,
        verificationReason: result.verificationReason,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Command failed"
    const status = message.includes("identity") || message.includes("session")
      ? 401
      : message.includes("denied by policy")
        ? 403
        : message.includes("Approval required") || message.includes("Invalid approval receipt")
          ? 409
          : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
