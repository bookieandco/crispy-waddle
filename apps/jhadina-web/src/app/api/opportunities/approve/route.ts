import { NextRequest, NextResponse } from "next/server"
import { approveOpportunity } from "@/lib/opportunities/engine"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { opportunityId } = await req.json()
  const userId = req.headers.get("x-jhadina-user-id") || "default-user"
  const opportunity = approveOpportunity(userId, opportunityId)
  if (!opportunity) return NextResponse.json({ success: false, error: "Opportunity not found or already decided" }, { status: 404 })
  return NextResponse.json({ success: true, data: { opportunity } })
}
