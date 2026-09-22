import { describe, expect, it } from "vitest"
import type { GrowthIntelligenceReadRepository } from "../growth/intelligence-read-repository"
import { ProductionGrowthContextProvider } from "./production-growth-context-provider"

function repository(): GrowthIntelligenceReadRepository {
  return {
    listCampaigns: async () => [
      {
        id: "campaign-failed",
        user_id: "user-1",
        brand_id: "brand:pupsonstuff",
        name: "PupsonStuff Meta Test",
        objective: "sales",
        channel: "meta",
        provider: "markifact",
        provider_account_id: "provider-account-private",
        audience_ids: ["aud-1"],
        creative_ids: ["creative-1"],
        currency: "USD",
        daily_budget_minor: 5000,
        lifetime_budget_minor: 25000,
        starts_at: null,
        ends_at: null,
        approval_receipt_id: "receipt-1",
        status: "failed",
        provider_campaign_id: "provider-campaign-1",
        last_error: "provider rejected request",
        created_at: "2026-09-21T00:00:00.000Z",
        updated_at: "2026-09-22T10:00:00.000Z",
      },
      {
        id: "campaign-active",
        user_id: "user-1",
        brand_id: "brand:atwood-bookie",
        name: "Atwood Awareness",
        objective: "awareness",
        channel: "tiktok",
        provider: "markifact",
        provider_account_id: "provider-account-private-2",
        audience_ids: [],
        creative_ids: ["creative-2"],
        currency: "USD",
        daily_budget_minor: 2000,
        lifetime_budget_minor: null,
        starts_at: null,
        ends_at: null,
        approval_receipt_id: "receipt-2",
        status: "delivered",
        provider_campaign_id: "provider-campaign-2",
        last_error: null,
        created_at: "2026-09-20T00:00:00.000Z",
        updated_at: "2026-09-22T11:00:00.000Z",
      },
    ],
    listAudiences: async () => [{
      id: "aud-1",
      user_id: "user-1",
      brand_id: "brand:pupsonstuff",
      name: "High intent pet buyers",
      kind: "intent",
      status: "active",
      created_at: "2026-09-20T00:00:00.000Z",
      updated_at: "2026-09-22T09:00:00.000Z",
    }],
    listApprovals: async () => [{
      id: "receipt-1",
      user_id: "user-1",
      campaign_id: "campaign-failed",
      action_id: "action-1",
      type: "paid-ad.publish",
      status: "pending",
      requested_at: "2026-09-22T09:00:00.000Z",
      approved_at: null,
      expires_at: "2026-09-23T09:00:00.000Z",
      consumed_at: null,
    }],
    listOutbox: async () => [{
      id: "outbox-1",
      user_id: "user-1",
      campaign_id: "campaign-failed",
      provider: "markifact",
      channel: "meta",
      provider_account_id: "provider-account-private",
      operation_intent: "create_paused_campaign",
      status: "failed",
      attempt_count: 1,
      provider_operation_id: null,
      provider_campaign_id: null,
      last_error: "provider rejected request",
      created_at: "2026-09-22T09:30:00.000Z",
      updated_at: "2026-09-22T10:00:00.000Z",
    }],
    listObservations: async () => [{
      id: "obs-1",
      user_id: "user-1",
      campaign_id: "campaign-active",
      source: "provider",
      observed_at: "2026-09-22T11:30:00.000Z",
      metrics: { impressions: 10000, clicks: 250, nested: { secret: true } },
      confidence: 0.9,
      created_at: "2026-09-22T11:31:00.000Z",
      observation_key: "obs-key-1",
    }],
    listLifecycleProposals: async () => [{
      id: "life-1",
      user_id: "user-1",
      action: "retarget",
      channel: "instagram",
      rationale: "Recent high-intent site visitors did not purchase.",
      status: "pending_approval",
      requires_approval: true,
      created_at: "2026-09-22T10:30:00.000Z",
      updated_at: "2026-09-22T10:30:00.000Z",
    }],
  }
}

describe("Production Growth context provider", () => {
  it("projects durable Growth state as read-only evidence and ranks exceptions first", async () => {
    const provider = new ProductionGrowthContextProvider({
      repository: repository(),
      now: () => new Date("2026-09-22T12:00:00.000Z"),
    })

    const context = await provider.getContext({
      userId: "user-1",
      activeTask: "Which paid campaigns need attention and what is their performance?",
    })

    expect(context?.campaigns).toHaveLength(2)
    expect(context?.campaigns[0]?.summary).toContain("dailyBudget=USD 50.00")
    expect(context?.audiences[0]?.summary).toContain("High intent pet buyers")
    expect(context?.pendingWork.some((ref) => ref.id === "growth-approval:receipt-1")).toBe(true)
    expect(context?.pendingWork.some((ref) => ref.id === "growth-lifecycle:life-1")).toBe(true)
    expect(context?.performance[0]?.summary).toContain("clicks=250")
    expect(context?.performance[0]?.summary).not.toContain("secret")
    expect(context?.attention[0]?.id).toBe("growth-attention:campaign-failed")
    expect(context?.attention[0]?.summary).toContain("failed/ambiguous paid outbox job")
    expect(context?.provenance.some((ref) => ref.id === "growth-context:privacy-boundary")).toBe(true)
  })

  it("does not read Growth tables for an unrelated Ask request", async () => {
    let reads = 0
    const guarded = {
      listCampaigns: async () => { reads += 1; return [] },
      listAudiences: async () => { reads += 1; return [] },
      listApprovals: async () => { reads += 1; return [] },
      listOutbox: async () => { reads += 1; return [] },
      listObservations: async () => { reads += 1; return [] },
      listLifecycleProposals: async () => { reads += 1; return [] },
    } satisfies GrowthIntelligenceReadRepository

    const provider = new ProductionGrowthContextProvider({ repository: guarded })
    const context = await provider.getContext({
      userId: "user-1",
      activeTask: "What is on my calendar tomorrow?",
    })

    expect(context).toBeUndefined()
    expect(reads).toBe(0)
  })

  it("degrades honestly when Growth reads are unavailable", async () => {
    const broken = {
      listCampaigns: async () => { throw new Error("down") },
      listAudiences: async () => { throw new Error("down") },
      listApprovals: async () => { throw new Error("down") },
      listOutbox: async () => { throw new Error("down") },
      listObservations: async () => { throw new Error("down") },
      listLifecycleProposals: async () => { throw new Error("down") },
    } satisfies GrowthIntelligenceReadRepository

    const provider = new ProductionGrowthContextProvider({
      repository: broken,
      now: () => new Date("2026-09-22T12:00:00.000Z"),
    })
    const context = await provider.getContext({
      userId: "user-1",
      activeTask: "Show me my growth campaign status",
    })

    expect(context?.campaigns).toEqual([])
    expect(context?.limitations).toEqual(expect.arrayContaining([
      "growth campaigns unavailable for this request",
      "growth audiences unavailable for this request",
      "growth approvals unavailable for this request",
      "growth outbox unavailable for this request",
      "growth performance observations unavailable for this request",
      "growth lifecycle proposals unavailable for this request",
    ]))
  })
})
