import test from 'node:test'
import assert from 'node:assert/strict'
import {runSniperPaperRoundTrip,SniperPaperSoakLedger} from './sniper-paper-soak.js'
import {acceptSniperLiveWiringPaper} from './sniper-live-wiring-acceptance.js'
import type {ExecutionMarketSnapshot} from './execution-planning-contracts.js'
import type {PaperOrder,PaperFillModel} from './paper-execution-contracts.js'
import type {PurseOpportunityEnvelope} from './purse-opportunity-bus.js'
import type {SharkShadowDecisionTwin} from './shark-shadow-learning.js'
import type {SniperLandingComparison} from './sniper-landing-route-study.js'

const tokenAddress='MINT'
const instrumentId='solana-mainnet:'+tokenAddress
const runId='paper:session:1'
const currency='SOL_LAMPORTS'
const entryAt='2026-10-21T20:00:01Z'
const exitAt='2026-10-21T20:00:02Z'
const cutoff='2026-10-21T20:00:04Z'
const model:PaperFillModel={modelVersion:'realism-v1',liquidityFillBps:10000,slippageBps:0,feeBps:100,passiveFillBps:10000,assumptionIds:['paper-assumption:1']}
const market=(id:string,price:bigint,availableAt:string):ExecutionMarketSnapshot=>({
 snapshotId:id,instrumentId,currency,bidMinor:price,askMinor:price,bidSize:'100',askSize:'100',
 visibleDepthNotionalMinor:5000000n,observedAt:availableAt,availableAt,expiresAt:'2026-10-21T20:00:30Z',
 evidenceIds:['market:'+id],provenanceHash:'sha256:'+id,
})
const order=(side:'BUY'|'SELL',notional:bigint,snapshotId:string):PaperOrder=>({
 paperOrderId:'order:'+side,paperRunId:runId,executionPlanId:'plan:'+side,sliceId:'slice:'+side,
 instrumentId,side,requestedNotional:{minor:notional,currency},
 instruction:'MARKETABLE_LIMIT',limitPriceMinor:1n,
 submittedAt:'2026-10-21T20:00:00Z',expiresAt:'2026-10-21T20:00:20Z',
 marketSnapshotId:snapshotId,state:'OPEN',authority:'SIMULATION_ONLY',
})
const entry={order:order('BUY',1000000n,'entry-snapshot'),market:market('entry-snapshot',100000n,'2026-10-21T20:00:00Z'),filledAt:entryAt,model}
const exit={order:order('SELL',1200000n,'exit-snapshot'),market:market('exit-snapshot',120000n,'2026-10-21T20:00:01Z'),filledAt:exitAt,model}
const run=(attested=true)=>runSniperPaperRoundTrip({tokenAddress,entry,exit,exitRouteAttested:attested,
 startingCashMinor:3000000n,markPriceMinor:120000n,asOf:cutoff})
const purse={authority:'OPPORTUNITY_BUS_ONLY',canExecute:false,admitted:true,
 ingestedAt:entryAt,busEventId:'purse:event:1',
 opportunity:{opportunityId:'purse:opp:1',sourceKind:'SHARK',lane:'MEME',instrumentId,evidenceIds:['purse:ev']},
} as unknown as PurseOpportunityEnvelope
const shadow={authority:'SHADOW_DECISION_ONLY',canExecute:false,decisionId:'shadow:1',
 tokenAddress,decidedAt:entryAt,market:{availableAt:entryAt},evidenceIds:['shadow:ev'],
} as unknown as SharkShadowDecisionTwin
const routing={selectedForPaper:'STANDARD_RPC',canSubmit:false,canExecute:false} as SniperLandingComparison
const risk={tokenAddress,disposition:'PAPER_CANDIDATE',authority:'RISK_RESEARCH_ONLY',canExecute:false,reasonCodes:[]} as const
test('Money canonical round trip accounts buy+sell fee in realized net paper PnL',()=>{
 const x=run()
 assert.equal(x.status,'CLOSED')
 assert.equal(x.realizedNetPnlMinor,178000n)
 assert.equal(x.settlement?.kind,'PAPER')
 assert.equal(x.settlement?.independentlyVerified,false)
 assert.equal(x.canCreditPurse,false)
 assert.equal(x.canExecute,false)
 const ledger=new SniperPaperSoakLedger()
 assert.equal(ledger.append('trade1',x),'INSERTED')
 assert.equal(ledger.append('trade1',x),'DUPLICATE')
 assert.equal(ledger.all().length,1)
})
test('missing reverse-route evidence records trapped/open inventory not fake profit',()=>{
 const x=run(false)
 assert.equal(x.status,'OPEN_NO_SELL_ROUTE')
 assert.equal(x.settlement,undefined)
 assert.equal(x.realizedNetPnlMinor,undefined)
})
test('canonical Shadow/Purse handoff stays non-executing and paper never credits real purse',()=>{
 const paper=run()
 const result=acceptSniperLiveWiringPaper({tradeId:'trade1',tokenAddress,informationCutoff:cutoff,
  risk,routing,paper,purse,shadow,evidenceIds:['chain:provenance:1']})
 assert.equal(result.status,'PAPER_CLOSED_ACCEPTED')
 assert.equal(result.netPaperPnlMinor,178000n)
 assert.equal(result.canAuthorizeLive,false)
 assert.equal(result.handoff.shadowReplayReady,false)
 assert.equal(result.handoff.purseAccountingCandidate,false)
 assert.equal(result.handoff.canCreditPurse,false)
})
test('no Shadow or Purse membership cannot masquerade as accepted closed loop',()=>{
 const x=acceptSniperLiveWiringPaper({tradeId:'trade2',tokenAddress,informationCutoff:cutoff,
  risk,routing,paper:run(),evidenceIds:['chain:1']})
 assert.equal(x.status,'PAPER_INCOMPLETE')
 assert.ok(x.reasonCodes.includes('SHADOW_DECISION_MISSING'))
 assert.ok(x.reasonCodes.includes('PURSE_PAPER_OPPORTUNITY_NOT_ADMITTED'))
})
test('deterministic risk veto dominates paper profits',()=>{
 const x=acceptSniperLiveWiringPaper({tradeId:'trade3',tokenAddress,informationCutoff:cutoff,
  risk:{...risk,disposition:'BLOCK'},routing,paper:run(),purse,shadow,evidenceIds:['chain:1']})
 assert.equal(x.status,'BLOCKED')
 assert.equal(x.canExecute,false)
})
