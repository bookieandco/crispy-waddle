import { describe, expect, it } from "vitest"
import {
  buildSideHustleProfile,
  createSideHustleExperiment,
  startSideHustleExperiment,
  type Opportunity,
  type SideHustleEvidenceReceipt,
  type SideHustleExperimentObservation,
} from "@jhadina/opportunity-core"
import {
  ingestSideHustleEvidenceReceipt,
  type SideHustleEvidenceIngestionRepository,
} from "./side-hustle-evidence-ingestion"

const now = "2026-09-22T15:00:00.000Z"

function opportunity(): Opportunity {
  return {
    id: "opportunity:auto-evidence",
    title: "AI discovery audit",
    family: "business",
    type: "commercial",
    sourceUrl: "https://example.test/source",
    sourceName: "Fixture",
    claims: [{
      id: "claim:1",
      field: "discovery",
      value: "fixture",
      sourceId: "source:1",
      sourceType: "user",
      confidence: 0.8,
      verified: false,
    }],
    evidence: [{
      id: "evidence:1",
      sourceId: "source:1",
      sourceUrl: "https://example.test/source",
      sourceName: "Fixture",
      sourceType: "user",
      capturedAt: now,
      confidence: 0.8,
    }],
    verificationStatus: "unverified",
    sourceConfidence: 0.8,
    riskFlags: [],
    metadata: {
      sideHustleProfile: buildSideHustleProfile({ family: "ai_discovery_seo" }),
    },
    status: "discovered",
    createdAt: now,
    updatedAt: now,
  }
}

function runningExperiment() {
  return startSideHustleExperiment(
    createSideHustleExperiment({
      opportunity: opportunity(),
      hypothesis: "A buyer will pay for an audit.",
      targetCustomer: "Local service business",
      channel: "Permissioned outreach",
      offer: "$250 audit",
      maxSpend: 100,
      currency: "USD",
      maxHours: 8,
      maxDurationDays: 14,
      minimumObservations: 2,
      successCriteria: [
        { id: "paid", metric: "paid_commitments", operator: "gte", threshold: 1, aggregation: "sum", unit: "customers" },
        { id: "qualified", metric: "qualified_conversations", operator: "gte", threshold: 3, aggregation: "sum", unit: "conversations" },
      ],
      killCriteria: [
        { id: "blockers", metric: "serious_fit_blockers", operator: "gte", threshold: 3, aggregation: "sum", unit: "blockers" },
      ],
      evidenceRefs: ["research:1"],
      createdAt: now,
    }),
    "2026-09-22T16:00:00.000Z",
  )
}

function receipt(experimentId?: string): SideHustleEvidenceReceipt {
  return {
    id: "growth-side-hustle-evidence:growth-request:1",
    opportunityId: "opportunity:auto-evidence",
    experimentId,
    sourceOwner: "growth",
    sourceRecordType: "allocation_measurement",
    sourceRecordId: "growth-request:1",
    observedAt: "2026-09-22T17:00:00.000Z",
    metrics: {
      paid_commitments: 1,
      qualified_conversations: 2,
      serious_fit_blockers: 0,
    },
    spend: 20,
    hours: 1,
    evidenceRefs: ["growth:attribution:1"],
  }
}

function repository(existing: SideHustleExperimentObservation[] = []) {
  const experiment = runningExperiment()
  const persisted: SideHustleExperimentObservation[] = [...existing]
  const repo: SideHustleEvidenceIngestionRepository = {
    async listSideHustleExperiments(opportunityId) {
      if (opportunityId !== experiment.opportunityId) return []
      return [{ experiment, observations: [...persisted] }]
    },
    async recordSideHustleExperimentObservation(observation) {
      persisted.push(observation)
      return observation
    },
  }
  return { repo, experiment, persisted }
}

describe("ingestSideHustleEvidenceReceipt", () => {
  it("records a correlated source receipt into the running experiment", async () => {
    const { repo, experiment, persisted } = repository()
    const result = await ingestSideHustleEvidenceReceipt(
      receipt(experiment.id),
      repo,
    )

    expect(result.status).toBe("recorded")
    expect(result.experimentId).toBe(experiment.id)
    expect(persisted).toHaveLength(1)
    expect(result.observation.metrics).toEqual({
      paid_commitments: 1,
      qualified_conversations: 2,
      serious_fit_blockers: 0,
    })
  })

  it("resolves the only running experiment when the source omits experimentId", async () => {
    const { repo, experiment } = repository()
    const result = await ingestSideHustleEvidenceReceipt(receipt(), repo)
    expect(result.experimentId).toBe(experiment.id)
  })

  it("deduplicates a deterministic source receipt", async () => {
    const { repo, experiment } = repository()
    const first = await ingestSideHustleEvidenceReceipt(receipt(experiment.id), repo)
    const second = await ingestSideHustleEvidenceReceipt(receipt(experiment.id), repo)

    expect(first.status).toBe("recorded")
    expect(second.status).toBe("duplicate")
    expect(second.observation.id).toBe(first.observation.id)
  })

  it("refuses evidence when no running experiment exists", async () => {
    const repo: SideHustleEvidenceIngestionRepository = {
      async listSideHustleExperiments() { return [] },
      async recordSideHustleExperimentObservation(observation) { return observation },
    }

    await expect(
      ingestSideHustleEvidenceReceipt(receipt(), repo),
    ).rejects.toThrow(/No running Side Hustle experiment/)
  })
})
