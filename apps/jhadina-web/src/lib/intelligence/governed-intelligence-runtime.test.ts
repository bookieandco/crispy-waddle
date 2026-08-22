import { describe, it, expect } from "vitest"
import { SupabaseAuditLedger, type AuditRpcClient } from "@jhadina/action-core"
import type { ContextPacket, DecisionProposal } from "@jhadina/core-spine"
import { IntelligenceRouter, type ModelProvider } from "@jhadina/intelligence-core"
import type { ActionRequestIdentity, JhadinaActionRequest, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import {
  runGovernedIntelligenceProposal,
  listGovernedIntelligenceActivity,
  type GovernedIntelligenceRuntimeOverrides,
} from "./governed-intelligence-runtime"

/**
 * Exercises the real production composition root (runGovernedIntelligenceProposal /
 * listGovernedIntelligenceActivity) against a fake RPC client modeling the
 * actual append_jhadina_audit_event / list_jhadina_audit_events migration's
 * behavior — same pattern growth/governed-approval-runtime.test.ts already
 * established. createRequestIdentityVerifier(), the real Supabase client, and
 * the real AnthropicModelProvider have no meaning in a test process, so all
 * three are overridden; production always uses the real ones (getStorage()
 * is not overridden — this deliberately shares the same storage singleton
 * production routes use).
 */
function staticIdentityVerifier(identity: ActionRequestIdentity): JhadinaIdentityVerifier {
  return {
    async verify(request: JhadinaActionRequest) {
      if (request.userId !== identity.userId) {
        throw new Error("Action identity mismatch")
      }
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
      const rows = this.rows.filter((r) => r.domain === domain && r.actor_id === actorId)
      return { data: rows as T, error: null }
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
): Required<Pick<GovernedIntelligenceRuntimeOverrides, "identityVerifier" | "ledger" | "router">> & { rpc: FakeAuditRpcClient } {
  const rpc = new FakeAuditRpcClient()
  return {
    rpc,
    identityVerifier: staticIdentityVerifier(identity),
    ledger: new SupabaseAuditLedger({ client: rpc, domain: "intelligence" }),
    router,
  }
}

describe("Intelligence Router — production composition root (Phase 1 Step 3)", () => {
  it("runs the full governed lifecycle through the real composition root and durably records it", async () => {
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
  })

  it("an identity-mismatched claim fails closed and never appears in the real user's own activity", async () => {
    const identity: ActionRequestIdentity = { userId: "user-runtime-2", sessionId: "session-runtime-2" }
    const overrides = freshOverrides(identity, fakeRouterReturning(proposalFor("PROCEED")))

    await expect(
      runGovernedIntelligenceProposal("someone-else", baseContext(), overrides),
    ).rejects.toThrow("Action identity mismatch")

    const activity = await listGovernedIntelligenceActivity(identity.userId, overrides)
    expect(activity.events).toHaveLength(0)
  })

  it("a DECLINE disposition is durably recorded but produces no candidate", async () => {
    const identity: ActionRequestIdentity = { userId: "user-runtime-3", sessionId: "session-runtime-3" }
    const overrides = freshOverrides(identity, fakeRouterReturning(proposalFor("DECLINE")))

    const result = await runGovernedIntelligenceProposal(identity.userId, baseContext(), overrides)
    expect(result.candidate).toBeUndefined()

    const activity = await listGovernedIntelligenceActivity(identity.userId, overrides)
    expect(activity.events.some((e) => e.metadata?.disposition === "DECLINE")).toBe(true)
  })

  it("the Activity read boundary scopes strictly to the requesting user, same as Growth/Money", async () => {
    const alice: ActionRequestIdentity = { userId: "user-runtime-4a", sessionId: "s-4a" }
    const bob: ActionRequestIdentity = { userId: "user-runtime-4b", sessionId: "s-4b" }
    const rpc = new FakeAuditRpcClient()
    const aliceOverrides: GovernedIntelligenceRuntimeOverrides = {
      identityVerifier: staticIdentityVerifier(alice),
      ledger: new SupabaseAuditLedger({ client: rpc, domain: "intelligence" }),
      router: fakeRouterReturning(proposalFor("PROCEED", "alice's recommendation")),
    }
    const bobOverrides: GovernedIntelligenceRuntimeOverrides = {
      identityVerifier: staticIdentityVerifier(bob),
      ledger: new SupabaseAuditLedger({ client: rpc, domain: "intelligence" }),
      router: fakeRouterReturning(proposalFor("PROCEED", "bob's recommendation")),
    }

    await runGovernedIntelligenceProposal(alice.userId, baseContext("ctx-a"), aliceOverrides)
    await runGovernedIntelligenceProposal(bob.userId, baseContext("ctx-b"), bobOverrides)

    const aliceActivity = await listGovernedIntelligenceActivity(alice.userId, aliceOverrides)
    expect(aliceActivity.events.every((e) => e.userId === alice.userId)).toBe(true)
  })
})
