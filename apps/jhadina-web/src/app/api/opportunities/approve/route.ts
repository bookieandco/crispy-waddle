import { NextRequest, NextResponse } from "next/server"
import { approveOpportunity } from "@/lib/opportunities/engine"
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { opportunityId } = await req.json()
  if (!opportunityId || typeof opportunityId !== "string") {
    return NextResponse.json({ success: false, error: "opportunityId is required" }, { status: 400 })
  }

  try {
    const { userId } = await requireAuthenticatedUser()
    const opportunity = approveOpportunity(userId, opportunityId)
    if (!opportunity) return NextResponse.json({ success: false, error: "Opportunity not found or already decided" }, { status: 404 })
    return NextResponse.json({ success: true, data: { opportunity } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication required"
    return NextResponse.json({ success: false, error: message }, { status: 401 })
  }
}
