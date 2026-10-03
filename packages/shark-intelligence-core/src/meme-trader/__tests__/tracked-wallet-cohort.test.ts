import {describe,expect,it} from 'vitest'
import {assessTrackedWalletSilence,summarizeTrackedWalletCohort,type TrackedWalletCohortObservation} from '../tracked-wallet-cohort'

const token='TOKEN'
const obs=(id:string,walletId:string,side:'BUY'|'SELL',overrides:Partial<TrackedWalletCohortObservation>={}):TrackedWalletCohortObservation=>({
  evidenceId:'e:'+id,
  walletId,
  tokenAddress:token,
  side,
  observedAt:'2026-10-03T05:00:00Z',
  availableAt:'2026-10-03T05:00:01Z',
  ...overrides,
})

describe('tracked wallet cohort intelligence',()=>{
  it('deduplicates common-control wallets instead of counting raw wallet convergence',()=>{
    const summary=summarizeTrackedWalletCohort({
      tokenAddress:token,
      informationCutoff:'2026-10-03T05:01:00Z',
      observations:[
        obs('1','w1','BUY',{controlGroupId:'cluster-a',style:'NARRATIVE'}),
        obs('2','w2','BUY',{controlGroupId:'cluster-a',style:'SIDE_WALLET'}),
        obs('3','w3','BUY',{style:'NARRATIVE'}),
      ],
    })
    expect(summary.distinctWalletCount).toBe(3)
    expect(summary.controlGroupCount).toBe(2)
    expect(summary.independentBuyerGroups).toBe(2)
    expect(summary.independenceRatio).toBeCloseTo(2/3)
    expect(summary.narrativeBuyerShare).toBe(1)
    expect(summary.canAutoCopy).toBe(false)
    expect(summary.canAuthorizeTrade).toBe(false)
  })

  it('surfaces scalper/farmer/public-crowding risk without inferring motive or identity',()=>{
    const summary=summarizeTrackedWalletCohort({
      tokenAddress:token,
      informationCutoff:'2026-10-03T05:01:00Z',
      observations:[
        obs('1','w1','BUY',{style:'SCALPER',publicVisibilityScore:.95,historicalQualityScore:.8,historicalSampleSize:100}),
        obs('2','w2','BUY',{style:'FARMER_DEV',publicVisibilityScore:.9,historicalQualityScore:.4,historicalSampleSize:25}),
        obs('3','w3','SELL',{style:'NARRATIVE'}),
      ],
    })
    expect(summary.scalperBuyerShare).toBe(.5)
    expect(summary.adverseActorBuyerShare).toBe(.5)
    expect(summary.publicCrowdingScore).toBeCloseTo(.925)
    expect(summary.sellerPressure).toBeCloseTo(1/3)
    expect(summary.canInferNaturalPersonIdentity).toBe(false)
  })

  it('does not create an alpha score until calibrated thresholds are supplied',()=>{
    const observations=[
      obs('1','w1','BUY',{style:'NARRATIVE',historicalQualityScore:.9,historicalSampleSize:25,publicVisibilityScore:.2,profileFreshnessScore:1}),
      obs('2','w2','BUY',{style:'NARRATIVE',historicalQualityScore:.8,historicalSampleSize:25,publicVisibilityScore:.3,profileFreshnessScore:1}),
    ]
    const raw=summarizeTrackedWalletCohort({
      tokenAddress:token,informationCutoff:'2026-10-03T05:01:00Z',observations,
    })
    expect(raw.calibratedSupportScore).toBeUndefined()
    expect(raw.evaluatedThresholdCount).toBe(0)

    const calibrated=summarizeTrackedWalletCohort({
      tokenAddress:token,informationCutoff:'2026-10-03T05:01:00Z',observations,
      thresholds:{
        minIndependentBuyerGroups:2,
        minIndependenceRatio:.9,
        minMeanHistoricalQuality:.7,
        maxScalperBuyerShare:.25,
        maxAdverseActorBuyerShare:.25,
        maxPublicCrowdingScore:.5,
        maxSellerPressure:.25,
      },
    })
    expect(calibrated.failedRules).toEqual([])
    expect(calibrated.evaluatedThresholdCount).toBe(7)
    expect(calibrated.calibratedSupportScore).toBe(1)
  })

  it('respects point-in-time availability and stale-profile weighting',()=>{
    const summary=summarizeTrackedWalletCohort({
      tokenAddress:token,
      informationCutoff:'2026-10-03T05:01:00Z',
      observations:[
        obs('old','w1','BUY',{historicalQualityScore:1,historicalSampleSize:100,profileFreshnessScore:.2}),
        obs('fresh','w2','BUY',{historicalQualityScore:.6,historicalSampleSize:100,profileFreshnessScore:1}),
        obs('future','w3','BUY',{availableAt:'2026-10-03T05:02:00Z',historicalQualityScore:1,historicalSampleSize:100}),
      ],
    })
    expect(summary.rawObservationCount).toBe(2)
    expect(summary.independentBuyerGroups).toBe(2)
    expect(summary.meanHistoricalQuality).toBeCloseTo((1*.2+.6)/(1.2))
    expect(summary.evidenceIds).not.toContain('e:future')
  })

  it('keeps tracked-wallet silence unscored until coverage/time thresholds are calibrated',()=>{
    const raw=assessTrackedWalletSilence({
      trackedUniverseSize:500,
      eligibleProfileCount:400,
      independentBuyerGroups:0,
      observationWindowSeconds:60,
    })
    expect(raw.silenceRate).toBe(1)
    expect(raw.calibratedConcern).toBeUndefined()
    expect(raw.canLabelScam).toBe(false)

    const calibrated=assessTrackedWalletSilence({
      trackedUniverseSize:500,
      eligibleProfileCount:400,
      independentBuyerGroups:2,
      observationWindowSeconds:60,
      thresholds:{minEligibleCoverage:.7,minObservationWindowSeconds:30,maxParticipationRate:.01},
    })
    expect(calibrated.eligibleCoverage).toBe(.8)
    expect(calibrated.participationRate).toBe(.005)
    expect(calibrated.calibratedConcern).toBe(true)
    expect(calibrated.canAuthorizeTrade).toBe(false)

    const poorCoverage=assessTrackedWalletSilence({
      trackedUniverseSize:500,
      eligibleProfileCount:100,
      independentBuyerGroups:0,
      observationWindowSeconds:60,
      thresholds:{minEligibleCoverage:.7,minObservationWindowSeconds:30,maxParticipationRate:.01},
    })
    expect(poorCoverage.failedCoverage).toBe(true)
    expect(poorCoverage.calibratedConcern).toBeUndefined()
  })

})
