import { describe, expect, it } from "vitest"
import {
  InMemoryActionLedger,
  InMemoryApprovalReceiptStore,
  type ActionLedger,
  type ActionPolicy,
} from "@jhadina/action-core"
import type { ActionRequestIdentity, JhadinaActionRequest, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import {
  runMemoryMutationGoverned,
  type GovernedMemoryMutationDeps,
  type MemoryMutationAction,
} from "./governed-memory-mutations"

function identityVerifier(identity: ActionRequestIdentity): JhadinaIdentityVerifier {
  return {
    async verify(request: JhadinaActionRequest) {
      if (request.userId !== identity.userId) throw new Error("Action identity mismatch")
      return identity
    },
  }
}

function depsFor(userId: string, ledger: ActionLedger = new InMemoryActionLedger()) {
  const storage = new InMemoryStorage()
  const deps: GovernedMemoryMutationDeps = {
    identityVerifier: identityVerifier({ userId, sessionId: "session-test" }),
    ledger,
    memoryRepo: new MemoryRepository(storage),
    reasoningRepo: new ReasoningEventRepository(storage),
    timelineRepo: new TimelineRepository(storage),
    approvalStore: new InMemoryApprovalReceiptStore(),
  }
  return { storage, deps, ledger }
}

async function pendingCandidate(deps: GovernedMemoryMutationDeps, userId: string, content = "I prefer cinema") {
  const reasoning = await deps.reasoningRepo.create({
    userId,
    userMessage: content,
    observation: { raw: content, extracted: content, timestamp: new Date().toISOString() },
    classification: { type: "PREFERENCE", confidence: 0.95, reasoning: "test" },
    systemResponse: "test",
    confidence: 0.95,
  })
  return deps.memoryRepo.createCandidate({
    userId,
    content,
    type: "PREFERENCE",
    confidence: 0.95,
    reasoningEventId: reasoning.id,
  })
}

const denyPolicy: ActionPolicy<MemoryMutationAction> = {
  async evaluate() { return "deny" },
}

describe("governed memory mutations — kernel convergence", () => {
  it("commits an explicitly approved candidate through policy, approval receipt, executor and audit", async () => {
    const userId = "user-memory-approve"
    const { deps, ledger } = depsFor(userId)
    const candidate = await pendingCandidate(deps, userId)

    const outcome = await runMemoryMutationGoverned(deps, userId, {
      kind: "approve",
      candidateId: candidate.id,
    })

    expect(outcome.result.kind).toBe("approve")
    expect(outcome.approvalReceiptId).toBeDefined()
    expect(await deps.memoryRepo.listPending(userId)).toHaveLength(0)
    expect(await deps.memoryRepo.listApproved(userId)).toHaveLength(1)

    const trail = (ledger as InMemoryActionLedger).list()
    expect(trail.some((event) => event.status === "approval_required")).toBe(true)
    expect(trail.some((event) => event.status === "completed")).toBe(true)
    expect(trail.every((event) => event.userId === userId)).toBe(true)
  })

  it("requires approval for destructive candidate rejection", async () => {
    const userId = "user-memory-reject"
    const { deps, ledger } = depsFor(userId)
    const candidate = await pendingCandidate(deps, userId)

    const outcome = await runMemoryMutationGoverned(deps, userId, {
      kind: "reject",
      candidateId: candidate.id,
    })

    expect(outcome.result.kind).toBe("reject")
    expect(outcome.approvalReceiptId).toBeDefined()
    expect(await deps.memoryRepo.listPending(userId)).toHaveLength(0)
    expect((ledger as InMemoryActionLedger).list().some((event) => event.status === "completed")).toBe(true)
  })

  it("corrects an approved memory append-only through the governed executor", async () => {
    const userId = "user-memory-correct"
    const { deps } = depsFor(userId)
    const candidate = await pendingCandidate(deps, userId)
    const original = await deps.memoryRepo.approve(candidate.id, userId)

    const outcome = await runMemoryMutationGoverned(deps, userId, {
      kind: "correct",
      memoryId: original.id,
      content: "I prefer documentary visuals",
    })

    expect(outcome.result.kind).toBe("correct")
    if (outcome.result.kind !== "correct") throw new Error("wrong result")
    expect(outcome.result.retiredMemoryId).toBe(original.id)
    expect(outcome.result.memory.content).toBe("I prefer documentary visuals")
    expect(outcome.approvalReceiptId).toBeUndefined()
  })

  it("requires approval before retiring a memory from active recall", async () => {
    const userId = "user-memory-forget"
    const { deps } = depsFor(userId)
    const candidate = await pendingCandidate(deps, userId)
    const memory = await deps.memoryRepo.approve(candidate.id, userId)

    const outcome = await runMemoryMutationGoverned(deps, userId, {
      kind: "forget",
      memoryId: memory.id,
    })

    expect(outcome.result.kind).toBe("forget")
    expect(outcome.approvalReceiptId).toBeDefined()
    expect(await deps.memoryRepo.listApproved(userId)).toHaveLength(0)
  })

  it("fails closed on identity mismatch without attributing audit to the spoofed actor", async () => {
    const userId = "user-memory-identity"
    const { deps, ledger } = depsFor(userId)
    const candidate = await pendingCandidate(deps, userId)

    await expect(runMemoryMutationGoverned(deps, "someone-else", {
      kind: "approve",
      candidateId: candidate.id,
    })).rejects.toThrow("Action identity mismatch")

    expect((ledger as InMemoryActionLedger).list()).toHaveLength(0)
    expect(await deps.memoryRepo.listPending(userId)).toHaveLength(1)
  })

  it("fails closed on policy denial before mutation", async () => {
    const userId = "user-memory-policy"
    const { deps, ledger } = depsFor(userId)
    deps.policy = denyPolicy
    const candidate = await pendingCandidate(deps, userId)

    await expect(runMemoryMutationGoverned(deps, userId, {
      kind: "approve",
      candidateId: candidate.id,
    })).rejects.toThrow("Action denied by policy")

    expect(await deps.memoryRepo.listPending(userId)).toHaveLength(1)
    expect((ledger as InMemoryActionLedger).list().some((event) => event.status === "denied")).toBe(true)
  })

  it("enforces ownership again at the handler after identity and policy pass", async () => {
    const ownerId = "user-memory-owner"
    const attackerId = "user-memory-other"
    const storage = new InMemoryStorage()
    const ownerDeps: GovernedMemoryMutationDeps = {
      identityVerifier: identityVerifier({ userId: ownerId, sessionId: "owner-session" }),
      ledger: new InMemoryActionLedger(),
      memoryRepo: new MemoryRepository(storage),
      reasoningRepo: new ReasoningEventRepository(storage),
      timelineRepo: new TimelineRepository(storage),
      approvalStore: new InMemoryApprovalReceiptStore(),
    }
    const candidate = await pendingCandidate(ownerDeps, ownerId)
    const attackerLedger = new InMemoryActionLedger()
    const attackerDeps: GovernedMemoryMutationDeps = {
      ...ownerDeps,
      identityVerifier: identityVerifier({ userId: attackerId, sessionId: "attacker-session" }),
      ledger: attackerLedger,
      approvalStore: new InMemoryApprovalReceiptStore(),
    }

    await expect(runMemoryMutationGoverned(attackerDeps, attackerId, {
      kind: "approve",
      candidateId: candidate.id,
    })).rejects.toThrow("User not authorized")

    expect(await ownerDeps.memoryRepo.listPending(ownerId)).toHaveLength(1)
    expect(attackerLedger.list().some((event) => event.status === "failed")).toBe(true)
  })

  it("does not mutate when durable audit admission fails", async () => {
    const userId = "user-memory-audit-fail"
    const failingLedger: ActionLedger = {
      async append() { throw new Error("DURABLE_AUDIT_APPEND_FAILED:test") },
    }
    const { deps } = depsFor(userId, failingLedger)
    const candidate = await pendingCandidate(deps, userId)

    await expect(runMemoryMutationGoverned(deps, userId, {
      kind: "approve",
      candidateId: candidate.id,
    })).rejects.toThrow("DURABLE_AUDIT_APPEND_FAILED")

    expect(await deps.memoryRepo.listPending(userId)).toHaveLength(1)
    expect(await deps.memoryRepo.listApproved(userId)).toHaveLength(0)
  })
})
