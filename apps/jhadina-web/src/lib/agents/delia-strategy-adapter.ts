import type { ApprovedContext, DeliaStrategyProvider, StrategyPacket } from './agent-loop'

/**
 * Concrete DELIA boundary used by the web runtime.
 * Strategy generation is deliberately deterministic at this layer; an LLM/research
 * provider can be injected later without changing the JANET -> DELIA contract.
 */
export class DeliaStrategyAdapter implements DeliaStrategyProvider {
  async createStrategy(input: {
    userId: string
    objective: string
    context: ApprovedContext
  }): Promise<StrategyPacket> {
    const recommendations: string[] = []
    if (input.context.sourceMemoryIds.length > 0) {
      recommendations.push('Use approved JANET context as the governing personal context for this objective.')
    } else {
      recommendations.push('Proceed without personal-memory assumptions; gather evidence before committing.')
    }

    const codebase = input.context.codebase as { relevantPaths?: string[]; relationships?: string[] } | undefined
    if (codebase?.relevantPaths?.length) {
      recommendations.push(`Inspect ${codebase.relevantPaths.length} relevant codebase paths before implementation.`)
    }
    if (codebase?.relationships?.length) {
      recommendations.push(`Preserve ${codebase.relationships.length} discovered code relationships during the change.`)
    }

    const strategyId = `strategy:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    return {
      strategyId,
      userId: input.userId,
      objective: input.objective,
      contextMemoryIds: input.context.sourceMemoryIds,
      recommendations,
      createdAt: new Date().toISOString(),
    }
  }
}
