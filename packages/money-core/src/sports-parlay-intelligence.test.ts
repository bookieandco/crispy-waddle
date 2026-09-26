import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assessTeaserAdjustment,
  createCommunitySelectionSignal,
  createSportsParlayLeg,
  evaluateSportsParlay,
  type SportsParlayDependency,
} from './sports-parlay-intelligence.js'
import type { SportsMarketQuote } from './sports-paper-betting.js'

const quote=(id:string,eventId:string,marketId:string,selectionId:string,odds:string):SportsMarketQuote=>Object.freeze({
  quoteId:id,provider:'paper-book',eventId,marketId,selectionId,oddsFormat:'AMERICAN',odds,
  observedAt:'2026-09-26T18:00:00Z',availableAt:'2026-09-26T18:00:01Z',
  evidenceIds:Object.freeze(['quote:'+id]),authority:'EVIDENCE_ONLY',canExecute:false,
})

test('bankroll-builder label does not make a parlay low risk',()=>{
  const a=createSportsParlayLeg({legId:'kc-ml',marketKind:'MONEYLINE',quote:quote('q1','g1','ml','kc','-500'),fairProbability:.86,edgeAfterCostsBps:120,thesis:'KC has standalone win edge.',evidenceIds:['model:kc']})
  const b=createSportsParlayLeg({legId:'car-ml',marketKind:'MONEYLINE',quote:quote('q2','g2','ml','car','-148'),fairProbability:.63,edgeAfterCostsBps:80,thesis:'CAR has standalone win edge.',evidenceIds:['model:car']})
  const x=evaluateSportsParlay({ticketKind:'BANKROLL_BUILDER',legs:[a,b],quotedDecimalOdds:1.96,evidenceIds:['ticket:1']})
  assert.ok(x.reasonCodes.includes('BANKROLL_LABEL_IS_NOT_RISK_PROOF'))
  assert.equal(x.requiresJointModel,false)
  assert.equal(x.canExecute,false)
})

test('same-game parlay requires joint probability instead of naïvely multiplying correlated legs',()=>{
  const spread=createSportsParlayLeg({legId:'den+6.5',marketKind:'ALT_SPREAD',quote:quote('q3','den-lac','spread','den+6.5','-200'),fairProbability:.76,edgeAfterCostsBps:100,thesis:'Denver stays within the alternate spread.',gameScriptTags:['LOW_SCORING','DENVER_TEMPO'],evidenceIds:['model:spread']})
  const under=createSportsParlayLeg({legId:'under48.5',marketKind:'ALT_TOTAL',quote:quote('q4','den-lac','total','under48.5','-180'),fairProbability:.74,edgeAfterCostsBps:90,thesis:'Game remains below alternate total.',gameScriptTags:['LOW_SCORING','DENVER_TEMPO'],evidenceIds:['model:total']})
  const rush=createSportsParlayLeg({legId:'dobbins29.5',marketKind:'PLAYER_PROP',quote:quote('q5','den-lac','rush','dobbins-over','-160'),fairProbability:.71,edgeAfterCostsBps:110,thesis:'Run-heavy script supports rushing volume.',gameScriptTags:['LOW_SCORING','DENVER_TEMPO'],evidenceIds:['model:rush']})
  const deps:SportsParlayDependency[]=[
    {dependencyId:'d1',legAId:'den+6.5',legBId:'under48.5',kind:'SHARED_GAME_SCRIPT',strengthBps:6500,rationale:'Competitive Denver script and lower possessions support both legs.',evidenceIds:['dep:1']},
    {dependencyId:'d2',legAId:'under48.5',legBId:'dobbins29.5',kind:'SHARED_GAME_SCRIPT',strengthBps:5500,rationale:'Run volume and clock burn support the under and rushing leg.',evidenceIds:['dep:2']},
    {dependencyId:'d3',legAId:'den+6.5',legBId:'dobbins29.5',kind:'POSITIVE',strengthBps:4000,rationale:'Denver staying competitive supports rushing attempts.',evidenceIds:['dep:3']},
  ]
  const unmodeled=evaluateSportsParlay({ticketKind:'SAME_GAME_PARLAY',legs:[spread,under,rush],dependencies:deps,quotedDecimalOdds:2.24,evidenceIds:['ticket:sgp']})
  assert.equal(unmodeled.jointFairProbability,null)
  assert.ok(unmodeled.reasonCodes.includes('JOINT_MODEL_REQUIRED'))
  const modeled=evaluateSportsParlay({ticketKind:'SAME_GAME_PARLAY',legs:[spread,under,rush],dependencies:deps,quotedDecimalOdds:2.24,jointFairProbability:.49,evidenceIds:['ticket:sgp','joint-model:1']})
  assert.equal(modeled.coherence,'COHERENT')
  assert.equal(modeled.jointFairProbability,.49)
  assert.notEqual(modeled.expectedEdgeBps,null)
})

test('teaser evaluation records key numbers but still judges the price paid',()=>{
  const t=assessTeaserAdjustment({
    legId:'sf-teaser',originalLine:-8.5,adjustedLine:-2.5,priceBeforeDecimal:1.91,priceAfterDecimal:1.55,
    fairProbabilityAfter:.68,estimatedCostsBps:40,evidenceIds:['teaser:price','teaser:model'],
  })
  assert.deepEqual(t.crossedKeyNumbers,[3,7])
  assert.equal(t.pointsBought,6)
  assert.ok(Number.isInteger(t.edgeAfterCostsBps))
})

test('community-selected last leg is sentiment evidence only',()=>{
  const s=createCommunitySelectionSignal({
    signalId:'last-leg:week3',eventId:'g9',marketId:'anytime-td',selectionId:'player-x',
    voteCount:122,eligibleVoterCount:450,cutoffAt:'2026-09-27T12:00:00Z',capturedAt:'2026-09-27T12:01:00Z',
    evidenceIds:['community:comments:week3'],
  })
  assert.equal(s.authority,'SENTIMENT_ONLY')
  assert.equal(s.canExecute,false)
})
