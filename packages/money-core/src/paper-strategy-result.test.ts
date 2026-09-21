import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizePaperStrategyResult } from './paper-strategy-result.js'
import type { PaperExecutionOutcome, PaperPortfolio } from './paper-execution-contracts.js'

const portfolio:PaperPortfolio={
  paperPortfolioId:'p1',paperRunId:'run1',currency:'USD',cash:{minor:159800n,currency:'USD'},
  positions:[{instrumentId:'meme:x',quantityMicros:6000000n,costBasis:{minor:60060n,currency:'USD'},marketValue:{minor:84000n,currency:'USD'},unrealizedPnl:{minor:23940n,currency:'USD'},evidenceIds:['mark:1']}],
  realizedPnl:{minor:19860n,currency:'USD'},feesPaid:{minor:200n,currency:'USD'},asOf:'2026-09-21T20:10:00Z',stateHash:'portfolio-state',authority:'SIMULATION_ONLY'
}
const outcome:PaperExecutionOutcome={
  outcomeId:'out1',paperRunId:'run1',executionPlanId:'plan1',requestedNotional:{minor:100000n,currency:'USD'},filledNotional:{minor:100000n,currency:'USD'},fillRateBps:10000,weightedSlippageBps:10,feesPaid:{minor:200n,currency:'USD'},terminalState:'FILLED',createdAt:'2026-09-21T20:09:00Z',evidenceIds:['fill:1'],authority:'LEARNING_ONLY'
}

test('043-strategy.1 reconciles portfolio economics before producing learning truth',()=>{
 const r=summarizePaperStrategyResult({paperRunId:'run1',startingValue:{minor:200000n,currency:'USD'},finalPortfolio:portfolio,executionOutcomes:[outcome],startedAt:'2026-09-21T20:00:00Z',endedAt:'2026-09-21T20:11:00Z'})
 assert.equal(r.endingValue.minor,243800n)
 assert.equal(r.totalPnl.minor,43800n)
 assert.equal(r.realizedPnl.minor+r.unrealizedPnl.minor,r.totalPnl.minor)
 assert.equal(r.returnBps,2190)
 assert.equal(r.terminalState,'OPEN')
 assert.equal(r.authority,'LEARNING_ONLY')
})

test('043-strategy.2 refuses inconsistent portfolio accounting',()=>{
 const bad={...portfolio,realizedPnl:{minor:0n,currency:'USD'}}
 assert.throws(()=>summarizePaperStrategyResult({paperRunId:'run1',startingValue:{minor:200000n,currency:'USD'},finalPortfolio:bad,executionOutcomes:[outcome],startedAt:'2026-09-21T20:00:00Z',endedAt:'2026-09-21T20:11:00Z'}),/PNL_RECONCILIATION_FAILED/)
})
