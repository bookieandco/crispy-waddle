import { NextRequest, NextResponse } from "next/server"
import { JHADINA_LIVE_CONTEXT_LIMITS, type ConversationSignalContext, type EphemeralArtifactContext, type LiveContextContribution } from "@jhadina/core-spine"
import { handleJhadinaCommand } from "@/lib/intelligence/jhadina-command"
import type { JhadinaWorldId } from "@/lib/jhadina/jhadina-world-registry"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { CleanArtifactContextResolver } from "@/lib/artifacts/clean-artifact-context-resolver"
import { createAndSubmitAskVideoJob, inspectAskVideoIntent } from "@/lib/director-video-job-service"
import {
  handleAskSocialCommand,
  inspectAskSocialIntent,
} from "@/lib/intelligence/ask-social-command"
import { inspectAskDoctorIntent, doctorProposal } from "@/lib/intelligence/ask-doctor-command"
import {
  handleAskGrowthReadCommand,
  inspectAskGrowthReadIntent,
} from "@/lib/intelligence/ask-growth-command"
import { realizeAskJhadinaExpression } from "@/lib/intelligence/ask-expression"
import { finalizeAskShortcutExperience, recordAskShortcutExperience } from "@/lib/intelligence/ask-shortcut-experience"
import { requiresFullJllmContextForRead } from "@/lib/intelligence/ask-contextual-read-routing"

export const dynamic = "force-dynamic"

const MAX_EPHEMERAL_ARTIFACTS = 4
const MAX_IMAGE_BASE64_CHARS = 5_500_000
const MAX_TEXT_ARTIFACT_CHARS = 20_000
const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"])

function parseConversationSignals(value: unknown): ConversationSignalContext | undefined {
  if (!value || typeof value !== "object") return undefined
  const raw = value as Record<string, unknown>
  if (raw.source !== "live-microphone" && raw.source !== "media-artifact") throw new Error("Unsupported conversation signal source")
  const bounded = (key:string,min:number,max:number) => {
    const v = raw[key]
    return typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : undefined
  }
  return {
    source: raw.source,
    observedAt: typeof raw.observedAt === "string" ? raw.observedAt : new Date().toISOString(),
    ...(typeof raw.language === "string" ? { language: raw.language.slice(0, 32) } : {}),
    ...(bounded("utteranceDurationMs",0,120000) !== undefined ? { utteranceDurationMs: bounded("utteranceDurationMs",0,120000) } : {}),
    ...(bounded("speakingRateWpm",0,500) !== undefined ? { speakingRateWpm: bounded("speakingRateWpm",0,500) } : {}),
    ...(bounded("pauseRatio",0,1) !== undefined ? { pauseRatio: bounded("pauseRatio",0,1) } : {}),
    ...(bounded("rmsMean",0,1) !== undefined ? { rmsMean: bounded("rmsMean",0,1) } : {}),
    ...(bounded("rmsPeak",0,1) !== undefined ? { rmsPeak: bounded("rmsPeak",0,1) } : {}),
    ...(bounded("energyVariance",0,1) !== undefined ? { energyVariance: bounded("energyVariance",0,1) } : {}),
    ...(bounded("pitchMeanHz",40,1200) !== undefined ? { pitchMeanHz: bounded("pitchMeanHz",40,1200) } : {}),
    ...(bounded("pitchVariance",0,1000000) !== undefined ? { pitchVariance: bounded("pitchVariance",0,1000000) } : {}),
    interpretationLimits: ["Acoustic cues are contextual observations only; do not infer emotion, intent, truthfulness, health, or identity from them alone."],
  }
}

function parseLiveContext(value: unknown): LiveContextContribution | undefined {
  if (!value || typeof value !== "object") return undefined
  const raw = value as Record<string, unknown>
  if (raw.source !== "ask-jhadina-live") throw new Error("Unsupported live context source")

  const recentTurns = Array.isArray(raw.recentTurns)
    ? raw.recentTurns.slice(-JHADINA_LIVE_CONTEXT_LIMITS.maxRecentTurns).flatMap((value, index) => {
        if (!value || typeof value !== "object") return []
        const turn = value as Record<string, unknown>
        const speaker = turn.speaker
        const text = typeof turn.text === "string" ? turn.text.trim().slice(0, 1200) : ""
        if ((speaker !== "user" && speaker !== "jhadina") || !text) return []
        return [{
          id: typeof turn.id === "string" && turn.id.trim() ? turn.id.slice(0, 160) : `live-turn:${index}`,
          speaker,
          text,
          createdAt: typeof turn.createdAt === "string" ? turn.createdAt : new Date().toISOString(),
        }]
      })
    : []

  let workSession: LiveContextContribution["workSession"]
  if (raw.workSession && typeof raw.workSession === "object") {
    const session = raw.workSession as Record<string, unknown>
    const id = typeof session.id === "string" ? session.id.trim().slice(0, 160) : ""
    if (id) {
      workSession = {
        id,
        ...(typeof session.goal === "string" && session.goal.trim() ? { goal: session.goal.trim().slice(0, 1200) } : {}),
        activeSubsystems: Array.isArray(session.activeSubsystems)
          ? session.activeSubsystems.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).slice(0, JHADINA_LIVE_CONTEXT_LIMITS.maxActiveSubsystems).map((value) => value.slice(0, 80))
          : [],
        admittedArtifactIds: Array.isArray(session.admittedArtifactIds)
          ? session.admittedArtifactIds.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).slice(0, JHADINA_LIVE_CONTEXT_LIMITS.maxAdmittedArtifactIds).map((value) => value.slice(0, 160))
          : [],
      }
    }
  }

  return {
    source: "ask-jhadina-live",
    observedAt: typeof raw.observedAt === "string" ? raw.observedAt : new Date().toISOString(),
    recentTurns,
    ...(workSession ? { workSession } : {}),
    limitations: [
      "Recent turns and WorkSession metadata are bounded continuity context only; they are not durable Memory, independent evidence, or authority.",
      "Resolve pronouns against supplied screen/file artifacts, recent turns, and active WorkSession only when the referent is unambiguous; otherwise ask for clarification.",
    ],
  }
}

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

  if (!claimedUserId) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 })
  }
  if (!activeTask) {
    return NextResponse.json({ success: false, error: "activeTask is required" }, { status: 400 })
  }

  try {
    const ephemeralArtifacts = parseEphemeralArtifacts(body?.artifacts)
    const durableRefs = Array.isArray(body?.artifactRefs) ? body.artifactRefs.filter((x:unknown)=>typeof x==="string").slice(0,8).map((id:string)=>({id})) : []
    let durableArtifacts: EphemeralArtifactContext[] = []
    if (durableRefs.length) {
      const verifier = await createRequestIdentityVerifier()
      const verified = await verifier.verify({ userId: claimedUserId })
      const client = createServiceRoleClient()
      if (!client) throw new Error("ARTIFACT_CONTEXT_STORAGE_NOT_CONFIGURED")
      durableArtifacts = await new CleanArtifactContextResolver(client, verified.userId).resolve(durableRefs)
    }
    const artifacts = [...ephemeralArtifacts, ...durableArtifacts]
    const conversationSignals = parseConversationSignals(body?.conversationSignals)
    const liveContext = parseLiveContext(body?.liveContext)
    const doctorIntent = inspectAskDoctorIntent(activeTask)
    if (doctorIntent) {
      const verifier = await createRequestIdentityVerifier()
      const verifiedIdentity = await verifier.verify({ userId: claimedUserId })
      const doctor = doctorProposal(doctorIntent)
      const proposal = {
        id: `doctor-proposal:${crypto.randomUUID()}`,
        contextId: `doctor-context:${crypto.randomUUID()}`,
        disposition: doctor.disposition,
        recommendation: doctor.recommendation,
        rationale: doctor.rationale,
        evidence: [],
        uncertainty: ["Runtime diagnostic evidence has not yet been collected in this HTTP request."],
        alternatives: [],
      }
      const reasoningEventId = await recordAskShortcutExperience({
        userId: verifiedIdentity.userId,
        activeTask,
        proposal,
        shortcut: "doctor",
        metadata: { approvalRequired: true, executionStarted: false },
      })
      const expression = await realizeAskJhadinaExpression({
        userId: verifiedIdentity.userId,
        activeTask,
        proposal,
      })
      return NextResponse.json({
        success: true,
        data: {
          proposal,
          reasoningEventId,
          expression,
          doctorIntent: doctor.doctorIntent,
          approvalRequired: true,
          executionStarted: false,
          verified: true,
          verificationReason: "Identity verified; Doctor intent classified. No repair authority was granted.",
        },
      })
    }

    const growthReadIntent = inspectAskGrowthReadIntent(activeTask)
    const contextualRead = requiresFullJllmContextForRead(activeTask)
    if (growthReadIntent && !contextualRead) {
      const verifier = await createRequestIdentityVerifier()
      const verifiedIdentity = await verifier.verify({ userId: claimedUserId })
      const growth = await handleAskGrowthReadCommand({
        userId: verifiedIdentity.userId,
        activeTask,
      })
      if (growth) {
        const reasoningEventId = await recordAskShortcutExperience({
          userId: verifiedIdentity.userId,
          activeTask,
          proposal: growth.proposal,
          shortcut: "growth",
          metadata: { operation: growth.workPlan.operation, authority: growth.workPlan.authority },
        })
        return NextResponse.json({
          success: true,
          data: {
            proposal: growth.proposal,
            reasoningEventId,
            expression: await realizeAskJhadinaExpression({
              userId: verifiedIdentity.userId,
              activeTask,
              proposal: growth.proposal,
            }),
            verified: growth.verified,
            verificationReason: growth.verificationReason,
            growthWorkPlan: growth.workPlan,
            feedbackEligible: false,
          },
        })
      }
    }

    const socialIntent = inspectAskSocialIntent(activeTask)
    const contextualSocialRead = socialIntent
      && contextualRead
      && new Set([
        "list_characters",
        "account_attention",
        "select_character_accounts",
        "analyze_performance",
        "social_general",
      ]).has(socialIntent.operation)
    if (socialIntent && !contextualSocialRead) {
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
            const reasoningEventId = await recordAskShortcutExperience({
              userId: verifiedIdentity.userId,
              activeTask,
              proposal: scopedProposal,
              shortcut: "social",
              metadata: {
                operation: social.workPlan.operation,
                authority: social.workPlan.authority,
                nextBoundary: social.workPlan.nextBoundary,
                directorOutcome: "scope_clarification",
              },
            })
            return NextResponse.json({
              success: true,
              data: {
                proposal: scopedProposal,
                reasoningEventId,
                expression: await realizeAskJhadinaExpression({
                  userId: verifiedIdentity.userId,
                  activeTask,
                  proposal: scopedProposal,
                }),
                verified: social.verified,
                verificationReason: social.verificationReason,
                socialWorkPlan: social.workPlan,
                feedbackEligible: false,
              },
            })
          }

          const reasoningEventId = await recordAskShortcutExperience({
            userId: verifiedIdentity.userId,
            activeTask,
            proposal: social.proposal,
            shortcut: "social",
            metadata: {
              operation: social.workPlan.operation,
              authority: social.workPlan.authority,
              nextBoundary: social.workPlan.nextBoundary,
              directorOutcome: "pending",
            },
          })
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
          let finalProposal = combinedProposal
          let experienceFinalized = true
          try {
            await finalizeAskShortcutExperience({
              userId: verifiedIdentity.userId,
              reasoningEventId,
              proposal: combinedProposal,
              shortcut: "social",
              metadata: {
                operation: social.workPlan.operation,
                authority: social.workPlan.authority,
                nextBoundary: social.workPlan.nextBoundary,
                directorOutcome: started ? "started" : "deferred",
                videoJobId: video.job.id,
                projectId: video.job.projectId,
                videoStatus: video.job.status,
              },
            })
          } catch {
            experienceFinalized = false
            finalProposal = {
              ...combinedProposal,
              uncertainty: [
                ...combinedProposal.uncertainty,
                "Director outcome is durable, but the conversation Experience could not be finalized in Hippocampus. Do not retry the video solely for this logging failure.",
              ],
            }
          }
          return NextResponse.json({
            success: true,
            data: {
              proposal: finalProposal,
              reasoningEventId,
              expression: await realizeAskJhadinaExpression({
                userId: verifiedIdentity.userId,
                activeTask,
                proposal: finalProposal,
              }),
              verified: social.verified,
              verificationReason: `${social.verificationReason} Director video job persisted before provider submission.${experienceFinalized ? "" : " Hippocampus finalization failed after the durable Director outcome; the video job remains authoritative."}`,
              socialWorkPlan: social.workPlan,
              videoJob: video.job,
              feedbackEligible: false,
            },
          })
        }

        const reasoningEventId = await recordAskShortcutExperience({
          userId: verifiedIdentity.userId,
          activeTask,
          proposal: social.proposal,
          shortcut: "social",
          metadata: {
            operation: social.workPlan.operation,
            authority: social.workPlan.authority,
            nextBoundary: social.workPlan.nextBoundary,
          },
        })
        return NextResponse.json({
          success: true,
          data: {
            proposal: social.proposal,
            reasoningEventId,
            expression: await realizeAskJhadinaExpression({
              userId: verifiedIdentity.userId,
              activeTask,
              proposal: social.proposal,
            }),
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
        contextId: `director-video-context:${video.job.id}`,
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
      const reasoningEventId = await recordAskShortcutExperience({
        userId: verifiedIdentity.userId,
        activeTask,
        proposal,
        shortcut: "director",
        metadata: {
          videoJobId: video.job.id,
          projectId: video.job.projectId,
          status: video.job.status,
        },
      })
      return NextResponse.json({
        success: true,
        data: {
          proposal,
          reasoningEventId,
          expression: await realizeAskJhadinaExpression({
            userId: verifiedIdentity.userId,
            activeTask,
            proposal,
          }),
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
      conversationSignals,
      liveContext,
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
