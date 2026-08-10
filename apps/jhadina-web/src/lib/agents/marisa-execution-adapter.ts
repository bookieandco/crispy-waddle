import type { MarisaExecutionProvider, StrategyPacket } from './agent-loop'

/**
 * MARISA's runtime boundary. It prepares a governed execution request but does not
 * perform external side effects; Safeguard/Action Executor remains the execution gate.
 */
export class MarisaExecutionAdapter implements MarisaExecutionProvider {
  async prepareExecution(strategy: StrategyPacket): Promise<{
    executionId: string
    status: 'READY' | 'BLOCKED'
    strategyId: string
  }> {
    const executionId = `execution:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    const status = strategy.objective.trim() && strategy.recommendations.length > 0 ? 'READY' : 'BLOCKED'

    return {
      executionId,
      status,
      strategyId: strategy.strategyId,
    }
  }
}
