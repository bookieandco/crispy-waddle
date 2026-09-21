import { NextRequest, NextResponse } from "next/server"
import type {
  JhadinaBrand,
  SocialContactState,
  SocialPlatform,
} from "@jhadina/social-core"
import { requestSocialMessage } from "@/lib/social/governed-messaging"

export const dynamic = "force-dynamic"

interface MessageBody {
  brand?: JhadinaBrand
  senderAccountId?: string
  recipient?: {
    recipientRef?: string
    providerRecipientId?: string
    provider?: string
    platform?: SocialPlatform
  }
  text?: string
  conversationRef?: string
  offerRef?: string
  outreachPlanRef?: string
  touchId?: string
  brandVoiceProfileRef?: string
  channelVoiceProfileRef?: string
  eligibility?: {
    state?: SocialContactState
    evidenceRefs?: string[]
    observedAt?: string
  }
  idempotencyKey?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as MessageBody
    const recipient = body.recipient
    const eligibility = body.eligibility
    if (
      !body.brand ||
      !body.senderAccountId?.trim() ||
      !recipient?.recipientRef?.trim() ||
      !recipient.providerRecipientId?.trim() ||
      !recipient.provider?.trim() ||
      !recipient.platform ||
      !body.text?.trim() ||
      !body.brandVoiceProfileRef?.trim() ||
      !body.channelVoiceProfileRef?.trim() ||
      !eligibility?.state ||
      !eligibility.evidenceRefs?.length ||
      !eligibility.observedAt
    ) {
      return NextResponse.json(
        { success: false, error: "message identity, text, voice profiles, and fresh eligibility evidence are required" },
        { status: 400 },
      )
    }

    const result = await requestSocialMessage({
      brand: body.brand,
      senderAccountId: body.senderAccountId,
      recipient: {
        recipientRef: recipient.recipientRef,
        providerRecipientId: recipient.providerRecipientId,
        provider: recipient.provider,
        platform: recipient.platform,
      },
      text: body.text,
      conversationRef: body.conversationRef,
      offerRef: body.offerRef,
      outreachPlanRef: body.outreachPlanRef,
      touchId: body.touchId,
      brandVoiceProfileRef: body.brandVoiceProfileRef,
      channelVoiceProfileRef: body.channelVoiceProfileRef,
      eligibility: {
        state: eligibility.state,
        evidenceRefs: eligibility.evidenceRefs,
        observedAt: eligibility.observedAt,
      },
      idempotencyKey: body.idempotencyKey,
    })

    return NextResponse.json({
      success: true,
      data: {
        proposal: result.proposal,
        approval: { required: true, receiptId: result.approvalReceiptId },
      },
    }, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create social message proposal"
    const status = message.includes("Authenticated") || message.includes("session") ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
