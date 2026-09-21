import { NextRequest, NextResponse } from "next/server"
import { requireRequestIdentity } from "@/lib/auth/request-user"
import { createSocialRepository } from "@/lib/social/repository"

export const dynamic = "force-dynamic"

function normalizedMetrics(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("metrics must be an object of non-negative numbers")
  }
  const metrics: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
      throw new Error(`invalid metric: ${key}`)
    }
    metrics[key] = raw
  }
  if (!Object.keys(metrics).length) throw new Error("at least one performance metric is required")
  return metrics
}

export async function POST(req: NextRequest) {
  try {
    const identity = await requireRequestIdentity()
    const body = await req.json() as {
      accountId?: string
      contentId?: string
      metrics?: unknown
      observedAt?: string
      sourceLabel?: string
      sourceUrl?: string
      evidence?: string[]
    }

    if (!body.accountId || !body.contentId) {
      return NextResponse.json(
        { success: false, error: "accountId and contentId are required" },
        { status: 400 },
      )
    }

    const repository = createSocialRepository()
    const account = (await repository.listAccounts(identity.userId))
      .find((candidate) => candidate.id === body.accountId && candidate.status === "connected")
    if (!account) {
      return NextResponse.json({ success: false, error: "Connected social account not found" }, { status: 404 })
    }

    const metrics = normalizedMetrics(body.metrics)
    const observedAt = body.observedAt ? new Date(body.observedAt) : new Date()
    if (!Number.isFinite(observedAt.getTime())) {
      return NextResponse.json({ success: false, error: "observedAt is invalid" }, { status: 400 })
    }

    const observation = await repository.recordObservation({
      userId: identity.userId,
      observation: {
        kind: "performance",
        source: "user-import",
        provider: account.provider,
        platform: account.platform,
        accountId: account.id,
        providerProfileId: account.providerProfileId,
        contentId: body.contentId,
        observedAt: observedAt.toISOString(),
        sourceUrl: body.sourceUrl,
        evidence: [
          ...(body.sourceLabel ? [`source-label:${body.sourceLabel}`] : []),
          ...(Array.isArray(body.evidence) ? body.evidence.slice(0, 25) : []),
        ],
        metrics,
        attributes: { confidence: 0.5 },
      },
    })

    return NextResponse.json({ success: true, data: observation }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record social performance"
    const status = message.includes("Authenticated") || message.includes("session") ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
