import { describe, expect, it } from 'vitest'
import { evaluateRugProtection } from '../rug-protection'

describe('evaluateRugProtection', () => {
  const evidence = [{ source: 'goplus-solana', observedAt: '2026-09-02T00:00:00.000Z', label: 'authority-check' }]

  it('blocks non-transferable tokens', () => {
    const result = evaluateRugProtection({ nonTransferable: true, evidence })
    expect(result.disposition).toBe('BLOCK')
    expect(result.hardBlockers).toContain('token is non-transferable')
  })

  it('blocks rapid liquidity drain', () => {
    const result = evaluateRugProtection({ liquidityDrainRate: 0.4, evidence })
    expect(result.disposition).toBe('BLOCK')
  })

  it('requires review when independent sources disagree', () => {
    const result = evaluateRugProtection({ sourceDisagreement: true, evidence })
    expect(result.disposition).toBe('REVIEW')
  })

  it('does not treat mint authority alone as an automatic rug', () => {
    const result = evaluateRugProtection({ mintAuthorityLive: true, evidence })
    expect(result.disposition).toBe('REVIEW')
    expect(result.hardBlockers).toHaveLength(0)
  })

  it('allows a clean candidate without execution authority', () => {
    const result = evaluateRugProtection({
      top10HolderPct: 20,
      lpBurnPct: 95,
      lpLockedPct: 90,
      evidence,
    })
    expect(result.disposition).toBe('ALLOW_CANDIDATE')
    expect(result.score).toBeLessThan(35)
  })
  it('identifies distinct capabilities and observed risk patterns without declaring a proven rug', () => {
    const result = evaluateRugProtection({
      nonTransferable: true,
      mintAuthorityLive: true,
      liquidityDrainRate: 0.4,
      top10HolderPct: 75,
      sourceDisagreement: true,
      evidence,
    })
    expect(result.attackFingerprints?.map(x => x.mechanism)).toEqual([
      'SELL_RESTRICTION', 'SUPPLY_DILUTION', 'LIQUIDITY_WITHDRAWAL',
      'CONCENTRATED_DUMP', 'MARKET_INTEGRITY_ANOMALY',
    ])
    expect(result.attackFingerprints?.find(x => x.mechanism === 'SUPPLY_DILUTION')?.evidenceClass).toBe('CAPABILITY_PRESENT')
    expect(result.attackFingerprints?.find(x => x.mechanism === 'LIQUIDITY_WITHDRAWAL')?.evidenceClass).toBe('RISK_PATTERN')
  })

  it('returns no invented rug mechanism from an incomplete or clean observation', () => {
    expect(evaluateRugProtection({evidence}).attackFingerprints).toEqual([])
    expect(evaluateRugProtection({top10HolderPct:20, evidence}).attackFingerprints).toEqual([])
  })

})
