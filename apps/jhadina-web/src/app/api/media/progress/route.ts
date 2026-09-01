import { NextResponse } from "next/server"

import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { SupabaseMediaPlaybackProgressRepository } from "@/lib/storage/SupabaseMediaPlaybackProgressRepository"

const MAX_PROVIDER_ID_LENGTH = 128
const MAX_MEDIA_ID_LENGTH = 512
const MAX_PROGRESS_MS = 24 * 60 * 60 * 1000
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength
}

function isFiniteNonNegativeNumber(value: unknown, max = MAX_PROGRESS_MS): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== 24) return false
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false
  return !Number.isNaN(Date.parse(value))
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid JSON body", 400)
  }

  if (!body || typeof body !== "object") return jsonError("Invalid request body", 400)

  const action = (body as { action?: unknown }).action
  if (action !== "get" && action !== "upsert") return jsonError("Invalid action", 400)

  const providerId = (body as { providerId?: unknown }).providerId
  const itemId = (body as { itemId?: unknown }).itemId
  const userId = (body as { userId?: unknown }).userId

  if (!isNonEmptyString(userId, 256)) return jsonError("Invalid userId", 400)
  if (!isNonEmptyString(providerId, MAX_PROVIDER_ID_LENGTH)) return jsonError("Invalid providerId", 400)
  if (!isNonEmptyString(itemId, MAX_MEDIA_ID_LENGTH)) return jsonError("Invalid itemId", 400)

  if (action === "upsert") {
    const progress = (body as { progress?: unknown }).progress
    if (!progress || typeof progress !== "object") return jsonError("Invalid progress", 400)

    const candidate = progress as Record<string, unknown>
    const durationMs = candidate.durationMs
    if (
      candidate.userId !== userId ||
      candidate.providerId !== providerId ||
      candidate.itemId !== itemId ||
      !isFiniteNonNegativeNumber(candidate.positionMs) ||
      (durationMs !== undefined && !isFiniteNonNegativeNumber(durationMs)) ||
      (typeof durationMs === "number" && durationMs > 0 && candidate.positionMs > durationMs) ||
      typeof candidate.completed !== "boolean" ||
      !isIsoTimestamp(candidate.updatedAt) ||
      Date.parse(candidate.updatedAt as string) > Date.now() + MAX_FUTURE_SKEW_MS
    ) {
      return jsonError("Invalid progress", 400)
    }
  }

  try {
    const identityVerifier = await createRequestIdentityVerifier()
    const identity = await identityVerifier.verify({ userId })

    const client = createServiceRoleClient()
    if (!client) return jsonError("Playback persistence unavailable", 503)

    const repository = new SupabaseMediaPlaybackProgressRepository(client)

    if (action === "get") {
      const progress = await repository.get(identity.userId, providerId, itemId)
      return NextResponse.json({ progress })
    }

    const progress = (body as { progress: Record<string, unknown> }).progress
    const saved = await repository.upsert({
      userId: identity.userId,
      providerId,
      itemId,
      positionMs: progress.positionMs as number,
      durationMs: progress.durationMs as number | undefined,
      completed: progress.completed as boolean,
      updatedAt: progress.updatedAt as string,
    })

    return NextResponse.json({ progress: saved })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Playback persistence failed"
    if (message === "Action identity mismatch") return jsonError("Identity mismatch", 403)
    if (message === "Authenticated user missing" || message === "Authenticated session missing") {
      return jsonError("Unauthenticated", 401)
    }
    return jsonError("Playback persistence failed", 500)
  }
}
