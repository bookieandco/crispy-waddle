import { describe, it, expect } from "vitest"
import { SupabaseAuditLedger, type AuditRpcClient } from "@jhadina/action-core"
import { InMemoryLearningRecordRepository, type ContextPacket, type DecisionProposal } from "@jhadina/core-spine"
import { IntelligenceRouter, type ModelProvider } from "@jhadina/intelligence-core"
import type { ActionRequestIdentity, JhadinaActionRequest, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import {
  runGovernedIntelligenceProposal,
  listGovernedIntelligenceActivity,
  type GovernedIntelligenceRuntimeOverrides,
} from "./governed-intelligence-runtime"

function staticIdentityVerifier(identity: ActionRequestIdentity): JhadinaIdentityVerifier {
  return {
    async verify(request: JhadinaActionRequest) {
      if (request.userId !== identity.userId) throw new Error("Action identity mismatch")
      return identity
    },
  }
}

type FakeRow = {
  domain: string
  event_id: string
  request_id: string
  actor_id: string
  capability: string
  status: string
  occurred_at: string
  metadata: Record<string, unknown>
}

class FakeAuditRpcClient implements AuditRpcClient {
  private readonly rows: FakeRow[] = []

  async rpc<T = unknown>(fn: string, args: Record<string, unknown>) {
    if (fn === "append_jhadina_audit_event") {
      this.rows.push({
        domain: args.p_domain as string,
        event_id: args.p_event_id as string,
        request_id: args.p_request_id as string,
        actor_id: args.p_actor_id as string,
        capability: args.p_capability as string,
        status: args.p_status as string,
        occurred_at: args.p_occurred_at as string,
        metadata: (args.p_metadata as Record<string, unknown>) ?? {},
      })
      return { data: null as T | null, error: null }
    }
    if (fn === "list_jhadina_audit_events") {
      const domain = args.p_domain as string
      const actorId = args.p_actor_id as string
      return { data: this.rows.filter((r) => r.domain === domain && r.actor_id === actorId) as T, error: null }
    }
    return { data: null as T | null, error: { message: `Unknown RPC: ${fn}` } }
  }
}

function proposalFor(disposition: DecisionProposal["disposition"], recommendation = "runtime test recommendation"): DecisionProposal {
  return {
    id: "proposal-runtime-1",
    contextId: "ctx-runtime-1",
    disposition,
    recommendation,
    rationale: "runtime composition-root test",
    evidence: [],
    uncertainty: [],
    alternatives: [],
  }
}

function fakeRouterReturning(proposal: DecisionProposal): IntelligenceRouter {
  const provider: ModelProvider = { name: "fake", propose: async () => proposal }
  return new IntelligenceRouter({ primary: provider, fallback: provider })
}

function baseContext(id = "ctx-runtime-1"): ContextPacket {
  return {
    id,
    purpose: "runtime test",
    relevantMemories: [],
    patterns: [],
    personality: { version: 1, traits: [], independentAssessmentRequired: false, updatedAt: new Date().toISOString() },
    knowledge: [],
    constraints: [],
    excludedContext: [],
  }
}

function freshOverrides(
  identity: ActionRequestIdentity,
  router: IntelligenceRouter,
): Required<Pick<GovernedIntelligenceRuntimeOverrides, "identityVerifier" | "ledger" | "router" | "learningRecordRepository">> & { rpc: FakeAuditRpcClient } {
  const rpc = new FakeAuditRpcClient()
  return {
    rpc,
    identityVerifier: staticIdentityVerifier(identity),
    ledger: new SupabaseAuditLedger({ client: rpc, domain: "intelligence" }),
    router,
    learningRecordRepository: new InMemoryLearningRecordRepository(),
  }
}

describe("Intelligence Router — production composition root (Phase 1 Step 3)", () => {
  it("runs the full governed lifecycle through the real composition root and records the completed outcome", async () => {
    const identity: ActionRequestIdentity = { userId: "user-runtime-1", sessionId: "session-runtime-1" }
    const overrides = freshOverrides(identity, fakeRouterReturning(proposalFor("PROCEED")))

    const result = await runGovernedIntelligenceProposal(identity.userId, baseContext(), overrides)

    expect(result.candidate).toBeDefined()
    expect(result.candidate?.content).toBe("runtime test recommendation")

    const activity = await listGovernedIntelligenceActivity(identity.userId, overrides)
    const statuses = activity.events.map((e) => e.status)
    expect(statuses).toContain("started")
    expect(statuses).toContain("completed")
    expect(statuses).not.toContain("denied")

    const records = await overrides.learningRecordRepository.listByCorrelation("ctx-runtime-1")
    expect(records).toHaveLength(1)
    expect(records[0]?.decision.proposalId).toBe("proposal-runtime-1")
    expect(records[0]?.decision.actionRequestId).toBeDefined()
    expect(records[0]?.outcome.status).toBe("success")
    expect(records[0]?.learningUpdate.kind).toBe("create")
  })

  it("an identity-mismatched claim fails closed and never records a learning outcome", async () => {
    const identity: ActionRequestIdentity = { userId: "user-runtime-2", sessionId: "session-runtime-2" }
    const overrides = freshOverrides(identity, fakeRouterReturning(proposalFor("PROCEED")))

    await expect(runGovernedIntelligenceProposal("someone-else", baseContext(), overrides)).rejects.toThrow("Action identity mismatch")

    const activity = await listGovernedIntelligenceActivity(identity.userId, overrides)
    expect(activity.events).toHaveLength(0)
    expect(await overrides.learningRecordRepository.listByDomain("intelligence")).toHaveLength(0)
  })

  it("a DECLINE disposition is durably audited but produces neither a candidate nor a learning outcome", async () => {
    const identity: ActionRequestIdentity = { userId: "user-runtime-3", sessionId: "session-runtime-3" }
    const overrides = freshOverrides(identity, fakeRouterReturning(proposalFor("DECLINE")))

    const result = await runGovernedIntelligenceProposal(identity.userId, baseContext(), overrides)
    expect(result.candidate).toBeUndefined()

    const activity = await listGovernedIntelligenceActivity(identity.userId, overrides)
    expect(activity.events.some((e) => e.metadata?.disposition === "DECLINE")).toBe(true)
    expect(await overrides.learningRecordRepository.listByDomain("intelligence")).toHaveLength(0)
  })

  it("the Activity read boundary scopes strictly to the requesting user", async () => {
    const alice: ActionRequestIdentity = { userId: "user-runtime-4a", sessionId: "s-4a" }
    const bob: ActionRequestIdentity = { userId: "user-runtime-4b", sessionId: "s-4b" }
    const rpc = new FakeAuditRpcClient()
    const aliceOverrides: GovernedIntelligenceRuntimeOverrides = {
      identityVerifier: staticIdentityVerifier(alice),
      ledger: new SupabaseAuditLedger({ client: rpc, domain: "intelligence" }),
      router: fakeRouterReturning(proposalFor("PROCEED", "alice's recommendation")),
      learningRecordRepository: new InMemoryLearningRecordRepository(),
    }
    const bobOverrides: GovernedIntelligenceRuntimeOverrides = {
      identityVerifier: staticIdentityVerifier(bob),
      ledger: new SupabaseAuditLedger({ client: rpc, domain: "intelligence" }),
      router: fakeRouterReturning(proposalFor("PROCEED", "bob's recommendation")),
      learningRecordRepository: new InMemoryLearningRecordRepository(),
    }

    await runGovernedIntelligenceProposal(alice.userId, baseContext("ctx-a"), aliceOverrides)
    await runGovernedIntelligenceProposal(bob.userId, baseContext("ctx-b"), bobOverrides)

    const aliceActivity = await listGovernedIntelligenceActivity(alice.userId, aliceOverrides)
    expect(aliceActivity.events.every((e) => e.userId === alice.userId)).toBe(true)
  })
})
