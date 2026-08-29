import { describe, expect, it } from 'vitest'
import { SharkStrategyRegistry } from './strategy-registry.js'
import type { SharkOpportunityDecision } from './index.js'

function decision(overrides: Partial<SharkOpportunityDecision> = {}): SharkOpportunityDecision {
  return {
    id: 'decision-1', opportunityId: 'opp-1', kind: 'market', decision: 'candidate', confidence: 0.8,
    risks: [], evidence: [], streetSignals: [], sourceQuality: 0.8, novelty: 0, repeatability: 0,
    policy: { policyPassed: false, authorizationRequired: true, authorized: false, executionPermitted: false },
    decidedAt: '2026-01-01T00:00:00.000Z', ...overrides,
  }
}

function registry(): SharkStrategyRegistry {
  const registry = new SharkStrategyRegistry()
  registry.registerStrategy({ strategyId: 'strategy-1', version: '1', description: 'test', featureNames: ['signal'], createdAt: '2026-01-01T00:00:00.000Z' })
  return registry
}

describe('Shark strategy registry safety contract', () => {
  it('records valid candidate decisions', () => {
    const record = registry().recordDecision('strategy-1', decision(), { signal: 1 }, ['validated'])
    expect(record.decision.decision).toBe('candidate')
  })

  it('records human-review decisions without treating them as authorization', () => {
    const record = registry().recordDecision('strategy-1', decision({ decision: 'needs_human_review' }), { signal: 1 }, ['review required'])
    expect(record.decision.policy.authorizationRequired).toBe(true)
    expect(record.decision.policy.authorized).toBe(false)
  })

  it('rejects a decision that attempts to authorize execution', () => {
    expect(() => registry().recordDecision('strategy-1', decision({ policy: { policyPassed: true, authorizationRequired: false, authorized: true, executionPermitted: true as false } }), { signal: 1 }, [])).toThrow('Shark intelligence cannot authorize execution')
  })

  it('rejects invalid confidence values', () => {
    expect(() => registry().recordDecision('strategy-1', decision({ confidence: 2 }), { signal: 1 }, [])).toThrow('confidence must be between 0 and 1')
  })
})
