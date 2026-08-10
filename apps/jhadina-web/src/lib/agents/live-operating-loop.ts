import type { JanetService } from "../services/JanetService"
import type { ApprovedContext, AgentAuditSink, DeliaStrategyProvider, MarisaExecutionProvider } from "./agent-loop"
import { JhadinaOperatingLoop } from "./agent-loop"

/**
 * Runtime composition for the governed agent path.
 * JANET remains the source of approved context; DELIA plans; MARISA prepares
 * execution. External side effects remain behind the Action Executor/Safeguard.
 */
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

  return new JhadinaOperatingLoop(
    janetProvider,
    input.delia,
    input.marisa,
    input.audit,
  )
}

export type LiveApprovedContext = ApprovedContext
