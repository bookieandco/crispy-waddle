import { describe, expect, it } from "vitest"
import type {
  SocialAccount,
  SocialObservation,
  SocialOutboxJob,
  SocialPublicationProposal,
} from "@jhadina/social-core"
import type { SocialRepository } from "../social/repository"
import { ProductionSocialContextProvider } from "./production-social-context-provider"

const accounts: SocialAccount[] = [
  {
    id: "acct-1",
    userId: "user-1",
    brand: "pupsonstuff",
    provider: "hootsuite",
    providerProfileId: "profile-1",
    platform: "instagram",
    displayName: "PupsonStuff Instagram",
    handle: "pupsonstuff",
    status: "connected",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-22T10:00:00.000Z",
  },
]

const proposals: SocialPublicationProposal[] = [{
  id: "proposal-1",
  userId: "user-1",
  actionId: "action-1",
  brand: "pupsonstuff",
  text: "Draft",
  mediaUrls: [],
  targets: [{
    accountId: "acct-1",
    brand: "pupsonstuff",
    provider: "hootsuite",
    providerProfileId: "profile-1",
    platform: "instagram",
  }],
  status: "pending_approval",
  requestFingerprint: "fp-1",
  idempotencyKey: "idem-1",
  approvalReceiptId: "receipt-1",
  createdAt: "2026-09-22T10:00:00.000Z",
  updatedAt: "2026-09-22T10:00:00.000Z",
}]

const outbox: SocialOutboxJob[] = []

const observations: SocialObservation[] = [{
  id: "obs-1",
  userId: "user-1",
  brand: "pupsonstuff",
  kind: "performance",
  source: "provider",
  provider: "hootsuite",
  platform: "instagram",
  accountId: "acct-1",
  providerProfileId: "profile-1",
  contentId: "content-1",
  observedAt: "2026-09-22T11:30:00.000Z",
  evidence: ["provider:analytics:1"],
  metrics: { views: 500, clicks: 25 },
}]

function repository(): SocialRepository {
  return {
    listAccounts: async () => accounts,
    listProposals: async () => proposals,
    listOutbox: async () => outbox,
    listObservations: async () => observations,
  } as unknown as SocialRepository
}

describe("Production Social context provider", () => {
  it("projects authenticated accounts, characters, work, performance and attention as read-only evidence", async () => {
    const provider = new ProductionSocialContextProvider({
      repository: repository(),
      now: () => new Date("2026-09-22T12:00:00.000Z"),
    })

    const context = await provider.getContext({
      userId: "user-1",
      activeTask: "Which PupsonStuff account needs attention?",
    })

    expect(context?.accounts[0]?.summary).toContain("PupsonStuff Instagram")
    expect(context?.characters.some((ref) => ref.id === "character:pupsonstuff")).toBe(true)
    expect(context?.pendingWork.some((ref) => ref.id === "social-proposal:proposal-1")).toBe(true)
    expect(context?.performance[0]?.summary).toContain("views=500")
    expect(context?.attention[0]?.summary).toContain("publication proposal(s) awaiting approval")
    expect(context?.provenance.some((ref) => ref.id === "social-context:character-profiles")).toBe(true)
  })

  it("degrades honestly when repository reads fail instead of inventing empty healthy state", async () => {
    const broken = {
      listAccounts: async () => { throw new Error("down") },
      listProposals: async () => { throw new Error("down") },
      listOutbox: async () => { throw new Error("down") },
      listObservations: async () => { throw new Error("down") },
    } as unknown as SocialRepository

    const provider = new ProductionSocialContextProvider({
      repository: broken,
      now: () => new Date("2026-09-22T12:00:00.000Z"),
    })

    const context = await provider.getContext({
      userId: "user-1",
      activeTask: "social status",
    })

    expect(context?.accounts).toEqual([])
    expect(context?.uncertainty).toContain("No connected social accounts are visible to the authenticated user.")
    expect(context?.limitations).toEqual(expect.arrayContaining([
      "social accounts unavailable for this request",
      "social proposals unavailable for this request",
      "social outbox unavailable for this request",
      "social observations unavailable for this request",
    ]))
  })
})
