import { describe, expect, it } from 'vitest'
import { reviewMemePosition } from './position-review'

describe('reviewMemePosition',()=>{
  it('can recommend adding to a winning meme position only when fresh edge and risk support it',()=>{
    const review=reviewMemePosition({
      entryPrice:1,
      currentPrice:1.35,
      peakPrice:1.4,
      liquidityUsd:500000,
      liquidityChangePct:5,
      momentumScore:.82,
      distributionScore:.15,
      riskScore:.25,
      thesisStrength:.9,
      secondsSinceEntry:90,
      incrementalEdgeBps:900,
      correlationRiskBps:2500,
      crossDomainAlphaIds:['alpha:sports:1'],
    },{minLiquidityUsd:100000})
    expect(review.action).toBe('ADD')
    expect(review.winning).toBe(true)
    expect(review.reasonCodes).toContain('WINNER_STILL_HAS_INCREMENTAL_EDGE')
    expect(review.crossDomainAlphaIds).toEqual(['alpha:sports:1'])
    expect(review.canExecute).toBe(false)
    expect(review.requiresMoneyCoreReview).toBe(true)
  })

  it('trims or exits a profitable position when distribution/risk replaces the original edge',()=>{
    const review=reviewMemePosition({
      entryPrice:1,
      currentPrice:1.2,
      peakPrice:1.8,
      liquidityUsd:80000,
      liquidityChangePct:-40,
      momentumScore:.2,
      distributionScore:.95,
      riskScore:.92,
      thesisStrength:.35,
      secondsSinceEntry:300,
      incrementalEdgeBps:100,
      correlationRiskBps:7500,
    },{minLiquidityUsd:100000})
    expect(review.action).toBe('EXIT')
    expect(review.cons.length).toBeGreaterThan(0)
    expect(review.financialAuthority).toBe('NONE')
    expect(review.walletSigningAuthority).toBe('NONE')
  })

  it('does not add merely because a position is winning',()=>{
    const review=reviewMemePosition({
      entryPrice:1,
      currentPrice:1.5,
      peakPrice:1.55,
      liquidityUsd:500000,
      momentumScore:.55,
      distributionScore:.2,
      riskScore:.35,
      thesisStrength:.65,
      secondsSinceEntry:30,
      incrementalEdgeBps:100,
      correlationRiskBps:2000,
    })
    expect(review.action).not.toBe('ADD')
    expect(review.canExecute).toBe(false)
  })
})
