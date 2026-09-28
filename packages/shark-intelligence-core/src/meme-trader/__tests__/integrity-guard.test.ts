import { describe, expect, it } from 'vitest'
import { assertIntegrityGuardPassed, evaluateIntegrityGuard, type IntegrityGuardInput } from '../integrity-guard'

const base = (overrides: Partial<IntegrityGuardInput> = {}): IntegrityGuardInput => ({
  guardId: 'edge007-1',
  evaluatedAt: '2026-09-27T23:30:00.000Z',
  token: { chainId: 'solana-mainnet', tokenAddress: 'TOKEN1' },
  actorPosition: 'NONE',
  positionDisclosure: 'NOT_APPLICABLE',
  actions: [
    { kind: 'MONITOR_PUBLIC_ATTENTION' },
    { kind: 'ANALYZE_NARRATIVE' },
    { kind: 'ANALYZE_WALLET_FLOW' },
    { kind: 'EXECUTE_APPROVED_SWAP' },
  ],
  evidenceIds: ['edge007:evidence:1'],
  ...overrides,
})

describe('EDGE-007 integrity guard', () => {
  it('passes observation, analysis, and already-approved execution without granting authority', () => {
    const result = evaluateIntegrityGuard(base())
    expect(result.disposition).toBe('PASS')
    expect(result.authority).toBe('INTEGRITY_VETO_ONLY')
    expect(result.canAuthorizeTrade).toBe(false)
    expect(result.canAuthorizePromotion).toBe(false)
    expect(() => assertIntegrityGuardPassed(result)).not.toThrow()
  })

  it('blocks coordinated promotion, spam, fake volume, wash/self trading, and exit-liquidity engineering', () => {
    const result = evaluateIntegrityGuard(base({
      actions: [
        { kind: 'COORDINATED_PROMOTION' },
        { kind: 'SPAM_AMPLIFICATION' },
        { kind: 'FAKE_VOLUME' },
        { kind: 'WASH_TRADE' },
        { kind: 'SELF_TRADE' },
        { kind: 'TARGETED_HYPE_FOR_EXIT_LIQUIDITY' },
        { kind: 'MANUFACTURE_SOCIAL_PROOF' },
      ],
    }))
    expect(result.disposition).toBe('BLOCK')
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      'EDGE007_COORDINATED_PROMOTION_FORBIDDEN',
      'EDGE007_SPAM_AMPLIFICATION_FORBIDDEN',
      'EDGE007_FAKE_VOLUME_FORBIDDEN',
      'EDGE007_WASH_TRADING_FORBIDDEN',
      'EDGE007_SELF_DEALING_FORBIDDEN',
      'EDGE007_EXIT_LIQUIDITY_ENGINEERING_FORBIDDEN',
      'EDGE007_MANUFACTURED_SOCIAL_PROOF_FORBIDDEN',
    ]))
    expect(() => assertIntegrityGuardPassed(result)).toThrow(/EDGE007_INTEGRITY_BLOCKED/)
  })

  it('blocks misleading claims and intentional omission of material risk', () => {
    const result = evaluateIntegrityGuard(base({
      actions: [{ kind: 'MISLEADING_CLAIM' }, { kind: 'WITHHOLD_MATERIAL_RISK' }],
    }))
    expect(result.disposition).toBe('BLOCK')
    expect(result.reasonCodes).toContain('EDGE007_MISLEADING_CLAIM_FORBIDDEN')
    expect(result.reasonCodes).toContain('EDGE007_MATERIAL_RISK_OMISSION_FORBIDDEN')
  })

  it('requires position disclosure for public research when SHARK or the owner has a position', () => {
    const blocked = evaluateIntegrityGuard(base({
      actorPosition: 'LONG',
      positionDisclosure: 'UNDISCLOSED',
      actions: [{ kind: 'PUBLISH_DISCLOSED_RESEARCH' }],
    }))
    expect(blocked.disposition).toBe('BLOCK')
    expect(blocked.reasonCodes).toContain('EDGE007_POSITION_DISCLOSURE_REQUIRED')

    const passed = evaluateIntegrityGuard(base({
      actorPosition: 'LONG',
      positionDisclosure: 'DISCLOSED',
      actions: [{ kind: 'PUBLISH_DISCLOSED_RESEARCH' }],
    }))
    expect(passed.disposition).toBe('PASS')
  })

  it('fails closed when actions or evidence are missing', () => {
    const result = evaluateIntegrityGuard(base({ actions: [], evidenceIds: [] }))
    expect(result.disposition).toBe('BLOCK')
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      'EDGE007_ACTION_REQUIRED',
      'EDGE007_EVIDENCE_REQUIRED',
    ]))
  })

  it('rejects forged authority even if disposition says PASS', () => {
    const forged = {
      ...evaluateIntegrityGuard(base()),
      canAuthorizeTrade: true,
    } as any
    expect(() => assertIntegrityGuardPassed(forged)).toThrow(/EDGE007_AUTHORITY_ESCALATION_FORBIDDEN/)
  })
})
