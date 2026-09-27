import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPredictionVenueObservation, comparePredictionVenues } from './prediction-cross-venue-intelligence.js'
import type { PredictionMarketSnapshot } from './prediction-market-reality.js'

function snap(overrides:Partial<PredictionMarketSnapshot>={}):PredictionMarketSnapshot{
  return Object.freeze({
    schemaVersion:'MONEY-PREDICTION-01',
    snapshotId:'s1',marketId:'m1',instrumentId:'i1',venue:'Kalshi',title:'Event?',contractKind:'BINARY',
    status:'OPEN',quoteCurrency:'USD',settlementCurrency:'USD',payoutAmount:1,
    opensAt:'2026-09-26T00:00:00Z',closesAt:'2026-09-27T00:00:00Z',
    informationCutoff:'2026-09-26T18:00:00Z',derivedAt:'2026-09-26T18:00:01Z',
    outcomes:Object.freeze([
      {outcomeId:'YES',label:'Yes',bidProbability:.54,askProbability:.56,midpointProbability:.55,spreadProbability:.02,bidSize:500,askSize:600,quoteId:'q1',evidenceRefs:Object.freeze(['q1'])},
      {outcomeId:'NO',label:'No',bidProbability:.44,askProbability:.46,midpointProbability:.45,spreadProbability:.02,bidSize:500,askSize:600,quoteId:'q2',evidenceRefs:Object.freeze(['q2'])},
    ]),
    midpointProbabilityMass:1,completeSetArbitrage:'NONE',
    resolution:{authorityId:'official-source',ruleVersion:'r1',canonicalRule:'Resolves from official source.',scheduledResolutionAt:'2026-09-28T00:00:00Z',voidTreatment:'VENUE_RULES',evidenceRefs:Object.freeze(['rules']),provenanceHash:'rh'},
    methodologyVersion:'m1',sourceManifest:Object.freeze(['src']),evidenceRefs:Object.freeze(['s']),snapshotHash:'h',
    researchAuthority:'INTELLIGENCE_ONLY',executionAuthority:'NONE',financialAuthority:'NONE',
    ...overrides,
  })
}

test('compares executable real-money prices while keeping sentiment isolated',()=>{
  const kalshi=buildPredictionVenueObservation({
    canonicalEventId:'event:1',snapshot:snap(),outcomeId:'YES',marketType:'REAL_MONEY',matchConfidence:'HIGH',
    resolutionRuleFingerprint:'same-rule',now:'2026-09-26T18:00:10Z',staleAfterMs:60_000,minimumHealthyLiquidity:100,
  })
  const poly=buildPredictionVenueObservation({
    canonicalEventId:'event:1',snapshot:snap({
      snapshotId:'s2',marketId:'m2',instrumentId:'i2',venue:'Polymarket',
      outcomes:Object.freeze([
        {outcomeId:'YES',label:'Yes',bidProbability:.49,askProbability:.51,midpointProbability:.50,spreadProbability:.02,bidSize:900,askSize:1000,quoteId:'q3',evidenceRefs:Object.freeze(['q3'])},
        {outcomeId:'NO',label:'No',bidProbability:.49,askProbability:.51,midpointProbability:.50,spreadProbability:.02,bidSize:900,askSize:1000,quoteId:'q4',evidenceRefs:Object.freeze(['q4'])},
      ]),
    }),outcomeId:'YES',marketType:'REAL_MONEY',matchConfidence:'HIGH',
    resolutionRuleFingerprint:'same-rule',now:'2026-09-26T18:00:10Z',staleAfterMs:60_000,minimumHealthyLiquidity:100,
  })
  const sentiment=buildPredictionVenueObservation({
    canonicalEventId:'event:1',snapshot:snap({snapshotId:'s3',marketId:'m3',instrumentId:'i3',venue:'Manifold'}),
    outcomeId:'YES',marketType:'SENTIMENT',matchConfidence:'MEDIUM',resolutionRuleFingerprint:'community',
    now:'2026-09-26T18:00:10Z',staleAfterMs:60_000,minimumHealthyLiquidity:100,
  })
  const x=comparePredictionVenues({canonicalEventId:'event:1',outcomeId:'YES',observations:[kalshi,poly,sentiment],comparedAt:'2026-09-26T18:00:11Z'})
  assert.equal(x.bestExecutableBuyVenue,'Polymarket')
  assert.equal(x.bestExecutableBuyProbability,.51)
  assert.equal(x.realMoneyVenueCount,2)
  assert.equal(x.sentimentVenueCount,1)
  assert.equal(x.maxMidpointDiscrepancyBps,500)
  assert.equal(x.canExecute,false)
  assert.ok(x.riskFlags.includes('SENTIMENT_ONLY'))
})

test('flags settlement mismatch instead of calling two similarly worded contracts interchangeable',()=>{
  const a=buildPredictionVenueObservation({
    canonicalEventId:'event:2',snapshot:snap(),outcomeId:'YES',marketType:'REAL_MONEY',matchConfidence:'HIGH',
    resolutionRuleFingerprint:'rule-A',now:'2026-09-26T18:00:10Z',staleAfterMs:60_000,minimumHealthyLiquidity:100,
  })
  const b=buildPredictionVenueObservation({
    canonicalEventId:'event:2',snapshot:snap({snapshotId:'s2',marketId:'m2',instrumentId:'i2',venue:'Polymarket'}),
    outcomeId:'YES',marketType:'REAL_MONEY',matchConfidence:'HIGH',resolutionRuleFingerprint:'rule-B',
    now:'2026-09-26T18:00:10Z',staleAfterMs:60_000,minimumHealthyLiquidity:100,
  })
  const x=comparePredictionVenues({canonicalEventId:'event:2',outcomeId:'YES',observations:[a,b],comparedAt:'2026-09-26T18:00:11Z'})
  assert.equal(x.comparableSettlementRules,false)
  assert.ok(x.riskFlags.includes('SETTLEMENT_RULE_MISMATCH'))
  assert.equal(x.canAuthorizeLive,false)
})

test('stale or low-confidence matches are excluded from best-price discovery',()=>{
  const fresh=buildPredictionVenueObservation({
    canonicalEventId:'event:3',snapshot:snap(),outcomeId:'YES',marketType:'REAL_MONEY',matchConfidence:'HIGH',
    resolutionRuleFingerprint:'r',now:'2026-09-26T18:00:10Z',staleAfterMs:60_000,minimumHealthyLiquidity:100,
  })
  const stale=buildPredictionVenueObservation({
    canonicalEventId:'event:3',snapshot:snap({snapshotId:'s2',marketId:'m2',instrumentId:'i2',venue:'Other',informationCutoff:'2026-09-26T17:00:00Z'}),
    outcomeId:'YES',marketType:'REAL_MONEY',matchConfidence:'LOW',resolutionRuleFingerprint:'r',
    now:'2026-09-26T18:00:10Z',staleAfterMs:60_000,minimumHealthyLiquidity:100,
  })
  const x=comparePredictionVenues({canonicalEventId:'event:3',outcomeId:'YES',observations:[fresh,stale],comparedAt:'2026-09-26T18:00:11Z'})
  assert.equal(x.bestExecutableBuyVenue,'Kalshi')
  assert.ok(x.riskFlags.includes('STALE_DATA'))
  assert.ok(x.riskFlags.includes('LOW_MATCH_CONFIDENCE'))
})
