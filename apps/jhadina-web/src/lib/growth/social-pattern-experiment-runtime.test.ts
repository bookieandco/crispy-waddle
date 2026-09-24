import { describe, expect, it } from "vitest"
import type {
  PatternExperimentEvidence,
  PatternExperimentEvidenceStore,
  SocialPatternPromotionRecord,
  SocialPatternPromotionStore,
} from "@jhadina/growth-core"
import { planPatternExperiment, createPatternHypothesis } from "@jhadina/growth-core"
import type { GrowthId } from "@jhadina/growth-core"
import { runSocialPatternExperiment } from "./social-pattern-experiment-runtime"

function fixture() {
  const hypothesis = createPatternHypothesis({
    pattern: {
      id: "pattern:source" as GrowthId,
      accountId: "account:source" as GrowthId,
      audienceId: "audience:source" as GrowthId,
      strategy: "hook" as never,
      confidence: 0.9,
    } as never,
    targetAccountId: "account:target" as GrowthId,
    targetAudienceId: "audience:target" as GrowthId,
    targetVoiceId: "voice:target" as GrowthId,
  })!
  const experiment = planPatternExperiment(hypothesis)
  return { hypothesis, experiment }
}

function stores() {
  const evidence = new Map<string, PatternExperimentEvidence>()
  const promotions = new Map<string, SocialPatternPromotionRecord>()

  const evidenceStore: PatternExperimentEvidenceStore = {
    async getByExecutionId(id) { return evidence.get(id) ?? null },
    async put(value) {
      const existing = evidence.get(value.executionId)
      if (existing && JSON.stringify(existing) !== JSON.stringify(value)) throw new Error("evidence conflict")
      evidence.set(value.executionId, value)
    },
  }
  const promotionStore: SocialPatternPromotionStore = {
    async getById(id) { return promotions.get(id) ?? null },
    async listForAccount(accountId) { return [...promotions.values()].filter((p) => p.targetAccountId === accountId) },
    async upsert(value) { promotions.set(value.id, value) },
    async revoke(id, revokedAt, reason) {
      const current = promotions.get(id)
      if (!current) throw new Error("promotion not found")
      promotions.set(id, { ...current, status: "revoked", revokedAt, revocationReason: reason })
    },
  }
  return { evidenceStore, promotionStore, evidence, promotions }
}

describe("runSocialPatternExperiment", () => {
  it("persists execution evidence before evaluating and promoting", async () => {
    const { hypothesis, experiment } = fixture()
    const runtime = stores()

    const result = await runSocialPatternExperiment(experiment, hypothesis, {
      executionId: "execution:1" as GrowthId,
      experimentId: experiment.id,
      hypothesisId: experiment.hypothesisId,
      targetAccountId: experiment.targetAccountId,
      targetAudienceId: experiment.targetAudienceId,
      targetVoiceId: experiment.targetVoiceId,
      successMetric: experiment.successMetric,
      controlMetric: 0.1,
      treatmentMetric: 0.12,
      controlObservations: 15,
      treatmentObservations: 15,
      observedAt: "2026-09-01T12:00:00.000Z",
    }, runtime)

    expect(result?.evaluation.winner).toBe("treatment")
    expect(runtime.evidence.has("execution:1")).toBe(true)
    expect(result?.promotion?.targetAccountId).toBe("account:target")
  })

  it("rejects a report that attempts to rewrite the planned target", async () => {
    const { hypothesis, experiment } = fixture()
    const runtime = stores()

    await expect(runSocialPatternExperiment(experiment, hypothesis, {
      executionId: "execution:attacker" as GrowthId,
      experimentId: experiment.id,
      hypothesisId: experiment.hypothesisId,
      targetAccountId: "account:attacker" as GrowthId,
      targetAudienceId: experiment.targetAudienceId,
      targetVoiceId: experiment.targetVoiceId,
      successMetric: experiment.successMetric,
      controlMetric: 0.1,
      treatmentMetric: 0.12,
      controlObservations: 15,
      treatmentObservations: 15,
      observedAt: "2026-09-01T12:00:00.000Z",
    }, runtime)).rejects.toThrow("invalid pattern experiment execution report")

    expect(runtime.evidence.size).toBe(0)
    expect(runtime.promotions.size).toBe(0)
  })
})
