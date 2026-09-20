import { NextResponse } from "next/server"
import { observeShodanGoverned } from "@/lib/intelligence/governed-observation-runtime"
import type { ShodanReadCapability } from "@jhadina/intelligence-core"

const ALLOWED = new Set<ShodanReadCapability>(["host.read", "internetdb.read", "dns.read", "search.read", "history.read"])

export async function POST(request: Request) {
  const claimedUserId = request.headers.get("x-jhadina-user-id")
  if (!claimedUserId) return NextResponse.json({ error: "x-jhadina-user-id is required" }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "valid JSON body required" }, { status: 400 })
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "request body required" }, { status: 400 })
  const value = body as Record<string, unknown>
  if (typeof value.observationId !== "string" || !value.observationId.trim()) return NextResponse.json({ error: "observationId is required" }, { status: 400 })
  if (typeof value.subjectId !== "string" || !value.subjectId.trim()) return NextResponse.json({ error: "subjectId is required" }, { status: 400 })
  if (typeof value.capability !== "string" || !ALLOWED.has(value.capability as ShodanReadCapability)) {
    return NextResponse.json({ error: "unsupported passive observation capability" }, { status: 400 })
  }

  try {
    const result = await observeShodanGoverned({
      claimedUserId,
      observationId: value.observationId,
      subjectId: value.subjectId,
      capability: value.capability as ShodanReadCapability,
      observedAt: typeof value.observedAt === "string" ? value.observedAt : undefined,
    })
    return NextResponse.json({ ok: true, observation: result.envelope, verifiedUserId: result.verifiedUserId })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to perform passive observation"
    const status = /identity|session|auth/i.test(message) ? 401 : /credential/i.test(message) ? 503 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
