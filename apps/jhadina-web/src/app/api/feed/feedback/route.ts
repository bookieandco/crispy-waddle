import { NextRequest, NextResponse } from "next/server"
import { getJhadinaApplication } from "@/lib/application/createJhadinaApplication"
import {
  createFeedFeedbackEvent,
  feedbackRelevanceDelta,
  type FeedFeedbackAction,
} from "@/lib/personal-feed/feedback"
import type { FeedKind, FeedPlatform } from "@/lib/personal-feed/core"

export const dynamic = "force-dynamic"

const ACTIONS: FeedFeedbackAction[] = [
  "more_like_this",
  "less_like_this",
  "not_relevant",
  "watch_topic",
]

function isAction(value: unknown): value is FeedFeedbackAction {
  return typeof value === "string" && ACTIONS.includes(value as FeedFeedbackAction)
}

export async function POST(req: NextRequest) {
  const claimedUserId = req.headers.get("x-jhadina-user-id")?.trim() || ""
  if (!claimedUserId) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 })
  }

  const itemId = typeof body.itemId === "string" ? body.itemId.trim() : ""
  const action = body.action
  const kind = typeof body.kind === "string" ? body.kind : ""
  const platform = typeof body.platform === "string" ? body.platform : undefined
  const topic = typeof body.topic === "string" ? body.topic.trim() : undefined

  if (!itemId) return NextResponse.json({ success: false, error: "itemId is required" }, { status: 400 })
  if (!isAction(action)) return NextResponse.json({ success: false, error: "Invalid feedback action" }, { status: 400 })

  const event = createFeedFeedbackEvent({
    userId: claimedUserId,
    itemId,
    action,
    kind: kind as FeedKind,
    platform: platform as FeedPlatform | undefined,
    topic,
  })

  try {
    const app = getJhadinaApplication()
    const reasoningEvent = await app.reasoningRepo.create({
      userId: claimedUserId,
      userMessage: `Feed feedback: ${action} on ${itemId}`,
      observation: {
        raw: JSON.stringify(event),
        extracted: topic || itemId,
        timestamp: event.createdAt,
      },
      classification: {
        type: "PREFERENCE",
        confidence: 1,
        reasoning: `Explicit feed attention signal: ${action}; relevance delta ${feedbackRelevanceDelta(action)}.`,
      },
      systemResponse: "Recorded as an attention-learning signal; no permanent memory was created.",
      confidence: 1,
    })

    return NextResponse.json({
      success: true,
      data: { feedbackId: event.id, reasoningEventId: reasoningEvent.id },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record feedback"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
