import type { JanetService } from "../services/JanetService"
import type { ApprovedContext, AgentAuditSink, DeliaStrategyProvider, MarisaExecutionProvider } from "./agent-loop"
import { JhadinaOperatingLoop } from "./agent-loop"
import { MarisaActionExecutor } from "./marisa-action-executor"
import type { ActionExecutor } from "../../../../packages/jhadina-action-core/src/action-executor"
import type { VerifiedActionExecutor } from "../../../../packages/jhadina-action-core/src/verified-action-executor"

export function createLiveJhadinaOperatingLoop(input: {
  janet: JanetService
  delia: DeliaStrategyProvider
  marisa: MarisaExecutionProvider
  audit: AgentAuditSink
}) {
  const janetProvider = {
    getContext: (userId: string) => input.janet.getContext(userId),
    getApprovedMemoryIds: (userId: string) => input.janet.getApprovedMemoryIds(userId),
    getAgentContext: (userId: string, objective?: string) =>
      input.janet.getAgentContext(userId, objective),
  }

  return new JhadinaOperatingLoop(janetProvider, input.delia, input.marisa, input.audit)
}

/**
 * Composition-root adapter: MARISA delegates side effects to the already
 * verified Jhadina executor. The concrete executor must be constructed with
 * the application's real identity verifier, policy, ledger, and handlers.
 */
export function createMarisaExecutionProvider(executor: VerifiedActionExecutor<unknown, unknown>): MarisaExecutionProvider {
  const governed = new MarisaActionExecutor(executor as unknown as ActionExecutor<unknown, unknown>)

  return {
    prepareExecution: async (strategy) => {
      const request = {
        id: strategy.strategyId,
        userId: strategy.userId,
        type: "DELIA_STRATEGY_EXECUTION",
        action: strategy,
        requestedAt: new Date().toISOString(),
      }

      try {
        await governed.execute(request)
        return {
          executionId: request.id,
          strategyId: strategy.strategyId,
          status: "EXECUTED",
        }
      } catch (error) {
        return {
          executionId: request.id,
          strategyId: strategy.strategyId,
          status: "FAILED",
        }
      }
    },
  }
}

export type LiveApprovedContext = ApprovedContext
