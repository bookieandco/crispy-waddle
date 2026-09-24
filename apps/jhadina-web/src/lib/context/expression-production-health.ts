import {
  certifyInteractionQuality,
  decideBehavior,
  emptyPersonalityState,
  planExpression,
  voiceDeliveryFromExpression,
} from "@jhadina/core-spine"
import { BOOKIE_OWNER_CONTEXT_HUB, createProductionOwnerContextProvider } from "./production-owner-context-provider"

export interface ExpressionProductionHealthCheck {
  ready: boolean
  detail: string
}

export interface ExpressionProductionHealth {
  status: "READY" | "DEGRADED"
  contractVersion: "JHADINA-EXPRESSION.PROD"
  commitSha: string | null
  environment: string | null
  checks: {
    householdOps: ExpressionProductionHealthCheck
    seriousSuppression: ExpressionProductionHealthCheck
    perceptualInquiry: ExpressionProductionHealthCheck
    semanticInvariant: ExpressionProductionHealthCheck
    ownerContext: ExpressionProductionHealthCheck
    voiceDelivery: ExpressionProductionHealthCheck
    interactionQuality: ExpressionProductionHealthCheck
  }
}

function familiarPersonality() {
  const state = emptyPersonalityState("2026-09-23T00:00:00.000Z")
  return {
    ...state,
    relationship: {
      ...state.relationship!,
      familiarity: 1,
      calibrationConfidence: 1,
      preferredInteractionModes: ["direct", "warm"],
    },
  }
}

function check(ready: boolean, detail: string): ExpressionProductionHealthCheck {
  return { ready, detail }
}

export async function checkExpressionProductionHealth(): Promise<ExpressionProductionHealth> {
  const personality = familiarPersonality()

  const householdDecision = decideBehavior(personality, {
    register: "household-ops",
    operationalContext: true,
    banterEligible: true,
    conversationTemperature: 0.7,
  })
  const household = planExpression(householdDecision)
  const householdOps = check(
    householdDecision.action === "answer_directly" &&
      household.register === "household-ops" &&
      household.operationalSass !== "off" &&
      household.affectionateTeasing === true &&
      household.workloadBoundary === "explicit",
    "Operational familiarity is presentation-only and remains task-competent.",
  )

  const seriousDecision = decideBehavior(personality, {
    serious: true,
    register: "household-ops",
    operationalContext: true,
    banterEligible: true,
    symbolicFramingEligible: true,
    intimacyEligible: true,
  })
  const serious = planExpression(seriousDecision, { register: "household-ops" })
  const seriousSuppression = check(
    seriousDecision.action === "stay_serious" &&
      serious.register === "serious" &&
      serious.allowProfanity === false &&
      serious.allowQuip === false &&
      serious.operationalSass === "off" &&
      serious.affectionateTeasing === false &&
      serious.bitDepth === 0 &&
      serious.symbolicFraming === "off" &&
      serious.evidenceDiscipline === "strict",
    "Serious/high-stakes posture suppresses sass, bits, profanity, and symbolic flourish.",
  )

  const perceptualDecision = decideBehavior(personality, {
    register: "perceptual-inquiry",
    symbolicFramingEligible: true,
    banterEligible: false,
  })
  const perceptual = planExpression(perceptualDecision)
  const perceptualInquiry = check(
    perceptual.register === "perceptual-inquiry" &&
      perceptual.evidenceDiscipline === "strict" &&
      perceptual.symbolicFraming === "interpretive" &&
      perceptual.bitDepth === 0 &&
      perceptual.operationalSass === "off",
    "Altered-perception inquiry preserves interpretive framing under strict evidence discipline.",
  )

  const defaultDecision = decideBehavior(personality, { register: "default" })
  const playfulDecision = decideBehavior(personality, {
    register: "playful",
    banterEligible: true,
  })
  const semanticInvariant = check(
    defaultDecision.action === playfulDecision.action &&
      defaultDecision.posture.directness === playfulDecision.posture.directness &&
      defaultDecision.posture.reasoningDepth === playfulDecision.posture.reasoningDepth,
    "Changing expression register does not change semantic action, directness, or reasoning depth.",
  )

  const owner = await createProductionOwnerContextProvider().getContext({
    userId: "health-probe",
    activeTask: "expression production health",
  })
  const ownerContext = check(
    owner?.hub === BOOKIE_OWNER_CONTEXT_HUB &&
      owner.references.length === 1 &&
      owner.references[0]?.ownerAuthored === true &&
      owner.references[0]?.reuseScope === "context-only" &&
      owner.limitations.some((item) => item.includes("never auto-promoted")),
    "Bookie owner context is present as provenance-aware, context-only evidence.",
  )

  const thresholdDecision = decideBehavior(personality, {
    register: "threshold",
    symbolicFramingEligible: true,
  })
  const threshold = planExpression(thresholdDecision)
  const delivery = voiceDeliveryFromExpression(threshold)
  const voiceDelivery = check(
    threshold.register === "threshold" &&
      threshold.speakingRate === "slow" &&
      delivery.style === "threshold" &&
      typeof delivery.rate === "number" &&
      delivery.rate < 1 &&
      typeof delivery.pauseScale === "number" &&
      delivery.pauseScale > 1,
    "The governed expression directive maps deterministically into provider-neutral voice pacing.",
  )

  const quality = certifyInteractionQuality(personality)
  const interactionQuality = check(
    quality.status === "READY" && quality.gates.every((item) => item.ready),
    `Interaction quality matrix: ${quality.gates.filter((item) => item.ready).length}/${quality.gates.length} governed gates ready.`,
  )

  const checks = {
    householdOps,
    seriousSuppression,
    perceptualInquiry,
    semanticInvariant,
    ownerContext,
    voiceDelivery,
    interactionQuality,
  }
  const ready = Object.values(checks).every((item) => item.ready)

  return {
    status: ready ? "READY" : "DEGRADED",
    contractVersion: "JHADINA-EXPRESSION.PROD",
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    environment: process.env.VERCEL_ENV ?? null,
    checks,
  }
}
