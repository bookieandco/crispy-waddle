import { NextRequest, NextResponse } from "next/server"
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
        const videoIntent = inspectAskVideoIntent(activeTask)
        const shouldStartDirectorVideo =
          !clarifying
          && social.workPlan.nextBoundary === "director_production"
          && Boolean(videoIntent)

        if (shouldStartDirectorVideo) {
          const character = social.workPlan.character
          const resolvedBrands = new Set([
            ...social.workPlan.accounts.map((account) => account.brand),
            ...(character ? [character.brand] : []),
          ])
          if (resolvedBrands.size !== 1 || social.workPlan.accounts.length === 0) {
            const recommendation = resolvedBrands.size !== 1
              ? "Choose one Social brand before starting Director production."
              : "Choose at least one connected Social account before starting Director production."
            const scopedProposal = {
              ...social.proposal,
              disposition: "ASK" as const,
              recommendation,
              rationale: `${social.proposal.rationale} Director auto-start requires one resolved brand and at least one connected account so expression/account scope cannot be broadened implicitly.`,
            }
            return NextResponse.json({
              success: true,
              data: {
                proposal: scopedProposal,
                reasoningEventId: social.reasoningEventId,
                expression: {
                  proposal: scopedProposal,
                  presentation: { mode: "clarifying", allowProfanity: false, allowQuip: false },
                  segments: [{ kind: "semantic", text: recommendation }],
                },
                verified: social.verified,
                verificationReason: social.verificationReason,
                socialWorkPlan: social.workPlan,
                feedbackEligible: false,
              },
            })
          }

          const video = await createAndSubmitAskVideoJob({
            userId: verifiedIdentity.userId,
            activeTask,
            activeProject: typeof body?.activeProject === "string" ? body.activeProject : undefined,
            clientRequestId: typeof body?.clientRequestId === "string" ? body.clientRequestId : undefined,
            socialExpression: {
              brand: [...resolvedBrands][0]!,
              characterProfileRef: character?.id,
              voiceProfileRef: character?.voiceProfileRef,
              toneTraits: character?.toneTraits,
              pointOfView: character?.pointOfView,
              accountScopes: social.workPlan.accounts.map((account) => ({
                accountId: account.accountId,
                platform: account.platform,
                provider: account.provider,
                displayName: account.displayName,
              })),
            },
          })
          const started = !["blocked", "failed", "cancelled"].includes(video.job.status)
          const message = started
            ? `${social.proposal.recommendation} Director started video job ${video.job.id}; status=${video.job.status}.`
            : `${social.proposal.recommendation} Director created video job ${video.job.id}, but status=${video.job.status}: ${video.job.error ?? "provider action is required"}.`
          const combinedProposal = {
            ...social.proposal,
            disposition: started ? "PROCEED" as const : "DEFER" as const,
            recommendation: message,
            rationale: `${social.proposal.rationale} Because the user explicitly requested video production, the resolved Social scope continued into Director's governed video job boundary. This does not grant publication or spend authority.`,
            uncertainty: [
              ...social.proposal.uncertainty,
              ...(video.job.error ? [video.job.error] : []),
            ],
          }
          return NextResponse.json({
            success: true,
            data: {
              proposal: combinedProposal,
              reasoningEventId: social.reasoningEventId,
              expression: {
                proposal: combinedProposal,
                presentation: {
                  mode: "direct",
                  allowProfanity: false,
                  allowQuip: false,
                },
                segments: [{ kind: "semantic", text: message }],
              },
              verified: social.verified,
              verificationReason: `${social.verificationReason} Director video job persisted before provider submission.`,
              socialWorkPlan: social.workPlan,
              videoJob: video.job,
              feedbackEligible: false,
            },
          })
        }

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
