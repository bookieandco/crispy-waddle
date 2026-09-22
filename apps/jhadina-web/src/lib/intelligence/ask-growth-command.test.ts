import { describe, expect, it } from "vitest"
import type { GrowthIntelligenceReadRepository } from "../growth/intelligence-read-repository"
import { ProductionGrowthContextProvider } from "../context/production-growth-context-provider"
import {
  handleAskGrowthReadCommand,
  inspectAskGrowthReadIntent,
} from "./ask-growth-command"

function repository(): GrowthIntelligenceReadRepository {
  return {
    listCampaigns: async () => [
      {
        id: "campaign-1",
        user_id: "user-1",
        brand_id: "brand:pupsonstuff",
        name: "PupsonStuff Meta Sales",
        objective: "sales",
        channel: "meta",
        provider: "markifact",
        provider_account_id: "provider-account-1",
        audience_ids: ["aud-1"],
        creative_ids: ["creative-1"],
        currency: "USD",
        daily_budget_minor: 5000,
        lifetime_budget_minor: null,
        starts_at: null,
        ends_at: null,
        approval_receipt_id: null,
        status: "pending_approval",
        provider_campaign_id: null,
        last_error: null,
        created_at: "2026-09-22T08:00:00.000Z",
        updated_at: "2026-09-22T09:00:00.000Z",
      },
      {
        id: "campaign-2",
        user_id: "user-1",
        brand_id: "brand:atwood-bookie",
        name: "Atwood TikTok",
        objective: "awareness",
        channel: "tiktok",
        provider: "markifact",
        provider_account_id: "provider-account-2",
        audience_ids: [],
        creative_ids: ["creative-2"],
        currency: "USD",
        daily_budget_minor: 2500,
        lifetime_budget_minor: null,
        starts_at: null,
        ends_at: null,
        approval_receipt_id: "receipt-2",
        status: "delivered",
        provider_campaign_id: "provider-campaign-2",
        last_error: null,
        created_at: "2026-09-21T08:00:00.000Z",
        updated_at: "2026-09-22T11:00:00.000Z",
      },
    ],
    listAudiences: async () => [{
      id: "aud-1",
      user_id: "user-1",
      brand_id: "brand:pupsonstuff",
      name: "Pet purchase intent",
      kind: "intent",
      status: "active",
      created_at: "2026-09-21T00:00:00.000Z",
      updated_at: "2026-09-22T10:00:00.000Z",
    }],
    listApprovals: async () => [{
      id: "receipt-1",
      user_id: "user-1",
      campaign_id: "campaign-1",
      action_id: "action-1",
      type: "paid-ad.publish",
      status: "pending",
      requested_at: "2026-09-22T09:00:00.000Z",
      approved_at: null,
      expires_at: "2026-09-23T09:00:00.000Z",
      consumed_at: null,
    }],
    listOutbox: async () => [],
    listObservations: async () => [{
      id: "obs-2",
      user_id: "user-1",
      campaign_id: "campaign-2",
      source: "provider",
      observed_at: "2026-09-22T11:30:00.000Z",
      metrics: { impressions: 4000, clicks: 100 },
      confidence: 0.9,
      created_at: "2026-09-22T11:31:00.000Z",
      observation_key: "obs-2",
    }],
    listLifecycleProposals: async () => [],
  }
}

function provider() {
  return new ProductionGrowthContextProvider({
    repository: repository(),
    now: () => new Date("2026-09-22T12:00:00.000Z"),
  })
}

describe("Ask Jhadina Growth read command", () => {
  it("recognizes read-only campaign queries", () => {
    expect(inspectAskGrowthReadIntent("Show me my Meta campaigns")?.operation).toBe("list_campaigns")
    expect(inspectAskGrowthReadIntent("Which paid campaigns need attention?")?.operation).toBe("campaign_attention")
    expect(inspectAskGrowthReadIntent("What is awaiting paid ad approval?")?.operation).toBe("pending_work")\n    expect(inspectAskGrowthReadIntent("How are the campaigns performing?")?.operation).toBe("performance")
  })

  it("does not intercept mutating paid-media requests", () => {
    expect(inspectAskGrowthReadIntent("Launch a Meta campaign for PupsonStuff")).toBeNull()
    expect(inspectAskGrowthReadIntent("Increase the Meta campaign budget to $100")).toBeNull()
    expect(inspectAskGrowthReadIntent("Approve the pending paid ad")).toBeNull()
    expect(inspectAskGrowthReadIntent("Which campaign should I run next?")).toBeNull()
    expect(inspectAskGrowthReadIntent("Recommend a Meta campaign strategy")).toBeNull()
  })

  it("does not intercept unrelated Ask requests", () => {
    expect(inspectAskGrowthReadIntent("What is Jhadina's personality like?")).toBeNull()
    expect(inspectAskGrowthReadIntent("Show me the metadata for this file")).toBeNull()
    expect(inspectAskGrowthReadIntent("How is overall system performance?")).toBeNull()
  })

  it("returns authenticated campaign state without creating authority", async () => {
    const result = await handleAskGrowthReadCommand({
      userId: "user-1",
      activeTask: "Show me my paid campaigns",
    }, { provider: provider() })

    expect(result?.workPlan.authority).toBe("READ_ONLY")
    expect(result?.workPlan.campaigns).toHaveLength(2)
    expect(result?.proposal.recommendation).toContain("2 durable paid campaign")
    expect(result?.proposal.evidence.some((ref) => ref.id === "growth-campaign:campaign-1")).toBe(true)
    expect(result?.verificationReason).toContain("no external or financial action")
  })

  it("scopes campaign reads by channel and brand", async () => {
    const meta = await handleAskGrowthReadCommand({
      userId: "user-1",
      activeTask: "Show me my Meta campaigns",
    }, { provider: provider() })
    expect(meta?.workPlan.campaigns.map((ref) => ref.id)).toEqual(["growth-campaign:campaign-1"])

    const pups = await handleAskGrowthReadCommand({
      userId: "user-1",
      activeTask: "Show me PupsonStuff campaigns",
    }, { provider: provider() })
    expect(pups?.workPlan.campaigns.map((ref) => ref.id)).toEqual(["growth-campaign:campaign-1"])
  })

  it("surfaces pending approval as evidence but never as granted permission", async () => {
    const result = await handleAskGrowthReadCommand({
      userId: "user-1",
      activeTask: "What is awaiting paid ad approval?",
    }, { provider: provider() })

    expect(result?.workPlan.operation).toBe("pending_work")
    expect(result?.proposal.evidence.some((ref) => ref.id === "growth-approval:receipt-1")).toBe(true)
    expect(result?.proposal.evidence.find((ref) => ref.id === "growth-approval:receipt-1")?.summary)
      .toContain("authority=receipt-specific-only")
    expect(result?.workPlan.notes.join(" ")).toContain("No paid-ad approval receipt was created, approved, consumed, or widened")
  })

  it("ranks pending approval campaign ahead of healthy delivered campaign", async () => {
    const result = await handleAskGrowthReadCommand({
      userId: "user-1",
      activeTask: "Which campaigns need attention?",
    }, { provider: provider() })

    expect(result?.proposal.evidence[0]?.id).toBe("growth-attention:campaign-1")
    expect(result?.proposal.recommendation).toContain("PupsonStuff Meta Sales")
  })
})
