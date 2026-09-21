import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createGrowthProductionRepository } from "@/lib/growth/production-repository"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  try {
    await (await createRequestIdentityVerifier()).verify({})
    const body = await req.json() as { customerId?: string; score?: number; evidence?: Record<string, unknown> }
    if (!body.customerId || typeof body.score !== "number") {
      return NextResponse.json({ success: false, error: "customerId and score are required" }, { status: 400 })
    }
    const membership = await createGrowthProductionRepository().addAudienceMember({
      audienceId: context.params.id, customerId: body.customerId, score: body.score, evidence: body.evidence,
    })
    return NextResponse.json({ success: true, data: membership }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add audience member"
    return NextResponse.json({ success: false, error: message }, { status: message.includes("Authenticated") ? 401 : 400 })
  }
}
