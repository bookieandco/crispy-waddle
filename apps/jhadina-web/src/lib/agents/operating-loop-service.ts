import { JanetService } from '../services/JanetService'
import { DeliaStrategyAdapter } from './delia-strategy-adapter'
import { MarisaExecutionAdapter } from './marisa-execution-adapter'
import { InMemoryAgentAuditSink, JhadinaOperatingLoop } from './agent-loop'

/**
 * Composition root for the JANET -> DELIA -> MARISA path.
 * The JanetService remains the source of governed context; DELIA and MARISA are
 * concrete adapters behind the existing loop contracts.
 */
export function createJhadinaOperatingLoop(deps: {
  janet: JanetService
  audit?: InMemoryAgentAuditSink
}) {
  const audit = deps.audit ?? new InMemoryAgentAuditSink()
  const loop = new JhadinaOperatingLoop(
    deps.janet,
    new DeliaStrategyAdapter(),
    new MarisaExecutionAdapter(),
    audit,
  )

  return { loop, audit }
}
