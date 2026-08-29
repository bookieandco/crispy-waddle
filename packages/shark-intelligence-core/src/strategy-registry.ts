import type { SharkOpportunityDecision } from './index.js'

export type SharkStrategyDefinition = {
  strategyId: string
  version: string
  description: string
  featureNames: string[]
  createdAt: string
}

export type SharkDecisionRecord = {
  decisionId: string
  opportunityId: string
  strategyId: string
  strategyVersion: string
  featureSet: Record<string, number>
  reasoning: string[]
  decision: SharkOpportunityDecision
  recordedAt: string
}

export class SharkStrategyRegistry {
  private readonly strategies = new Map<string, SharkStrategyDefinition>()
  private readonly decisions = new Map<string, SharkDecisionRecord>()

  registerStrategy(definition: SharkStrategyDefinition): void {
    if (!definition.strategyId || !definition.version) throw new Error('strategyId and version are required')
    if (this.strategies.has(definition.strategyId)) throw new Error(`strategy already registered: ${definition.strategyId}`)
    this.strategies.set(definition.strategyId, { ...definition, featureNames: [...definition.featureNames] })
  }

  recordDecision(
    strategyId: string,
    decision: SharkOpportunityDecision,
    featureSet: Record<string, number>,
    reasoning: string[],
  ): SharkDecisionRecord {
    const strategy = this.strategies.get(strategyId)
    if (!strategy) throw new Error(`unknown strategy: ${strategyId}`)
    if (this.decisions.has(decision.id)) throw new Error(`decision already recorded: ${decision.id}`)

    for (const feature of strategy.featureNames) {
      const value = featureSet[feature]
      if (!Number.isFinite(value)) throw new Error(`missing feature: ${feature}`)
    }

    const record: SharkDecisionRecord = {
      decisionId: decision.id,
      opportunityId: decision.opportunityId,
      strategyId,
      strategyVersion: strategy.version,
      featureSet: { ...featureSet },
      reasoning: [...reasoning],
      decision,
      recordedAt: new Date().toISOString(),
    }
    this.decisions.set(record.decisionId, record)
    return record
  }

  getStrategy(strategyId: string): SharkStrategyDefinition | undefined {
    const strategy = this.strategies.get(strategyId)
    return strategy ? { ...strategy, featureNames: [...strategy.featureNames] } : undefined
  }

  getDecision(decisionId: string): SharkDecisionRecord | undefined {
    const record = this.decisions.get(decisionId)
    return record
      ? { ...record, featureSet: { ...record.featureSet }, reasoning: [...record.reasoning] }
      : undefined
  }

  listDecisions(strategyId?: string): SharkDecisionRecord[] {
    return [...this.decisions.values()]
      .filter((record) => strategyId === undefined || record.strategyId === strategyId)
      .map((record) => ({ ...record, featureSet: { ...record.featureSet }, reasoning: [...record.reasoning] }))
  }
}
