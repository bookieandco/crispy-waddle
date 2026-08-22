import { describe, it, expect } from "vitest"
import {
  ActionExecutor,
  InMemoryApprovalReceiptStore,
  SupabaseAuditLedger,
  createBaseSecurityCoreActionPolicy,
  type ActionPolicy,
  type ActionPolicyDecision,
  type ActionRequest,
  type AuditRpcClient,
} from "@jhadina/action-core"
import type { DecisionProposal } from "@jhadina/core-spine"
import { IntelligenceRouter, type ModelProvider } from "@jhadina/intelligence-core"
import type { ActionRequestIdentity, JhadinaActionRequest, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { getStorage } from "../routes/handlers"
import { createMemoryProposeHandler, MEMORY_PROPOSE_CAPABILITY, type MemoryProposeAction } from "./memory-propose-capability"
import { handleJhadinaCommand, type JhadinaCommandOverrides } from "./jhadina-command"

/**
 * Phase 1 Step 5 integration tests — proves the complete governed loop
 * (Observe -> Remember -> Understand -> Decide -> Authorize -> Act ->
 * Verify -> Learn) end to end, using the real Context Builder (Step 4)
 * and the real IntelligenceRouter (Step 3). No test in this file sets
 * ANTHROPIC_API_KEY or SUPABASE_SERVICE_ROLE_KEY, and none needs to:
 * every test supplies a fake identity verifier, a fake-RPC-backed
 * SupabaseAuditLedger (same class, real shape, no network), and an
 * explicit router built from fake ModelProviders — the real production
 * defaults (createRequestIdentityVerifier, createIntelligenceAuditLedger,
 * createProductionIntelligenceRouter) are never reached from a test.
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
  readonly rows: FakeRow[] = []

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

/** A ledger that always fails to append — models a durable-audit outage. */
class AlwaysFailingAuditRpcClient implements AuditRpcClient {
  async rpc<T = unknown>() {
    return { data: null as T | null, error: { message: "AUDIT_STORE_UNREACHABLE" } }
  }
}

function proposalFor(disposition: DecisionProposal["disposition"], overrides: Partial<DecisionProposal> = {}): DecisionProposal {
  return {
    id: "proposal-step5",
    contextId: "unused", // IntelligenceRouter/handleJhadinaCommand supplies the real context id; providers below read it from `context.id` where relevant.
    disposition,
    recommendation: "I prefer cinematic visuals",
    rationale: "explicit preference statement",
    evidence: [],
    uncertainty: [],
    alternatives: [],
    ...overrides,
  }
}

function providerReturning(proposal: DecisionProposal): ModelProvider {
  return { name: "fake-primary", propose: async () => proposal }
}

function providerThatFails(): ModelProvider {
  return {
    name: "fake-failing",
    propose: async () => {
      throw new Error("provider down")
    },
  }
}

function alwaysDenyPolicy(): ActionPolicy<MemoryProposeAction> {
  return { async evaluate(): Promise<ActionPolicyDecision> { return "deny" } }
}

function alwaysApprovalRequiredPolicy(): ActionPolicy<MemoryProposeAction> {
  return { async evaluate(): Promise<ActionPolicyDecision> { return "approval_required" } }
}

function freshOverrides(
  identity: ActionRequestIdentity,
  router: IntelligenceRouter,
  extra: Partial<JhadinaCommandOverrides> = {},
): JhadinaCommandOverrides & { rpc: FakeAuditRpcClient } {
  const rpc = new FakeAuditRpcClient()
  return {
    identityVerifier: staticIdentityVerifier(identity),
    ledger: new SupabaseAuditLedger({ client: rpc, domain: "intelligence" }),
    router,
    approvalStore: new InMemoryApprovalReceiptStore(),
    rpc,
    ...extra,
  }
}

/** Creates and approves a memory through the real Step 2 governed flow, so test 10 can prove real memory retrieval (not a fake). */
async function approveMemory(userId: string, content: string): Promise<void> {
  const storage = getStorage()
  const memoryRepo = new MemoryRepository(storage)
  const reasoningRepo = new ReasoningEventRepository(storage)
  const reasoningEvent = await reasoningRepo.create({
    userId,
    userMessage: content,
    observation: { raw: content, extracted: content, timestamp: new Date().toISOString() },
    classification: { type: "CONTEXT", confidence: 0.9 },
    systemResponse: "noted",
    confidence: 0.9,
  })
  const candidate = await memoryRepo.createCandidate({
    userId,
    content,
    type: "CONTEXT",
    confidence: 0.9,
    reasoningEventId: reasoningEvent.id,
  })
  await memoryRepo.approve(candidate.id, userId)
}

describe("Jhadina Command — the instantiated operating loop (Phase 1 Step 5)", () => {
  it("1. a valid memory.propose request traverses Context -> Router -> Policy -> Approval -> Executor -> Audit", async () => {
    const identity: ActionRequestIdentity = { userId: "user-step5-1", sessionId: "s-1" }
    const router = new IntelligenceRouter({ primary: providerReturning(proposalFor("PROCEED")), fallback: providerThatFails() })
    const overrides = freshOverrides(identity, router)

    const result = await handleJhadinaCommand({ userId: identity.userId, activeTask: "note my preference" }, overrides)

    expect(result.candidate).toBeDefined()
    expect(result.candidate?.status).toBe("PENDING")
    expect(result.verified).toBe(true)

    const trail = overrides.rpc.rows.filter((r) => r.actor_id === identity.userId)
    const statuses = trail.map((r) => r.status)
    expect(statuses).toContain("started")
    expect(statuses).toContain("completed")
    expect(trail.every((r) => r.capability === MEMORY_PROPOSE_CAPABILITY)).toBe(true)
  })

  it("2. a proposal requiring approval cannot execute without a valid approval receipt (the real ActionExecutor enforces this directly)", async () => {
    const storage = getStorage()
    const memoryRepo = new MemoryRepository(storage)
    const reasoningRepo = new ReasoningEventRepository(storage)
    const policy = alwaysApprovalRequiredPolicy()
    const ledger = new SupabaseAuditLedger({ client: new FakeAuditRpcClient(), domain: "intelligence" })
    const handler = createMemoryProposeHandler(memoryRepo, reasoningRepo)
    // No approvalReceipts verifier supplied and no approvalReceiptId attached
    // to the request — exactly "requires approval, but none was obtained."
    const executor = new ActionExecutor(policy, ledger, [handler])
    const request: ActionRequest<MemoryProposeAction> = {
      id: "no-receipt-1",
      userId: "user-step5-2",
      type: MEMORY_PROPOSE_CAPABILITY,
      action: { content: "should not be saved", rationale: "test", confidence: 0.9 },
      requestedAt: new Date().toISOString(),
    }

    await expect(executor.execute(request)).rejects.toThrow(`Approval required: ${MEMORY_PROPOSE_CAPABILITY}`)
    expect(await memoryRepo.listPending("user-step5-2")).toHaveLength(0)
  })

  it("3 & 4. a valid approval receipt is consumed exactly once — replaying it fails", async () => {
    const identity: ActionRequestIdentity = { userId: "user-step5-3", sessionId: "s-3" }
    const router = new IntelligenceRouter({ primary: providerReturning(proposalFor("PROCEED")), fallback: providerThatFails() })
    const overrides = { ...freshOverrides(identity, router), policy: alwaysApprovalRequiredPolicy() }

    const result = await handleJhadinaCommand({ userId: identity.userId, activeTask: "note my preference" }, overrides)
    expect(result.approvalReceiptId).toBeDefined()
    expect(result.candidate).toBeDefined()

    // Replaying the same receipt id against the same store must fail —
    // it was already consumed by the ActionExecutor call above.
    const replayed = await overrides.approvalStore!.consume(result.approvalReceiptId as string, {
      actionId: "different-action-id",
      userId: identity.userId,
      type: MEMORY_PROPOSE_CAPABILITY,
      fingerprint: `memory-propose:${result.candidate?.content}`,
    })
    expect(replayed).toBe(false)
  })

  it("5 & 6. a model proposal with forged capability/approval/execution fields cannot elevate authority — the audit record only ever shows the application-owned capability", async () => {
    const identity: ActionRequestIdentity = { userId: "user-step5-5", sessionId: "s-5" }
    const forged = {
      ...proposalFor("PROCEED"),
      capability: "financial.execute",
      approved: true,
      executeNow: true,
      approvalReceiptId: "forged-receipt-xyz",
      permissions: ["admin", "*"],
    } as unknown as DecisionProposal
    const router = new IntelligenceRouter({ primary: providerReturning(forged), fallback: providerThatFails() })
    const overrides = freshOverrides(identity, router)

    const result = await handleJhadinaCommand({ userId: identity.userId, activeTask: "note my preference" }, overrides)

    expect(result.candidate).toBeDefined()
    const trail = overrides.rpc.rows.filter((r) => r.actor_id === identity.userId)
    expect(trail.length).toBeGreaterThan(0)
    expect(trail.every((r) => r.capability === MEMORY_PROPOSE_CAPABILITY)).toBe(true)
    expect(trail.some((r) => r.capability === "financial.execute")).toBe(false)
  })

  it("7. policy denial prevents execution", async () => {
    const identity: ActionRequestIdentity = { userId: "user-step5-7", sessionId: "s-7" }
    const router = new IntelligenceRouter({ primary: providerReturning(proposalFor("PROCEED")), fallback: providerThatFails() })
    const overrides = { ...freshOverrides(identity, router), policy: alwaysDenyPolicy() }

    await expect(
      handleJhadinaCommand({ userId: identity.userId, activeTask: "note my preference" }, overrides),
    ).rejects.toThrow(`Action denied by policy: ${MEMORY_PROPOSE_CAPABILITY}`)

    const storage = getStorage()
    expect(await new MemoryRepository(storage).listPending(identity.userId)).toHaveLength(0)
  })

  it("8. audit failure prevents successful completion — fails closed rather than silently succeeding", async () => {
    const identity: ActionRequestIdentity = { userId: "user-step5-8", sessionId: "s-8" }
    const router = new IntelligenceRouter({ primary: providerReturning(proposalFor("PROCEED")), fallback: providerThatFails() })
    const failingLedger = new SupabaseAuditLedger({ client: new AlwaysFailingAuditRpcClient(), domain: "intelligence" })
    const overrides = { ...freshOverrides(identity, router), ledger: failingLedger }

    await expect(
      handleJhadinaCommand({ userId: identity.userId, activeTask: "note my preference" }, overrides),
    ).rejects.toThrow(/DURABLE_AUDIT_APPEND_FAILED/)

    const storage = getStorage()
    expect(await new MemoryRepository(storage).listPending(identity.userId)).toHaveLength(0)
  })

  it("9. the resulting observation reaches Memory Core as a candidate but never automatically becomes durable approved memory", async () => {
    const identity: ActionRequestIdentity = { userId: "user-step5-9", sessionId: "s-9" }
    const router = new IntelligenceRouter({ primary: providerReturning(proposalFor("PROCEED")), fallback: providerThatFails() })
    const overrides = freshOverrides(identity, router)

    const result = await handleJhadinaCommand({ userId: identity.userId, activeTask: "note my preference" }, overrides)

    expect(result.candidate?.status).toBe("PENDING")
    const storage = getStorage()
    const memoryRepo = new MemoryRepository(storage)
    expect(await memoryRepo.listApproved(identity.userId)).toHaveLength(0)
    expect(await memoryRepo.listPending(identity.userId)).toHaveLength(1)
  })

  it("10 & 11. context is produced by the real Step 4 Context Builder (not a hand-built fake) and consumed by the real IntelligenceRouter", async () => {
    const identity: ActionRequestIdentity = { userId: "user-step5-10", sessionId: "s-10" }
    await approveMemory(identity.userId, "I prefer cinematic visuals in every video edit")

    let capturedContextId: string | undefined
    let capturedRelevantMemoryCount = 0
    const capturingProvider: ModelProvider = {
      name: "capturing-provider",
      propose: async (context) => {
        capturedContextId = context.id
        capturedRelevantMemoryCount = context.relevantMemories.length
        return proposalFor("PROCEED", { contextId: context.id })
      },
    }
    // The real IntelligenceRouter class — not a hand-rolled substitute —
    // with only its providers faked.
    const router = new IntelligenceRouter({ primary: capturingProvider, fallback: providerThatFails() })
    const overrides = freshOverrides(identity, router)

    await handleJhadinaCommand(
      { userId: identity.userId, activeTask: "what visuals style should I use for this video?" },
      overrides,
    )

    // A hand-built fake context would never contain a real, previously-
    // approved memory's content — this can only be non-zero if buildContext()
    // genuinely queried MemoryRepository and found a relevant match.
    expect(capturedRelevantMemoryCount).toBeGreaterThan(0)
    expect(capturedContextId).toMatch(/^ctx_/) // context-builder.ts's real id prefix, not a test fixture's id
  })

  it("verifies the executed action's durable effect and records a distinct verify audit stage", async () => {
    const identity: ActionRequestIdentity = { userId: "user-step5-verify", sessionId: "s-verify" }
    const router = new IntelligenceRouter({ primary: providerReturning(proposalFor("PROCEED")), fallback: providerThatFails() })
    const overrides = freshOverrides(identity, router)

    const result = await handleJhadinaCommand({ userId: identity.userId, activeTask: "note my preference" }, overrides)

    expect(result.verified).toBe(true)
    const verifyEvents = overrides.rpc.rows.filter((r) => r.metadata?.stage === "verify")
    expect(verifyEvents).toHaveLength(1)
    expect(verifyEvents[0].status).toBe("completed")
  })

  it("a disposition that never executes an action is trivially verified, not silently skipped", async () => {
    const identity: ActionRequestIdentity = { userId: "user-step5-ask", sessionId: "s-ask" }
    const router = new IntelligenceRouter({ primary: providerReturning(proposalFor("ASK")), fallback: providerThatFails() })
    const overrides = freshOverrides(identity, router)

    const result = await handleJhadinaCommand({ userId: identity.userId, activeTask: "note my preference" }, overrides)

    expect(result.candidate).toBeUndefined()
    expect(result.verified).toBe(true)
    expect(result.verificationReason).toContain("no action was executed")
  })

  it("recognizes memory.propose's real base-policy outcome (allow) end to end with no policy override", async () => {
    const identity: ActionRequestIdentity = { userId: "user-step5-basepolicy", sessionId: "s-bp" }
    const router = new IntelligenceRouter({ primary: providerReturning(proposalFor("PROCEED")), fallback: providerThatFails() })
    // freshOverrides() never sets `policy` — this exercises
    // decideAndProposeMemoryGoverned's real createBaseSecurityCoreActionPolicy() default.
    const overrides = freshOverrides(identity, router)

    const result = await handleJhadinaCommand({ userId: identity.userId, activeTask: "note my preference" }, overrides)

    expect(result.candidate).toBeDefined()
    const policy = createBaseSecurityCoreActionPolicy<MemoryProposeAction>()
    const decision = await policy.evaluate({
      id: "check",
      userId: identity.userId,
      type: MEMORY_PROPOSE_CAPABILITY,
      action: { content: "x", rationale: "y", confidence: 0.9 },
      requestedAt: new Date().toISOString(),
    })
    expect(decision).toBe("allow")
  })
})
