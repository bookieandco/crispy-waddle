import { describe, expect, it } from "vitest"
import {
  InMemoryActionLedger,
  type ActionPolicy,
} from "@jhadina/action-core"
import type { JhadinaIdentityVerifier } from "@/lib/auth/supabase-identity-verifier"
import type { ResearchProvider } from "../../../../../packages/jhadina-research-core/src/research-executor.js"
import type {
  ResearchRuntimeRepository,
} from "../../../../../packages/jhadina-research-core/src/runtime-repository.js"
import {
  executeResearchRunGoverned,
  type ResearchRunAction,
} from "./governed-research-run"
import type { ResearchExecutionAuthorityRepository } from "./research-execution-authority-repository"

function identity(userId = "00000000-0000-0000-0000-000000000123"): JhadinaIdentityVerifier {
  return {
    async verify(request = {}) {
      if (request.userId && request.userId !== userId) throw new Error("Action identity mismatch")
      return { userId, sessionId: "session-1" }
    },
  }
}

function runtime(): ResearchRuntimeRepository {
  return {
    async loadPlan(planId) {
      return {
        id: planId,
        intentId: "intent-1",
        planVersion: 1,
        tasks: [],
        budget: { maxCost: 1, maxRisk: 1 },
        status: "approved",
      }
    },
    async claimExecution(input) {
      return {
        planId: input.planId,
        policyDecisionId: input.policyDecisionId,
        leaseId: "lease-1",
        leaseToken: "token-1",
        workerId: input.workerId,
        expiresAt: "2099-01-01T00:00:00.000Z",
      }
    },
    async renewExecutionLease(admission) { return admission },
    async reserveProviderSubmission() { return undefined },
    async acknowledgeProviderSubmission() { return undefined },
    async markProviderRecoveryRequired() { return false },
    async commitExecutionEvent() { return { accepted: true, stopped: false } },
    async captureEvidence() { return undefined },
    async releaseExecution() { return true },
  }
}

const provider: ResearchProvider = {
  id: "unused-provider",
  async execute() {
    throw new Error("provider must not run when the plan has no ready task")
  },
}

describe("governed research ActionExecutor integration", () => {
  it("cannot mint research authority before ActionExecutor records started", async () => {
    const ledger = new InMemoryActionLedger()
    let authorityCalls = 0
    const authority: ResearchExecutionAuthorityRepository = {
      async authorize(input) {
        authorityCalls += 1
        const started = ledger.list().some((event) =>
          event.actionId === input.requestId &&
          event.userId === input.actorId &&
          event.type === "research.run" &&
          event.status === "started"
        )
        return started ? "execution-receipt-1" : undefined
      },
    }

    const result = await executeResearchRunGoverned(
      {
        identityVerifier: identity(),
        ledger,
        authority,
        runtimeRepository: runtime(),
        provider,
      },
      "00000000-0000-0000-0000-000000000123",
      {
        planId: "plan-1",
        policyDecisionId: "decision-1",
        workerId: "worker-1",
      },
      { requestId: "research-request-1" },
    )

    expect(result.result).toEqual({ status: "no_ready_task" })
    expect(authorityCalls).toBe(1)
    expect(ledger.list().map((event) => event.status)).toEqual(["started", "completed"])
  })

  it("policy denial prevents authority minting and runtime execution", async () => {
    const ledger = new InMemoryActionLedger()
    let authorityCalls = 0
    let runtimeLoads = 0
    const authority: ResearchExecutionAuthorityRepository = {
      async authorize() {
        authorityCalls += 1
        return "should-not-exist"
      },
    }
    const deniedRuntime = runtime()
    const originalLoad = deniedRuntime.loadPlan
    deniedRuntime.loadPlan = async (planId) => {
      runtimeLoads += 1
      return originalLoad(planId)
    }
    const denyPolicy: ActionPolicy<ResearchRunAction> = {
      async evaluate() { return "deny" },
    }

    await expect(executeResearchRunGoverned(
      {
        identityVerifier: identity(),
        ledger,
        authority,
        runtimeRepository: deniedRuntime,
        provider,
        policy: denyPolicy,
      },
      "00000000-0000-0000-0000-000000000123",
      {
        planId: "plan-1",
        policyDecisionId: "decision-1",
        workerId: "worker-1",
      },
      { requestId: "research-request-denied" },
    )).rejects.toThrow(/Action denied/)

    expect(authorityCalls).toBe(0)
    expect(runtimeLoads).toBe(0)
    expect(ledger.list().map((event) => event.status)).toEqual(["started", "denied"])
  })

  it("identity mismatch stops before ActionExecutor and before authority", async () => {
    const ledger = new InMemoryActionLedger()
    let authorityCalls = 0
    const authority: ResearchExecutionAuthorityRepository = {
      async authorize() {
        authorityCalls += 1
        return "should-not-exist"
      },
    }

    await expect(executeResearchRunGoverned(
      {
        identityVerifier: identity("00000000-0000-0000-0000-000000000123"),
        ledger,
        authority,
        runtimeRepository: runtime(),
        provider,
      },
      "00000000-0000-0000-0000-000000000999",
      {
        planId: "plan-1",
        policyDecisionId: "decision-1",
        workerId: "worker-1",
      },
    )).rejects.toThrow(/identity mismatch/i)

    expect(authorityCalls).toBe(0)
    expect(ledger.list()).toHaveLength(0)
  })
})
