import assert from 'node:assert/strict'
import test from 'node:test'
import { createSportsPaperWager,settleSportsPaperWager,sportsImpliedProbability,sportsOddsToDecimal,type SportsMarketQuote } from './sports-paper-betting.js'

const quote=(overrides:Partial<SportsMarketQuote>={}):SportsMarketQuote=>Object.freeze({
  quoteId:'q1',provider:'paper-book',eventId:'g1',marketId:'moneyline',selectionId:'home',oddsFormat:'AMERICAN',odds:'+150',
  observedAt:'2026-09-21T17:00:00Z',availableAt:'2026-09-21T17:00:01Z',evidenceIds:Object.freeze(['odds:q1']),authority:'EVIDENCE_ONLY',canExecute:false,...overrides,
})

test('SPORT-PAPER.1 normalizes odds without granting betting authority',()=>{
  assert.equal(sportsOddsToDecimal('AMERICAN','+150'),2.5)
  assert.equal(sportsOddsToDecimal('AMERICAN','-200'),1.5)
  assert.equal(sportsOddsToDecimal('DECIMAL','2.25'),2.25)
  assert.equal(sportsImpliedProbability(2.5),.4)
})

test('SPORT-PAPER.2 creates a paper-only wager from point-in-time odds',()=>{
  const wager=createSportsPaperWager({strategyId:'nba-edge-v1',quote:quote(),fairProbability:.48,stakeMinor:1000n,currency:'USD',placedAt:'2026-09-21T17:05:00Z',informationCutoff:'2026-09-21T17:00:01Z',evidenceIds:['prediction:p1']})
  assert.equal(wager.estimatedEdge,.08)
  assert.equal(wager.simulationAuthority,'PAPER_ONLY')
  assert.equal(wager.bettingAuthority,'NONE')
  assert.equal(wager.financialAuthority,'NONE')
  assert.equal(wager.canExecute,false)
})

test('SPORT-PAPER.3 settlement produces learning evidence and CLV',()=>{
  const wager=createSportsPaperWager({strategyId:'nba-edge-v1',quote:quote(),fairProbability:.48,stakeMinor:1000n,currency:'USD',placedAt:'2026-09-21T17:05:00Z',informationCutoff:'2026-09-21T17:00:01Z',evidenceIds:['prediction:p1']})
  const settlement=settleSportsPaperWager({wager,status:'WON',resolvedAt:'2026-09-22T01:00:00Z',evidenceIds:['result:g1'],closingQuote:quote({quoteId:'q-close',odds:'+120',observedAt:'2026-09-21T23:00:00Z',availableAt:'2026-09-21T23:00:01Z',evidenceIds:['odds:close']})})
  assert.equal(settlement.payoutMinor,2500n)
  assert.equal(settlement.profitLossMinor,1500n)
  assert.ok((settlement.closingLineValue??0)>0)
  assert.equal(settlement.authority,'LEARNING_ONLY')
  assert.equal(settlement.bettingAuthority,'NONE')
  assert.equal(settlement.canExecute,false)
})

test('SPORT-PAPER.4 future odds and live authority fail closed',()=>{
  assert.throws(()=>createSportsPaperWager({strategyId:'s',quote:quote({availableAt:'2026-09-21T18:00:00Z'}),fairProbability:.5,stakeMinor:100n,currency:'USD',placedAt:'2026-09-21T18:00:01Z',informationCutoff:'2026-09-21T17:30:00Z',evidenceIds:['e']}),/FUTURE_LEAK/)
  const wager=createSportsPaperWager({strategyId:'s',quote:quote(),fairProbability:.5,stakeMinor:100n,currency:'USD',placedAt:'2026-09-21T17:05:00Z',informationCutoff:'2026-09-21T17:00:01Z',evidenceIds:['e']})
  assert.throws(()=>settleSportsPaperWager({wager:{...wager,bettingAuthority:'LIVE' as never},status:'LOST',resolvedAt:'2026-09-22T01:00:00Z',evidenceIds:['result']}),/AUTHORITY_FORBIDDEN/)
})
