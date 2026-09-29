import { NextRequest, NextResponse } from "next/server"
import { createSocialPublishCanaryPlan } from "@jhadina/social-core"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createSocialRepository } from "@/lib/social/repository"

export const dynamic = "force-dynamic"

type CanaryBody = {
  id?: string
  assetId?: string
  canaryPlatform?: Parameters<typeof createSocialPublishCanaryPlan>[0]["canaryPlatform"]
  expansionPlatforms?: Parameters<typeof createSocialPublishCanaryPlan>[0]["expansionPlatforms"]
  createdAt?: string
}

export async function GET(req: NextRequest) {
  try {
    const verifier = await createRequestIdentityVerifier()
    const identity = await verifier.verify({})
    const planId = req.nextUrl.searchParams.get("planId")
    if (!planId) return NextResponse.json({ success: false, error: "planId is required" }, { status: 400 })

    const repository = createSocialRepository()
    const [plan, receipts] = await Promise.all([
      repository.getPublishCanary(identity.userId, planId),
      repository.listPublishCanaryReceipts(identity.userId, planId),
    ])
    return NextResponse.json({ success: true, data: { plan, receipts } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load publish canary"
    const status = /Authenticated|identity|session/i.test(message) ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const verifier = await createRequestIdentityVerifier()
    const identity = await verifier.verify({})
    const body = await req.json() as CanaryBody
    const plan = createSocialPublishCanaryPlan({
      id: body.id ?? "",
      assetId: body.assetId ?? "",
      canaryPlatform: body.canaryPlatform as Parameters<typeof createSocialPublishCanaryPlan>[0]["canaryPlatform"],
      expansionPlatforms: body.expansionPlatforms ?? [],
      createdAt: body.createdAt ?? new Date().toISOString(),
    })
    const persisted = await createSocialRepository().createPublishCanary(identity.userId, plan)
    return NextResponse.json({ success: true, data: { plan: persisted } }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create publish canary"
    const status = /Authenticated|identity|session/i.test(message) ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
