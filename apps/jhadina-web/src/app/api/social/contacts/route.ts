import { NextRequest, NextResponse } from "next/server"
import type { SocialContactState, SocialPlatform } from "@jhadina/social-core"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createSocialMessageRepository } from "@/lib/social/message-repository"

export const dynamic = "force-dynamic"

interface ContactStateBody {
  recipientRef?: string
  provider?: string
  platform?: SocialPlatform
  providerRecipientId?: string
  state?: SocialContactState
  evidenceRefs?: string[]
  observedAt?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ContactStateBody
    if (
      !body.recipientRef?.trim() ||
      !body.provider?.trim() ||
      !body.platform ||
      !body.providerRecipientId?.trim() ||
      !body.state ||
      !body.evidenceRefs?.length ||
      !body.observedAt
    ) {
      return NextResponse.json(
        { success: false, error: "recipient, provider, platform, state, evidenceRefs, and observedAt are required" },
        { status: 400 },
      )
    }

    const verifier = await createRequestIdentityVerifier()
    const identity = await verifier.verify({})
    const contact = await createSocialMessageRepository().upsertContactState({
      userId: identity.userId,
      recipientRef: body.recipientRef,
      provider: body.provider,
      platform: body.platform,
      providerRecipientId: body.providerRecipientId,
      state: body.state,
      evidenceRefs: body.evidenceRefs,
      observedAt: body.observedAt,
    })
    return NextResponse.json({ success: true, data: contact })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update social contact state"
    const status = message.includes("Authenticated") || message.includes("session") ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
