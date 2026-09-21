import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createGrowthProductionRepository } from "@/lib/growth/production-repository"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  try {
    await (await createRequestIdentityVerifier()).verify({})
    const body = await req.json() as { action?: string; channel?: string; rationale?: string; idempotencyKey?: string }
    if (!body.action || !body.rationale || !body.idempotencyKey) return NextResponse.json({ success: false, error: "action, rationale, and idempotencyKey are required" }, { status: 400 })
    const proposal = await createGrowthProductionRepository().proposeLifecycleAction({
      customerId: context.params.id, action: body.action, channel: body.channel, rationale: body.rationale, idempotencyKey: body.idempotencyKey,
    })
    return NextResponse.json({
      success: true,
      data: { proposal, externalCommunicationExecuted: false, approvalRequiredBeforeSend: true },
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to propose lifecycle action"
    return NextResponse.json({ success: false, error: message }, { status: message.includes("Authenticated") ? 401 : 400 })
  }
}
