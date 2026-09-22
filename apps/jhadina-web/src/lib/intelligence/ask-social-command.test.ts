import { describe, expect, it } from "vitest"
import type {
  SocialAccount,
  SocialObservation,
  SocialOutboxJob,
  SocialPublicationProposal,
} from "@jhadina/social-core"
import type { SocialRepository } from "../social/repository"
import {
  handleAskSocialCommand,
  inspectAskSocialIntent,
} from "./ask-social-command"

const accounts: SocialAccount[] = [
  {
    id: "acct-atwood-ig",
    userId: "user-1",
    brand: "atwood-bookie",
    provider: "hootsuite",
    providerProfileId: "provider-atwood-ig",
    platform: "instagram",
    displayName: "Atwood Bookie IG",
    handle: "atwoodbookie",
    status: "connected",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  },
  {
    id: "acct-atwood-tiktok",
    userId: "user-1",
    brand: "atwood-bookie",
    provider: "ayrshare",
    providerProfileId: "provider-atwood-tt",
    platform: "tiktok",
    displayName: "Atwood Bookie TikTok",
    handle: "atwoodbookie",
    status: "connected",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  },
  {
    id: "acct-pups-ig",
    userId: "user-1",
    brand: "pupsonstuff",
    provider: "hootsuite",
    providerProfileId: "provider-pups-ig",
    platform: "instagram",
    displayName: "PupsonStuff Instagram",
    handle: "pupsonstuff",
    status: "connected",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  },
]

const proposals: SocialPublicationProposal[] = [
  {
    id: "proposal-pups",
    userId: "user-1",
    actionId: "action-pups",
    brand: "pupsonstuff",
    text: "Draft",
    mediaUrls: [],
    targets: [{
      accountId: "acct-pups-ig",
      brand: "pupsonstuff",
      provider: "hootsuite",
      providerProfileId: "provider-pups-ig",
      platform: "instagram",
    }],
    status: "pending_approval",
    requestFingerprint: "fp-pups",
    idempotencyKey: "idem-pups",
    approvalReceiptId: "receipt-pups",
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
  },
]

const outbox: SocialOutboxJob[] = [
  {
    id: "outbox-atwood",
    proposalId: "proposal-atwood",
    userId: "user-1",
    actionId: "action-atwood",
    target: {
      accountId: "acct-atwood-ig",
      brand: "atwood-bookie",
      provider: "hootsuite",
      providerProfileId: "provider-atwood-ig",
      platform: "instagram",
    },
    text: "post",
    mediaUrls: [],
    status: "failed",
    idempotencyKey: "outbox-idem",
    attemptCount: 1,
    lastError: "provider unavailable",
    createdAt: "2026-09-22T10:00:00.000Z",
    updatedAt: "2026-09-22T10:05:00.000Z",
  },
]

const observations: SocialObservation[] = [
  {
    id: "obs-atwood-tt",
    userId: "user-1",
    brand: "atwood-bookie",
    kind: "performance",
    source: "provider",
    provider: "ayrshare",
    platform: "tiktok",
    accountId: "acct-atwood-tiktok",
    providerProfileId: "provider-atwood-tt",
    contentId: "content-1",
    observedAt: "2026-09-22T11:00:00.000Z",
    evidence: ["provider:analytics:1"],
    metrics: { views: 1000, clicks: 40 },
  },
]

function repository(): SocialRepository {
  return {
    listAccounts: async (userId: string) => accounts.filter((account) => account.userId === userId),
    listProposals: async () => proposals,
    listOutbox: async () => outbox,
    listObservations: async () => observations,
  } as unknown as SocialRepository
}

describe("Ask Jhadina Social command resolver", () => {
  it("does not hijack a question about Jhadina's learned personality", () => {
    expect(inspectAskSocialIntent("What is Jhadina's personality like?")).toBeNull()
  })

  it("does route an explicit public Jhadina social-character request", () => {
    const intent = inspectAskSocialIntent("Use the Jhadina character voice for our social content")
    expect(intent?.requestedBrand).toBe("jhadina")
  })

  it("lists governed character personalities without granting execution authority", async () => {
    const result = await handleAskSocialCommand({
      userId: "user-1",
      activeTask: "Show me the character personalities I can use on social",
    }, {
      repository: repository(),
      now: () => new Date("2026-09-22T12:00:00.000Z"),
    })

    expect(result?.workPlan.operation).toBe("list_characters")
    expect(result?.workPlan.availableCharacters?.some((profile) => profile.label === "Atwood Bookie")).toBe(true)
    expect(result?.workPlan.authority).toBe("READ_ONLY")
    expect(result?.proposal.disposition).toBe("PROCEED")
  })

  it("ranks real connected accounts by operational attention evidence", async () => {
    const result = await handleAskSocialCommand({
      userId: "user-1",
      activeTask: "Which social accounts should I work on right now?",
    }, {
      repository: repository(),
      now: () => new Date("2026-09-22T12:00:00.000Z"),
    })

    expect(result?.workPlan.operation).toBe("account_attention")
    expect(result?.workPlan.accounts[0]?.accountId).toBe("acct-atwood-ig")
    expect(result?.workPlan.accounts[0]?.attentionReasons).toContain("1 failed/ambiguous delivery job(s)")
    expect(result?.proposal.recommendation).toContain("Atwood Bookie IG")
  })

  it("resolves a named character and requested real platforms", async () => {
    const result = await handleAskSocialCommand({
      userId: "user-1",
      activeTask: "Use the Atwood Bookie personality on Instagram and TikTok",
    }, {
      repository: repository(),
      now: () => new Date("2026-09-22T12:00:00.000Z"),
    })

    expect(result?.workPlan.operation).toBe("select_character_accounts")
    expect(result?.workPlan.character?.id).toBe("character:atwood-bookie")
    expect(result?.workPlan.accounts.map((account) => account.accountId).sort()).toEqual([
      "acct-atwood-ig",
      "acct-atwood-tiktok",
    ])
    expect(result?.workPlan.requiresExplicitApprovalForExecution).toBe(false)
  })

  it("fails closed when an explicit handle is not connected", async () => {
    const result = await handleAskSocialCommand({
      userId: "user-1",
      activeTask: "Use the Atwood Bookie personality on @doesnotexist Instagram",
    }, {
      repository: repository(),
      now: () => new Date("2026-09-22T12:00:00.000Z"),
    })

    expect(result?.proposal.disposition).toBe("ASK")
    expect(result?.proposal.recommendation).toContain("could not resolve")
    expect(result?.proposal.alternatives.length).toBeGreaterThan(0)
  })

  it("recognizes social video production before generic Director video routing", () => {
    const intent = inspectAskSocialIntent(
      "Make a TikTok video for PupsonStuff using the PupsonStuff personality",
    )

    expect(intent?.operation).toBe("produce_creative")
    expect(intent?.requestedBrand).toBe("pupsonstuff")
    expect(intent?.requestedPlatforms).toEqual(["tiktok"])
  })

  it("keeps paid campaigns planning-only and approval-bound", async () => {
    const result = await handleAskSocialCommand({
      userId: "user-1",
      activeTask: "Run a Meta ad campaign for PupsonStuff on Instagram with a $50 daily budget",
    }, {
      repository: repository(),
      now: () => new Date("2026-09-22T12:00:00.000Z"),
    })

    expect(result?.workPlan.operation).toBe("paid_campaign")
    expect(result?.workPlan.nextBoundary).toBe("growth_paid_media")
    expect(result?.workPlan.authority).toBe("PLANNING_ONLY")
    expect(result?.workPlan.requiresExplicitApprovalForExecution).toBe(true)
  })
})
