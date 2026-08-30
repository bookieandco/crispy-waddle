import { describe, expect, it } from 'vitest'
import { DefaultPolicyEngine, type ActionProposal } from './action-governance.js'

describe('canonical ActionProposal', () => {
  const base: ActionProposal = {
    id: 'action_1',
    actor: { type: 'agent', id: 'ask-jhadina' },
    sessionId: 'session_1',
    intent: 'github.repo.read',
    capability: 'github.repo.read',
    target: 'github',
    parameters: { owner: 'bookieandco', repo: 'crispy-waddle' },
    evidence: ['user_request'],
    risk: 'low',
    reversibility: 'reversible',
    correlationId: 'corr_1',
    createdAt: '2026-08-30T00:00:00.000Z',
  }

  it('allows a low-risk reversible proposal', () => {
    expect(new DefaultPolicyEngine().decide(base).effect).toBe('allow')
  })

  it('requires approval for irreversible proposals', () => {
    expect(new DefaultPolicyEngine().decide({ ...base, reversibility: 'irreversible' }).effect).toBe('approval_required')
  })

  it('requires approval for critical risk', () => {
    expect(new DefaultPolicyEngine().decide({ ...base, risk: 'critical' }).effect).toBe('approval_required')
  })
})
