import {describe,expect,it} from 'vitest'
import {runSniperPaperCycle} from './sniper-paper-cycle'

const now='2026-10-21T20:00:04Z'
const tokenAddress='MINT'
const instrumentId='solana-mainnet:'+tokenAddress
const currency='SOL_LAMPORTS'
const model={modelVersion:'paper-v1',liquidityFillBps:10000,slippageBps:0,feeBps:100,passiveFillBps:10000,assumptionIds:['fee:paper-model']}
const market=(id:string,price:bigint,availableAt:string)=>({
 snapshotId:id,instrumentId,currency,bidMinor:price,askMinor:price,bidSize:'100',askSize:'100',
 visibleDepthNotionalMinor:5000000n,observedAt:availableAt,availableAt,
 expiresAt:'2026-10-21T20:00:30Z',evidenceIds:['pool:'+id],provenanceHash:'hash:'+id,
})
const order=(side:'BUY'|'SELL',notional:bigint,snapshotId:string)=>({
 paperOrderId:'order:'+side,paperRunId:'run:1',executionPlanId:'plan:'+side,sliceId:'slice:'+side,
 instrumentId,side,requestedNotional:{minor:notional,currency},instruction:'MARKETABLE_LIMIT' as const,
 limitPriceMinor:1n,submittedAt:'2026-10-21T20:00:00Z',expiresAt:'2026-10-21T20:00:20Z',
 marketSnapshotId:snapshotId,state:'OPEN' as const,authority:'SIMULATION_ONLY' as const,
})
const leg=(side:'BUY'|'SELL')=>side==='BUY'
 ?{order:order('BUY',1000000n,'m1'),market:market('m1',100000n,'2026-10-21T20:00:00Z'),filledAt:'2026-10-21T20:00:01Z',model}
 :{order:order('SELL',1200000n,'m2'),market:market('m2',120000n,'2026-10-21T20:00:01Z'),filledAt:'2026-10-21T20:00:02Z',model}
const entry=leg('BUY'),exit=leg('SELL')
const fee=(id:string)=>({signatureBaseFeeLamports:5000n,computeUnitLimit:200000,microLamportsPerComputeUnit:1000n,
 jitoTipLamports:0n,nonRecoverableRentLamports:0n,evidenceId:id})
const purse={authority:'OPPORTUNITY_BUS_ONLY',canExecute:false,admitted:true,
 ingestedAt:'2026-10-21T20:00:01Z',busEventId:'purse:1',
 opportunity:{opportunityId:'opp:1',sourceKind:'SHARK',lane:'MEME',instrumentId,evidenceIds:['purse:1']},
} as any
const shadow={authority:'SHADOW_DECISION_ONLY',canExecute:false,decisionId:'shadow:1',
 tokenAddress,decidedAt:'2026-10-21T20:00:01Z',
 market:{availableAt:'2026-10-21T20:00:01Z'},evidenceIds:['shadow:1'],
} as any
const standard={
 tokenAddress,tradeId:'trade1',now,
 riskEvidence:{chainId:'solana-mainnet' as const,tokenAddress,observedAt:'2026-10-21T20:00:03Z',
  availableAt:'2026-10-21T20:00:03Z',evidenceIds:['chain:slot:1'],proof:'CHAIN_ATTESTED' as const,
  confirmedSellRoute:true,exitLiquidityLamports:10000000n,creatorClusterChecked:true,
  independentHolderCoverage:true,lpControlChecked:true,tokenAuthorityChecked:true},
 rugInput:{evidence:[{source:'chain',observedAt:now,label:'chain:slot:1'}]},
 maxRiskEvidenceAgeMs:5000,
 landingCandidates:[{lane:'STANDARD_RPC' as const,evidenceId:'route:1',observedAt:'2026-10-21T20:00:03Z',
  entry:fee('fee:entry'),exit:fee('fee:exit'),quoteRelativeEdgeBps:200,extraAdverseSlippageBps:40}],
 landingObservations:[{observationId:'landing:1',lane:'STANDARD_RPC' as const,availableAt:'2026-10-21T20:00:03Z',
  outcome:'LANDED' as const,source:'CHAIN_ATTESTED' as const,landingDelayMs:350}],
 maxQuoteAgeMs:5000,minLandingSamples:1,notionalLamports:100000000n,minimumNetEdgeBps:10,maxFixedCostBps:10,
 entry,exit,exitRouteAttested:true,paperStartingCashMinor:3000000n,paperMarkPriceMinor:120000n,
 purse,shadow,evidenceIds:['study:1'],
}
describe('SHARK->Money paper->Shadow/Purse coordination',()=>{
 it('produces non-executing accepted paper receipt after all independent checks',()=>{
  const result=runSniperPaperCycle(standard)
  expect(result.disposition).toBe('PAPER_RECORDED')
  expect(result.acceptance?.status).toBe('PAPER_CLOSED_ACCEPTED')
  expect(result.paper?.realizedNetPnlMinor).toBe(178000n)
  expect(result.acceptance?.handoff.purseAccountingCandidate).toBe(false)
  expect(result.canExecute).toBe(false)
 })
 it('hard rug veto short-circuits paper fills and cannot be overridden by positive quotes',()=>{
  const result=runSniperPaperCycle({...standard,rugInput:{nonTransferable:true,evidence:standard.rugInput.evidence}})
  expect(result.disposition).toBe('NO_TRADE')
  expect(result.risk.mechanisms.map(x=>x.mechanism)).toContain('SELL_RESTRICTION')
  expect(result.paper).toBeUndefined()
 })
 it('missing reverse route cannot be mistaken for a closed position',()=>{
  const result=runSniperPaperCycle({...standard,exitRouteAttested:false})
  expect(result.paper?.status).toBe('OPEN_NO_SELL_ROUTE')
  expect(result.acceptance?.status).toBe('PAPER_INCOMPLETE')
 })
})
