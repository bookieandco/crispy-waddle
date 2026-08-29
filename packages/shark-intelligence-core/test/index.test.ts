import { describe, expect, it } from 'vitest'
import { validateSharkDecision } from '../src/index.js'

describe('@jhadina/shark-intelligence-core', () => {
  it('rejects any decision that permits execution', () => {
    const decision = {
      id: 'decision-1',
      opportunityId: 'token-1',
      kind: 'token' as const,
      decision: 'candidate' as const,
      confidence: 0.8,
      risks: [],
      evidence: [],
      streetSignals: [],
      sourceQuality: 0.9,
      novelty: 0.8,
      repeatability: 0.7,
      policy: {
        policyPassed: true,
        authorizationRequired: true,
        authorized: false,
        executionPermitted: false as const,
      },
      decidedAt: new Date(0).toISOString(),
    }

    expect(validateSharkDecision(decision)).toEqual([])
    expect(decision.policy.executionPermitted).toBe(false)
  })

  it('requires authorization before an authorized state can be recorded', () => {
    const decision = {
      id: 'decision-2',
      opportunityId: 'token-2',
      kind: 'token' as const,
      decision: 'candidate' as const,
      confidence: 0.8,
      risks: [],
      evidence: [],
      streetSignals: [],
      sourceQuality: 0.9,
      novelty: 0.8,
      repeatability: 0.7,
      policy: {
        policyPassed: true,
        authorizationRequired: false,
        authorized: true,
        executionPermitted: false as const,
      },
      decidedAt: new Date(0).toISOString(),
    }

    expect(validateSharkDecision(decision)).toContain(
      'authorized cannot be true when authorizationRequired is false',
    )
  })
})
