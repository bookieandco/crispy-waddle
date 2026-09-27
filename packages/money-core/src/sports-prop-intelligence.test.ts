import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSportsHandicapEvidenceSet, type SportsHandicapEvidence } from './sports-handicap-evidence.js'
import { assessSportsProp, assessSportsPropLadder, createSportsPropLineObservation } from './sports-prop-intelligence.js'
import type { SportsMarketQuote } from './sports-paper-betting.js'

const quote=(id:string,marketId:string,odds:string):SportsMarketQuote=>Object.freeze({
  quoteId:id,provider:'paper-book',eventId:'nfl:game-1',marketId,selectionId:marketId,
  oddsFormat:'AMERICAN',odds,observedAt:'2026-09-26T18:00:00Z',availableAt:'2026-09-26T18:00:01Z',
  evidenceIds:Object.freeze(['quote:'+id]),authority:'EVIDENCE_ONLY',canExecute:false,
})

const evidence=(overrides:Partial<SportsHandicapEvidence>={}):SportsHandicapEvidence=>Object.freeze({
  evidenceId:'usage:1',eventId:'nfl:game-1',subjectId:'player:1',featureKind:'PLAYER_ROLE',
  evidenceClass:'MEASURED',causalStatus:'DIRECT_MECHANISM',value:7600,unit:'BPS',
  direction:'SUPPORTS_OVER',observedAt:'2026-09-26T17:00:00Z',informationCutoff:'2026-09-26T18:00:00Z',
  sourceType:'tracking-feed',authority:'INTELLIGENCE_ONLY',canExecute:false,...overrides,
})

const evidenceSet=(items:SportsHandicapEvidence[]= [evidence()])=>buildSportsHandicapEvidenceSet({
  eventId:'nfl:game-1',evidence:items,informationCutoff:'2026-09-26T18:00:00Z',
})

test('buy-low prop needs a better price plus stable opportunity, not just a prior miss',()=>{
  const observation=createSportsPropLineObservation({
    observationId:'obs:1',playerId:'player:1',marketKind:'RUSH_ATTEMPTS',side:'OVER',line:12.5,
    quote:quote('q1','rush-attempts-over','-115'),alternate:false,evidenceIds:['line:1'],
  })
  const a=assessSportsProp({
    observation,fairProbability:.61,estimatedCostsBps:25,opportunityBasis:'VOLUME',evidenceSet:evidenceSet(),
    roleContext:{projectedOpportunityShareBps:8200,priorOpportunityShareBps:8000,carryShareBps:8500},
    priorClosingLine:15.5,priorResultMissed:true,
  })
  assert.equal(a.buyLowStatus,'SUPPORTED')
  assert.ok(a.reasonCodes.includes('BUY_LOW_REQUIRES_PRICE_DISCOUNT_PLUS_ROLE_STABILITY'))
  assert.equal(a.canExecute,false)
})

test('a recent miss alone is not buy-low evidence',()=>{
  const observation=createSportsPropLineObservation({
    observationId:'obs:2',playerId:'player:1',marketKind:'RECEIVING_YARDS',side:'OVER',line:60.5,
    quote:quote('q2','receiving-yards-over','-110'),alternate:false,evidenceIds:['line:2'],
  })
  const a=assessSportsProp({
    observation,fairProbability:.55,estimatedCostsBps:20,opportunityBasis:'MIXED',evidenceSet:evidenceSet(),
    roleContext:{projectedOpportunityShareBps:5200,priorOpportunityShareBps:7600},
    priorClosingLine:65.5,priorResultMissed:true,
  })
  assert.equal(a.buyLowStatus,'UNSUPPORTED')
  assert.ok(a.reasonCodes.includes('RECENT_MISS_IS_NOT_BUY_LOW_PROOF'))
})

test('public betting concentration with a sticky line is not promoted to sharp-book intent',()=>{
  const observation=createSportsPropLineObservation({
    observationId:'obs:3',playerId:'player:1',marketKind:'RECEPTIONS',side:'OVER',line:3.5,
    quote:quote('q3','receptions-over','-115'),alternate:false,evidenceIds:['line:3'],
  })
  const market=evidence({evidenceId:'market:1',subjectId:'market',featureKind:'PUBLIC_OR_SHARP_FLOW',evidenceClass:'MARKET',causalStatus:'CORRELATIONAL',value:9400,unit:'PUBLIC_TICKET_SHARE_BPS',sourceType:'market-split-feed'})
  const a=assessSportsProp({
    observation,fairProbability:.60,estimatedCostsBps:20,opportunityBasis:'VOLUME',evidenceSet:evidenceSet([evidence(),market]),
    roleContext:{routeParticipationBps:9000,targetShareBps:2600,publicTicketShareBps:9400},
    lineMovementSincePublicSplit:0,
  })
  assert.equal(a.marketResistanceInferenceAllowed,false)
  assert.ok(a.reasonCodes.includes('LINE_RESISTANCE_IS_OBSERVATION_NOT_SHARP_PROOF'))
})

test('alt-line ladder evaluates each rung instead of assuming a base edge scales upward',()=>{
  const r1=createSportsPropLineObservation({
    observationId:'r1',playerId:'player:1',marketKind:'RECEIVING_YARDS',side:'OVER',line:60,
    quote:quote('l1','rec-60','-120'),alternate:false,evidenceIds:['r1'],
  })
  const r2=createSportsPropLineObservation({
    observationId:'r2',playerId:'player:1',marketKind:'RECEIVING_YARDS',side:'OVER',line:80,
    quote:quote('l2','rec-80','+200'),alternate:true,evidenceIds:['r2'],
  })
  const r3=createSportsPropLineObservation({
    observationId:'r3',playerId:'player:1',marketKind:'RECEIVING_YARDS',side:'OVER',line:100,
    quote:quote('l3','rec-100','+400'),alternate:true,evidenceIds:['r3'],
  })
  const ladder=assessSportsPropLadder({
    playerId:'player:1',marketKind:'RECEIVING_YARDS',side:'OVER',
    rungs:[
      {rungId:'60+',observation:r1,fairProbability:.62,estimatedCostsBps:20},
      {rungId:'80+',observation:r2,fairProbability:.36,estimatedCostsBps:20},
      {rungId:'100+',observation:r3,fairProbability:.18,estimatedCostsBps:20},
    ],
  })
  assert.equal(ladder.status,'PARTIAL')
  assert.ok(ladder.eligibleRungIds.includes('60+'))
  assert.ok(ladder.reasonCodes.includes('EACH_ALT_RUNG_REQUIRES_ITS_OWN_POSITIVE_EDGE'))
})

test('non-monotonic alt-line probabilities fail back to model review',()=>{
  const r1=createSportsPropLineObservation({
    observationId:'m1',playerId:'player:1',marketKind:'RECEIVING_YARDS',side:'OVER',line:60,
    quote:quote('m1q','m60','-110'),alternate:false,evidenceIds:['m1'],
  })
  const r2=createSportsPropLineObservation({
    observationId:'m2',playerId:'player:1',marketKind:'RECEIVING_YARDS',side:'OVER',line:100,
    quote:quote('m2q','m100','+300'),alternate:true,evidenceIds:['m2'],
  })
  const ladder=assessSportsPropLadder({
    playerId:'player:1',marketKind:'RECEIVING_YARDS',side:'OVER',
    rungs:[
      {rungId:'60+',observation:r1,fairProbability:.50,estimatedCostsBps:0},
      {rungId:'100+',observation:r2,fairProbability:.55,estimatedCostsBps:0},
    ],
  })
  assert.equal(ladder.status,'REQUIRES_MODEL')
  assert.ok(ladder.reasonCodes.includes('ALT_LINE_PROBABILITIES_NON_MONOTONIC'))
})
