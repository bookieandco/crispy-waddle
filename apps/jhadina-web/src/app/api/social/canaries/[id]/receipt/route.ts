import { NextRequest, NextResponse } from "next/server"
import { TRANSCRIPT_FOLD_EVENT_TYPES } from "@jhadina/event-bus"
import { assessPublishCanary } from "@jhadina/social-core"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createSocialRepository } from "@/lib/social/repository"
import {
  parseTranscriptFoldRuntimeTrace,
  prepareTranscriptFoldEventEmitter,
} from "@/lib/runtime/transcript-fold-event-runtime"

export const dynamic = "force-dynamic"

type ReceiptBody = {
  outboxId?: string
  finalUrl?: string
  runtime?: unknown
}

export async function POST(
  req: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const verifier = await createRequestIdentityVerifier()
    const identity = await verifier.verify({})
    const body = await req.json() as ReceiptBody
    if (!body.outboxId?.trim()) {
      return NextResponse.json({ success: false, error: "outboxId is required" }, { status: 400 })
    }

    const runtime = parseTranscriptFoldRuntimeTrace(body.runtime)
    const emitter = await prepareTranscriptFoldEventEmitter({
      userId: identity.userId,
      runtime,
    })

    const repository = createSocialRepository()
    const receipt = await repository.capturePublishCanaryOutboxReceipt({
      userId: identity.userId,
      planId: context.params.id,
      outboxId: body.outboxId,
      finalUrl: body.finalUrl,
    })
    const [plan, receipts] = await Promise.all([
      repository.getPublishCanary(identity.userId, context.params.id),
      repository.listPublishCanaryReceipts(identity.userId, context.params.id),
    ])
    const assessment = assessPublishCanary({ plan, receipts })
    const event = await emitter.emit({
      type: TRANSCRIPT_FOLD_EVENT_TYPES.SOCIAL_CANARY_RECEIPT_CAPTURED,
      entityId: receipt.id,
      occurredAt: receipt.observedAt,
      payload: {
        planId: plan.id,
        receiptId: receipt.id,
        assetId: receipt.assetId,
        platform: receipt.platform,
        state: receipt.state,
        evidenceRefs: receipt.evidenceRefs,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        receipt,
        assessment,
        event: { id: event.id, type: event.type },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to capture publish canary receipt"
    const status = /Authenticated|identity|session/i.test(message) ? 401 : /NOT_FOUND/.test(message) ? 404 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
