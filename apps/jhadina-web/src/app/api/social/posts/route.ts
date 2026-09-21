import { NextRequest, NextResponse } from "next/server"
import type { JhadinaBrand } from "@jhadina/social-core"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { requestSocialPublication } from "@/lib/social/governed-publication"
import { createSocialRepository } from "@/lib/social/repository"

export const dynamic = "force-dynamic"

interface CreatePostBody {
  brand?: JhadinaBrand
  text?: string
  mediaUrls?: string[]
  scheduledAt?: string
  targetAccountIds?: string[]
  idempotencyKey?: string
}

export async function GET() {
  try {
    const verifier = await createRequestIdentityVerifier()
    const identity = await verifier.verify({})
    const proposals = await createSocialRepository().listProposals(identity.userId)
    return NextResponse.json({ success: true, data: proposals })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load social proposals"
    return NextResponse.json({ success: false, error: message }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as CreatePostBody
    if (!body.brand || !body.text?.trim() || !body.targetAccountIds?.length) {
      return NextResponse.json(
        { success: false, error: "brand, text, and targetAccountIds are required" },
        { status: 400 },
      )
    }

    const result = await requestSocialPublication({
      brand: body.brand,
      text: body.text,
      mediaUrls: body.mediaUrls,
      scheduledAt: body.scheduledAt,
      targetAccountIds: body.targetAccountIds,
      idempotencyKey: body.idempotencyKey,
    })

    return NextResponse.json({
      success: true,
      data: {
        proposal: result.proposal,
        approval: {
          required: true,
          receiptId: result.approvalReceiptId,
        },
      },
    }, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create social publication proposal"
    const status = message.includes("Authenticated") || message.includes("session") ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
