import { NextRequest, NextResponse } from "next/server"
import type { EphemeralArtifactContext } from "@jhadina/core-spine"
import { handleJhadinaCommand } from "@/lib/intelligence/jhadina-command"
import type { JhadinaWorldId } from "@/lib/jhadina/jhadina-world-registry"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createAndSubmitAskVideoJob, inspectAskVideoIntent } from "@/lib/director-video-job-service"
import {
  handleAskSocialCommand,
  inspectAskSocialIntent,
} from "@/lib/intelligence/ask-social-command"
import {
  handleAskGrowthReadCommand,
  inspectAskGrowthReadIntent,
} from "@/lib/intelligence/ask-growth-command"

export const dynamic = "force-dynamic"

const MAX_EPHEMERAL_ARTIFACTS = 4
const MAX_IMAGE_BASE64_CHARS = 5_500_000
const MAX_TEXT_ARTIFACT_CHARS = 20_000
const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"])

function parseEphemeralArtifacts(value: unknown): EphemeralArtifactContext[] {
  if (!Array.isArray(value)) return []
  if (value.length > MAX_EPHEMERAL_ARTIFACTS) throw new Error("Too many ephemeral artifacts; maximum is 4")
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`Artifact ${index + 1} is invalid`)
    const item = raw as Record<string, unknown>
    const kind = item.kind
    const mimeType = typeof item.mimeType === "string" ? item.mimeType.toLowerCase() : ""
    const source = item.source
    if (kind !== "screen" && kind !== "image" && kind !== "text") throw new Error(`Artifact ${index + 1} has unsupported kind`)
    if (source !== "screen-share" && source !== "file-picker" && source !== "clipboard") throw new Error(`Artifact ${index + 1} has unsupported source`)
    const artifact: EphemeralArtifactContext = {
      id: typeof item.id === "string" && item.id ? item.id.slice(0, 160) : `artifact:${crypto.randomUUID()}`,
      kind,
      mimeType,
      source,
      observedAt: typeof item.observedAt === "string" ? item.observedAt : new Date().toISOString(),
      ...(typeof item.name === "string" ? { name: item.name.slice(0, 240) } : {}),
    }
    if (kind === "text") {
      if (!mimeType.startsWith("text/") && mimeType !== "application/json") throw new Error(`Artifact ${index + 1} is not a supported text type`)
      if (typeof item.text !== "string" || item.text.length > MAX_TEXT_ARTIFACT_CHARS) throw new Error(`Artifact ${index + 1} text is missing or too large`)
      artifact.text = item.text
      return artifact
    }
    if (!IMAGE_MIME.has(mimeType)) throw new Error(`Artifact ${index + 1} is not a supported image type`)
    if (typeof item.base64 !== "string" || item.base64.length === 0 || item.base64.length > MAX_IMAGE_BASE64_CHARS || !/^[A-Za-z0-9+/=]+$/.test(item.base64)) {
      throw new Error(`Artifact ${index + 1} image payload is missing or too large`)
    }
    artifact.base64 = item.base64
    return artifact
  })
}

/**
 * Phase 1 Step 6 — Ask Jhadina's real, governed entry point.
 *
 * A thin HTTP adapter, same shape as
 * apps/jhadina-web/src/app/api/growth/drafts/approve/route.ts: reads the
 * claimed identity from a header, reads the command from the body, and
 * calls `handleJhadinaCommand()` (Phase 1 Step 5) with no overrides —
 * meaning this route always uses the real
 * createRequestIdentityVerifier()/createIntelligenceAuditLedger()/
 * createProductionIntelligenceRouter() defaults. Nothing here is a new
 * executor, policy engine, audit ledger, or memory abstraction; the
 * governed lifecycle this route triggers is exactly what Step 5 already
 * tests.
 *
 * The real Supabase-session identity check happens inside
 * createRequestIdentityVerifier() — the header below is only a *claim*,
 * verified against the actual signed-in session server-side, same as
 * every other governed route in this app.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const claimedUserId = req.headers.get("x-jhadina-user-id") || ""
  const activeTask = typeof body?.activeTask === "string" ? body.activeTask.trim() : ""
  const artifacts = parseEphemeralArtifacts(body?.artifacts)

  if (!claimedUserId) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 })
  }
  if (!activeTask) {
    return NextResponse.json({ success: false, error: "activeTask is required" }, { status: 400 })
  }

  try {
    const growthReadIntent = inspectAskGrowthReadIntent(activeTask)
    if (growthReadIntent) {
      const verifier = await createRequestIdentityVerifier()
      const verifiedIdentity = await verifier.verify({ userId: claimedUserId })
      const growth = await handleAskGrowthReadCommand({
        userId: verifiedIdentity.userId,
        activeTask,
      })
      if (growth) {
        return NextResponse.json({
          success: true,
          data: {
            proposal: growth.proposal,
            reasoningEventId: growth.reasoningEventId,
            expression: {
              proposal: growth.proposal,
              presentation: {
                mode: "direct",
                allowProfanity: false,
                allowQuip: false,
              },
              segments: [{
                kind: "semantic",
                text: growth.proposal.recommendation,
              }],
            },
            verified: growth.verified,
            verificationReason: growth.verificationReason,
            growthWorkPlan: growth.workPlan,
            feedbackEligible: false,
          },
        })
      }
    }

    const socialIntent = inspectAskSocialIntent(activeTask)
    if (socialIntent) {
      const verifier = await createRequestIdentityVerifier()
      const verifiedIdentity = await verifier.verify({ userId: claimedUserId })
      const social = await handleAskSocialCommand({
        userId: verifiedIdentity.userId,
        activeTask,
      })
      if (social) {
        const clarifying = social.proposal.disposition === "ASK"
        return NextResponse.json({
          success: true,
          data: {
            proposal: social.proposal,
            reasoningEventId: social.reasoningEventId,
            expression: {
              proposal: social.proposal,
              presentation: {
                mode: clarifying ? "clarifying" : "direct",
                allowProfanity: false,
                allowQuip: false,
              },
              segments: [{
                kind: "semantic",
                text: social.proposal.recommendation,
              }],
            },
            verified: social.verified,
            verificationReason: social.verificationReason,
            socialWorkPlan: social.workPlan,
            feedbackEligible: false,
          },
        })
      }
    }

    const videoIntent = inspectAskVideoIntent(activeTask)
    if (videoIntent) {
      const verifier = await createRequestIdentityVerifier()
      const verifiedIdentity = await verifier.verify({ userId: claimedUserId })
      const video = await createAndSubmitAskVideoJob({
        userId: verifiedIdentity.userId,
        activeTask,
        activeProject: typeof body?.activeProject === "string" ? body.activeProject : undefined,
        clientRequestId: typeof body?.clientRequestId === "string" ? body.clientRequestId : undefined,
      })
      const started = !["blocked", "failed", "cancelled"].includes(video.job.status)
      const now = new Date().toISOString()
      const message = started
        ? `Director started creating the video. Job ${video.job.id} is ${video.job.status}.`
        : `Director created the video job, but it is currently ${video.job.status}: ${video.job.error ?? "provider action is required"}.`
      const proposal = {
        id: `video-proposal:${video.job.id}`,
        disposition: started ? "PROCEED" as const : "DEFER" as const,
        recommendation: message,
        rationale: "The request is an explicit video-creation command, so Ask Jhadina routed it to the governed Director production job path instead of treating it as a general chat response.",
        evidence: [{
          id: `director-video-job:${video.job.id}`,
          source: "Director",
          observedAt: now,
          summary: `Project ${video.job.projectId}; mode ${video.job.mode}; aspect ${video.job.aspectRatio}; provider ${video.job.providerId ?? "not configured"}.`,
        }],
        uncertainty: video.job.error ? [video.job.error] : [],
        alternatives: [],
      }
      return NextResponse.json({
        success: true,
        data: {
          proposal,
          reasoningEventId: `director-video:${video.job.id}`,
          expression: {
            proposal,
            presentation: { mode: "direct", allowProfanity: false, allowQuip: false },
            segments: [{ kind: "semantic", text: message }],
          },
          verified: true,
          verificationReason: "Director video job persisted with project authority before provider submission.",
          videoJob: video.job,
        },
      })
    }

    const result = await handleJhadinaCommand({
      userId: claimedUserId,
      activeTask,
      surface: typeof body?.surface === "string" ? (body.surface as JhadinaWorldId) : undefined,
      route: typeof body?.route === "string" ? body.route : undefined,
      activeProject: typeof body?.activeProject === "string" ? body.activeProject : undefined,
      geographicScope: body?.geographicScope ?? undefined,
      artifacts,
      temporalScope: body?.temporalScope && typeof body.temporalScope === "object"
        ? {
            from: typeof body.temporalScope.from === "string" ? body.temporalScope.from : null,
            to: typeof body.temporalScope.to === "string" ? body.temporalScope.to : null,
            asOf: typeof body.temporalScope.asOf === "string" ? body.temporalScope.asOf : null,
          }
        : undefined,
    })

    return NextResponse.json({
      success: true,
      data: {
        proposal: result.proposal,
        reasoningEventId: result.reasoningEventId,
        expression: result.expression,
        candidate: result.candidate,
        approvalReceiptId: result.approvalReceiptId,
        verified: result.verified,
        verificationReason: result.verificationReason,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Command failed"
    const status = message.includes("identity") || message.includes("session")
      ? 401
      : message.includes("denied by policy")
        ? 403
        : message.includes("Approval required") || message.includes("Invalid approval receipt")
          ? 409
          : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
