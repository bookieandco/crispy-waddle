import { NextRequest, NextResponse } from "next/server"
import { handleJhadinaCommand } from "@/lib/intelligence/jhadina-command"
import { SupabaseExperienceRecorder } from "@/lib/supabase-experience-recorder"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { JhadinaWorldId } from "@/lib/jhadina/jhadina-world-registry"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const claimedUserId = req.headers.get("x-jhadina-user-id") || ""
  const activeTask = typeof body?.activeTask === "string" ? body.activeTask.trim() : ""

  if (!claimedUserId) return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 })
  if (!activeTask) return NextResponse.json({ success: false, error: "activeTask is required" }, { status: 400 })

  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== claimedUserId) {
      return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 })
    }

    const experienceRecorder = new SupabaseExperienceRecorder(supabase, user.id)
    const result = await handleJhadinaCommand(
      {
        userId: claimedUserId,
        activeTask,
        surface: typeof body?.surface === "string" ? (body.surface as JhadinaWorldId) : undefined,
        route: typeof body?.route === "string" ? body.route : undefined,
        activeProject: typeof body?.activeProject === "string" ? body.activeProject : undefined,
      },
      { experienceRecorder },
    )

    return NextResponse.json({
      success: true,
      data: {
        proposal: result.proposal,
        candidate: result.candidate,
        approvalReceiptId: result.approvalReceiptId,
        verified: result.verified,
        verificationReason: result.verificationReason,
        experienceRecorded: result.experienceRecorded,
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
