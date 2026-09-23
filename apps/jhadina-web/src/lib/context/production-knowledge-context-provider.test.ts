import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const rpc = vi.fn()
  const createServiceRoleClient = vi.fn()
  return { rpc, createServiceRoleClient }
})

vi.mock("../supabase/service-role", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}))

import { createProductionKnowledgeContextProvider } from "./production-knowledge-context-provider"

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "knowledge-1",
  owner_id: "11111111-1111-1111-1111-111111111111",
  scope: "personal",
  knowledge_type: "fact",
  subject: "Jhadina personality runtime",
  predicate: "uses",
  claim: "Jhadina personality uses the Real Nigga Core before expression.",
  object_json: { value: "rnc" },
  confidence: 0.95,
  verification_state: "verified",
  authority_score: 0.9,
  freshness_score: 0.9,
  freshness_state: "fresh",
  observed_at: "2026-09-22T12:00:00.000Z",
  valid_from: null,
  valid_until: null,
  superseded_by: null,
  lexical_score: 0.8,
  evidence: [
    { id: "e-1", verificationState: "verified", authorityScore: 0.9, freshnessState: "fresh" },
    { id: "e-2", verificationState: "verified", authorityScore: 0.8, freshnessState: "fresh" },
  ],
  ...overrides,
})

describe("Production Knowledge context provider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createServiceRoleClient.mockReturnValue({ rpc: mocks.rpc })
  })

  it("queries the canonical K-1.5 RPC with verified owner scope and returns ranked evidence", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [row()], error: null })
    const provider = createProductionKnowledgeContextProvider()

    const context = await provider.getContext({
      userId: "11111111-1111-1111-1111-111111111111",
      activeTask: "How does Jhadina personality use the Real Nigga Core?",
    })

    expect(mocks.rpc).toHaveBeenCalledWith(
      "jhadina_query_knowledge",
      expect.objectContaining({
        p_query: "How does Jhadina personality use the Real Nigga Core?",
        p_owner_id: "11111111-1111-1111-1111-111111111111",
        p_scope: null,
        p_limit: 24,
        p_require_verified: false,
      }),
    )
    expect(context.knowledge).toHaveLength(1)
    expect(context.knowledge[0]).toEqual(expect.objectContaining({
      id: "knowledge-1",
      source: "knowledge-core",
      immutable: false,
    }))
    expect(context.knowledge[0]?.summary).toContain("true_now")
  })

  it("preserves stale/unverified and contradictory knowledge as limitations instead of truth", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [
        row(),
        row({
          id: "knowledge-2",
          claim: "Jhadina personality bypasses the Real Nigga Core.",
          object_json: { value: "bypass" },
          verification_state: "unverified",
          freshness_state: "stale",
          evidence: [],
        }),
      ],
      error: null,
    })
    const provider = createProductionKnowledgeContextProvider()
    const context = await provider.getContext({
      userId: "11111111-1111-1111-1111-111111111111",
      activeTask: "Jhadina personality Real Nigga Core",
    })

    expect(context.limitations.some((item) => item.includes("contradictory admissible knowledge"))).toBe(true)
    expect(context.limitations.some((item) => item.includes("temporally uncertain"))).toBe(true)
  })

  it("redacts secret-like text before Knowledge becomes model context", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [row({ claim: "API setup for Jhadina sk_test_abcdefghijklmnop personality runtime" })],
      error: null,
    })
    const provider = createProductionKnowledgeContextProvider()
    const context = await provider.getContext({
      userId: "11111111-1111-1111-1111-111111111111",
      activeTask: "Jhadina personality API setup",
    })

    expect(context.knowledge[0]?.summary).toContain("[REDACTED]")
    expect(context.knowledge[0]?.summary).not.toContain("sk_test_abcdefghijklmnop")
  })

  it("fails closed when the canonical Knowledge runtime is not configured", async () => {
    mocks.createServiceRoleClient.mockReturnValue(null)
    const provider = createProductionKnowledgeContextProvider()
    const context = await provider.getContext({
      userId: "11111111-1111-1111-1111-111111111111",
      activeTask: "anything",
    })

    expect(context.knowledge).toEqual([])
    expect(context.limitations).toContain("canonical Knowledge runtime is not configured")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
