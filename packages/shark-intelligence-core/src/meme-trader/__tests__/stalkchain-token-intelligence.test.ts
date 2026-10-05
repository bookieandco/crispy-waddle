import {describe,expect,it} from 'vitest'
import {
  assessStalkChainKolExitPressure,
  assessStalkChainSwapReflexivity,
  fuseStalkChainTrackedHolders,
  verifyStalkChainTokenEvidence,
} from '../stalkchain-token-intelligence'

describe('StalkChain token intelligence',()=>{
  it('deduplicates control groups and surfaces public crowding',()=>{
    const result=fuseStalkChainTrackedHolders({
      tokenAddress:'TOKEN',informationCutoff:'2026-10-05T00:01:00Z',followerSoftCap:10_000,
      holders:[
        {evidenceId:'e1',tokenAddress:'TOKEN',traderKey:'t1',walletId:'w1',controlGroupId:'g1',followers:10_000,observedAt:'2026-10-05T00:00:00Z',availableAt:'2026-10-05T00:00:01Z'},
        {evidenceId:'e2',tokenAddress:'TOKEN',traderKey:'t2',walletId:'w2',controlGroupId:'g1',followers:8_000,observedAt:'2026-10-05T00:00:00Z',availableAt:'2026-10-05T00:00:01Z'},
        {evidenceId:'e3',tokenAddress:'TOKEN',traderKey:'t3',walletId:'w3',followers:100,observedAt:'2026-10-05T00:00:00Z',availableAt:'2026-10-05T00:00:01Z'},
      ],
    })
    expect(result.cohort.distinctWalletCount).toBe(3)
    expect(result.cohort.controlGroupCount).toBe(2)
    expect(result.crowdingBand).toBe('CAUTION')
    expect(result.canAutoCopy).toBe(false)
  })

  it('turns KOL reductions into defensive exit pressure only',()=>{
    const pressure=assessStalkChainKolExitPressure([
      {evidenceId:'e1',traderKey:'t1',tokenAddress:'TOKEN',state:'EXITED',observedAt:'2026-10-05T00:00:00Z',positionValueUsd:10000},
      {evidenceId:'e2',traderKey:'t2',tokenAddress:'TOKEN',state:'REDUCED',observedAt:'2026-10-05T00:00:00Z',positionValueUsd:5000},
      {evidenceId:'e3',traderKey:'t3',tokenAddress:'TOKEN',state:'HOLDING',observedAt:'2026-10-05T00:00:00Z',positionValueUsd:1000},
    ])
    expect(pressure.knownExitPressure).toBe(.5)
    expect(pressure.valueWeightedExitPressure).toBeGreaterThan(.7)
    expect(pressure.band).toBe('HIGH')
    expect(pressure.canAuthorizeTrade).toBe(false)
  })

  it('reuses the existing copy-reflexivity guard for tracked swaps',()=>{
    const result=assessStalkChainSwapReflexivity([
      {evidenceId:'e1',chainId:'solana',walletId:'w1',tokenAddress:'TOKEN',side:'BUY',venue:'PUMPSWAP',transactionId:'1',observedAt:'2026-10-05T00:00:00Z',availableAt:'2026-10-05T00:00:01Z',quoteAmountRaw:'10000'},
      {evidenceId:'e2',chainId:'solana',walletId:'w1',tokenAddress:'TOKEN',side:'BUY',venue:'PUMPSWAP',transactionId:'2',observedAt:'2026-10-05T00:00:20Z',availableAt:'2026-10-05T00:00:21Z',quoteAmountRaw:'1000'},
      {evidenceId:'e3',chainId:'solana',walletId:'w1',tokenAddress:'TOKEN',side:'BUY',venue:'PUMPSWAP',transactionId:'3',observedAt:'2026-10-05T00:00:40Z',availableAt:'2026-10-05T00:00:41Z',quoteAmountRaw:'1000'},
      {evidenceId:'e4',chainId:'solana',walletId:'w1',tokenAddress:'TOKEN',side:'BUY',venue:'PUMPSWAP',transactionId:'4',observedAt:'2026-10-05T00:01:00Z',availableAt:'2026-10-05T00:01:01Z',quoteAmountRaw:'1000'},
    ])
    expect(result.rapidRepeatBuyCount).toBe(3)
    expect(result.smallRepeatBuyCount).toBe(3)
    expect(result.band).toBe('HIGH')
    expect(result.canAutoCopy).toBe(false)
  })

  it('makes independent corroboration explicit and lets contradictions dominate',()=>{
    const corroborated=verifyStalkChainTokenEvidence({
      tokenAddress:'TOKEN',providerEvidenceIds:['stalk:1'],independentEvidenceIds:['helius:1','dex:1'],
      providerClaimsChecked:5,independentlyCorroboratedClaims:4,
    })
    expect(corroborated.verificationBand).toBe('CORROBORATED')
    const contradicted=verifyStalkChainTokenEvidence({
      tokenAddress:'TOKEN',providerEvidenceIds:['stalk:1'],independentEvidenceIds:['helius:1'],
      providerClaimsChecked:5,independentlyCorroboratedClaims:4,contradictions:['holder-balance-mismatch'],
    })
    expect(contradicted.verificationBand).toBe('CONTRADICTED')
    expect(contradicted.canAuthorizeTrade).toBe(false)
  })
})
