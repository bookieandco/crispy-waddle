import assert from 'node:assert/strict'
import test from 'node:test'
import { assertAlphaEvidence, routeAlphaAcrossDomains, type AlphaEvidence } from './cross-domain-alpha-router.js'

const source:AlphaEvidence=Object.freeze({
  alphaId:'alpha:sports:latency-1',
  sourceDomain:'SPORTS_BETTING',
  sourceSubjectId:'game:abc',
  featureKind:'NEWS_LATENCY',
  direction:'BULLISH',
  strengthBps:7000,
  confidenceBps:7200,
  thesis:'Verified lineup information arrived before the target market fully repriced.',
  observedAt:'2026-09-26T18:00:00Z',
  availableAt:'2026-09-26T18:00:01Z',
  expiresAt:'2026-09-26T18:10:00Z',
  evidenceIds:['lineup:1','quote:before:1'],
  authority:'INTELLIGENCE_ONLY',
  canExecute:false,
})

test('sports alpha can be reused as governed evidence for prediction, stock, FX, and meme research without becoming target truth',()=>{
  for(const [domain,instrument] of [
    ['PREDICTION_MARKET','kalshi:sports:event-1'],
    ['STOCK','stock:DKNG'],
    ['FOREX','forex:GBPUSD'],
    ['MEME','crypto:solana:TOKEN1'],
  ] as const){
    const route=routeAlphaAcrossDomains({
      alpha:source,
      targetDomain:domain,
      targetInstrumentId:instrument,
      targetHypothesis:`Test whether the source event changes ${instrument} pricing or risk.`,
      createdAt:'2026-09-26T18:00:02Z',
      targetEvidenceIds:[`target:${domain}:1`],
    })
    assert.equal(route.transferStatus,'REUSABLE_EVIDENCE')
    assert.equal(route.targetTruthClaim,false)
    assert.equal(route.canAuthorizeLive,false)
    assert.equal(route.canExecute,false)
    assert.ok(route.reasonCodes.includes('CROSS_DOMAIN_TRANSFER_REQUIRES_INDEPENDENT_TARGET_VALIDATION'))
  }
})

test('weak source alpha is review-only rather than silently promoted across domains',()=>{
  const weak=Object.freeze({...source,alphaId:'alpha:weak',confidenceBps:4000,strengthBps:2000})
  const route=routeAlphaAcrossDomains({
    alpha:weak,
    targetDomain:'FOREX',
    targetInstrumentId:'forex:EURUSD',
    targetHypothesis:'Check whether event risk is relevant to EURUSD.',
    createdAt:'2026-09-26T18:00:02Z',
  })
  assert.equal(route.transferStatus,'REQUIRES_REVIEW')
  assert.ok(route.reasonCodes.includes('SOURCE_CONFIDENCE_BELOW_REUSE_FLOOR'))
  assert.ok(route.reasonCodes.includes('SOURCE_STRENGTH_BELOW_REUSE_FLOOR'))
})

test('alpha evidence remains intelligence-only',()=>{
  assert.doesNotThrow(()=>assertAlphaEvidence(source,'2026-09-26T18:00:02Z'))
  assert.throws(
    ()=>assertAlphaEvidence({...source,authority:'INTELLIGENCE_ONLY',canExecute:true as false},'2026-09-26T18:00:02Z'),
    /MONEY_ALPHA_AUTHORITY_ESCALATION/,
  )
})
