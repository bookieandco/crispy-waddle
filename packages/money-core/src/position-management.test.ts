import assert from 'node:assert/strict'
import test from 'node:test'
import { routeAlphaAcrossDomains, type AlphaEvidence } from './cross-domain-alpha-router.js'
import { defaultPositionManagementPolicy, evaluateOpenPosition, type OpenPositionSnapshot, type PositionMarketAssessment } from './position-management.js'

const alpha:AlphaEvidence=Object.freeze({
  alphaId:'sports-alpha:game-1',
  sourceDomain:'SPORTS_BETTING',
  sourceSubjectId:'game:1',
  featureKind:'PRICE_MISPRICING',
  direction:'BULLISH',
  strengthBps:7800,
  confidenceBps:7600,
  thesis:'Live game state improved faster than the executable market repriced.',
  observedAt:'2026-09-26T20:00:00Z',
  availableAt:'2026-09-26T20:00:01Z',
  expiresAt:'2026-09-26T20:05:00Z',
  evidenceIds:['sports:state:1','market:quote:1'],
  authority:'INTELLIGENCE_ONLY',
  canExecute:false,
})

const position=(overrides:Partial<OpenPositionSnapshot>={}):OpenPositionSnapshot=>Object.freeze({
  positionId:'pos:sports:1',
  domain:'SPORTS_BETTING',
  instrumentId:'sports:game-1:home-ml',
  side:'YES',
  quantity:100,
  entryPrice:.52,
  currentExecutableExitPrice:.68,
  currentExecutableAddPrice:.69,
  unrealizedPnlMinor:1600n,
  peakUnrealizedPnlMinor:1800n,
  grossExposureMinor:5200n,
  currency:'USD',
  openedAt:'2026-09-26T19:00:00Z',
  observedAt:'2026-09-26T20:00:02Z',
  evidenceIds:['position:1'],
  authority:'EVIDENCE_ONLY',
  ...overrides,
})

function assessment(overrides:Partial<PositionMarketAssessment>={}):PositionMarketAssessment{
  const route=routeAlphaAcrossDomains({
    alpha,
    targetDomain:'SPORTS_BETTING',
    targetInstrumentId:'sports:game-1:home-ml',
    targetHypothesis:'The current price still understates the home side fair probability.',
    createdAt:'2026-09-26T20:00:03Z',
  })
  return Object.freeze({
    fairProbability:.76,
    marketImpliedProbability:.69,
    edgeAfterCostsBps:650,
    thesisStrengthBps:8200,
    invalidationRiskBps:2200,
    liquidityQualityBps:8000,
    momentumBps:7200,
    correlationRiskBps:2000,
    alphaRoutes:[route],
    evidenceIds:['assessment:1'],
    assessedAt:'2026-09-26T20:00:03Z',
    authority:'INTELLIGENCE_ONLY',
    canExecute:false,
    ...overrides,
  })
}

test('winning sports position can still be an ADD candidate when fresh incremental edge survives',()=>{
  const decision=evaluateOpenPosition({
    position:position(),
    assessment:assessment(),
    policy:defaultPositionManagementPolicy('LIVE_AUTONOMOUS_GOVERNED'),
    evaluatedAt:'2026-09-26T20:00:04Z',
  })
  assert.equal(decision.winning,true)
  assert.equal(decision.action,'ADD')
  assert.equal(decision.automationDisposition,'LIVE_INTENT_CANDIDATE')
  assert.equal(decision.canExecute,false)
  assert.equal(decision.financialAuthority,'NONE')
  assert.ok(decision.pros.some(x=>x.includes('profitable')))
  assert.ok(decision.reasonCodes.includes('WINNING_POSITION_STILL_HAS_INCREMENTAL_EDGE'))
})

test('winning position trims rather than blindly holding when the edge has been priced away',()=>{
  const decision=evaluateOpenPosition({
    position:position(),
    assessment:assessment({edgeAfterCostsBps:20,thesisStrengthBps:6900}),
    evaluatedAt:'2026-09-26T20:00:04Z',
  })
  assert.equal(decision.action,'TRIM')
  assert.ok(decision.reasonCodes.includes('LOCK_PROFIT_WHILE_INCREMENTAL_EDGE_IS_WEAK'))
})

test('correlated thesis exposure can turn an otherwise positive position into a hedge candidate',()=>{
  const decision=evaluateOpenPosition({
    position:position(),
    assessment:assessment({edgeAfterCostsBps:400,correlationRiskBps:9000}),
    evaluatedAt:'2026-09-26T20:00:04Z',
  })
  assert.equal(decision.action,'HEDGE')
  assert.ok(decision.cons.some(x=>x.includes('Correlated exposure')))
})

test('materially better alternative can produce a ROTATE candidate without granting execution authority',()=>{
  const decision=evaluateOpenPosition({
    position:position(),
    assessment:assessment({
      edgeAfterCostsBps:100,
      bestAlternativeEdgeBps:800,
      bestAlternativeInstrumentId:'forex:EURUSD',
    }),
    evaluatedAt:'2026-09-26T20:00:04Z',
  })
  assert.equal(decision.action,'ROTATE')
  assert.equal(decision.alternativeInstrumentId,'forex:EURUSD')
  assert.equal(decision.canExecute,false)
})
