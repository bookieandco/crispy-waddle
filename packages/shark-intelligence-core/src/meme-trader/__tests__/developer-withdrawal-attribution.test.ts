import { describe, expect, it } from 'vitest'
import { buildEntityGraph } from '../entity-graph'
import { attributeWithdrawalToDeveloper } from '../developer-withdrawal-attribution'
import type { LPWithdrawalAttribution } from '../lp-withdrawal-attribution'

const withdrawal: LPWithdrawalAttribution = {
  signature: 'sig1',
  observedAt: '2026-01-01T00:00:00Z',
  poolAddress: 'pool1',
  lpMint: 'lp1',
  ownerBefore: 'dev-wallet',
  ownerAfter: undefined,
  lpStateEventId: 'state1',
  raydiumWithdrawalEventId: 'withdraw1',
  developerAssociation: 'UNKNOWN',
  evidenceIds: ['withdraw-evidence'],
  confidence: 0.9,
}

describe('developer withdrawal attribution', () => {
  it('recognizes direct deployer ownership', () => {
    const graph = buildEntityGraph([
      { id: 'token:solana:TokenA', kind: 'token', observedAt: withdrawal.observedAt, confidence: 1, evidenceIds: ['token-evidence'] },
      { id: 'wallet:dev-wallet', kind: 'wallet', observedAt: withdrawal.observedAt, confidence: 1, evidenceIds: ['wallet-evidence'] },
    ], [{ id: 'deploy-1', from: 'wallet:dev-wallet', to: 'token:solana:TokenA', relation: 'deployed', observedAt: withdrawal.observedAt, confidence: 1, evidenceIds: ['deploy-evidence'] }])
    const result = attributeWithdrawalToDeveloper({ withdrawal, graph, tokenAddress: 'TokenA' })
    expect(result.actorAssociation.association).toBe('DIRECT_DEPLOYER')
    expect(result.developerAssociation).toBe('MATCHED')
    expect(result.actorAssociation.confidence).toBe(0.9)
    expect(result.evidenceIds).toEqual(expect.arrayContaining(['withdraw-evidence']))
  })

  it('recognizes an explicit wallet-to-developer controls edge without claiming wallet is the developer', () => {
    const graph = buildEntityGraph([
      { id: 'token:solana:TokenA', kind: 'token', observedAt: withdrawal.observedAt, confidence: 1, evidenceIds: [] },
      { id: 'wallet:dev-wallet', kind: 'wallet', observedAt: withdrawal.observedAt, confidence: 0.9, evidenceIds: [] },
      { id: 'developer:dev-entity', kind: 'developer', observedAt: withdrawal.observedAt, confidence: 0.8, evidenceIds: ['developer-evidence'] },
    ], [{ id: 'control-1', from: 'wallet:dev-wallet', to: 'developer:dev-entity', relation: 'controls', observedAt: withdrawal.observedAt, confidence: 0.8, evidenceIds: ['control-evidence'] }])
    const result = attributeWithdrawalToDeveloper({ withdrawal, graph, tokenAddress: 'TokenA' })
    expect(result.actorAssociation.association).toBe('CONTROLLED_DEVELOPER')
    expect(result.actorAssociation.actorId).toBe('dev-entity')
    expect(result.actorAssociation.actorKind).toBe('developer')
    expect(result.developerAssociation).toBe('MATCHED')
  })

  it('does not promote an unrelated wallet to developer', () => {
    const graph = buildEntityGraph([
      { id: 'token:solana:TokenA', kind: 'token', observedAt: withdrawal.observedAt, confidence: 1, evidenceIds: [] },
      { id: 'wallet:other-wallet', kind: 'wallet', observedAt: withdrawal.observedAt, confidence: 1, evidenceIds: [] },
    ], [])
    const result = attributeWithdrawalToDeveloper({ withdrawal: { ...withdrawal, ownerBefore: 'other-wallet' }, graph, tokenAddress: 'TokenA' })
    expect(result.actorAssociation.association).toBe('NOT_MATCHED')
    expect(result.developerAssociation).toBe('UNKNOWN')
  })
})
