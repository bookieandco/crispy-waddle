import {describe,it,expect,vi} from 'vitest'
import {runSniperLivePaperTick,runSniperReadOnlyLoop,type SniperPaperMonitorRecord} from './sniper-live-paper-monitor'
import type {SniperPublicRead} from './sniper-live-paper-feed'
const now='2026-10-22T20:00:04Z',mint='2'.repeat(32),pair='3'.repeat(32)
const entry=(id:string,queuedAt=now)=>({workId:id,kind:'RESEARCH_ENTRY' as const,queuedAt})
const exit=(id:string)=>({workId:id,kind:'RECONCILE_EXIT' as const,queuedAt:'2026-10-22T19:59:00Z'})
const open={
 positionId:'open:1',tokenAddress:mint,entryConfirmedAt:'2026-10-22T19:58:00Z',
 openTokenAmountAtomic:10n,peakReturnBps:150,markedReturnBps:-2500,
 availableAt:now,evidenceIds:['proof:position'],
}
const policy={maxHoldSeconds:30,profitTakeBps:200,trailingGivebackBps:500,
 maxDrawdownBps:2000,maxQuoteAgeMs:1000}
const price=(name:string):SniperPublicRead=>({
 status:'READ_ONLY_OBSERVED',mint:name,receivedAt:now,
 pair:{mint:name,pairAddress:pair,dexId:'test',priceUsd:.02,
 reportedLiquidityUsd:500,receivedAt:now,observedAt:now,
 source:'DEXSCREENER_PUBLIC_PRICE_ONLY',evidenceId:'dex:1',
 chainProof:false,executableQuote:false,verifiedSellPath:false},
 authority:'PUBLIC_RESEARCH_ONLY',canSign:false,canTrade:false,
})
const verified:SniperPaperMonitorRecord[]=[]
const journal={append:vi.fn(async (r:SniperPaperMonitorRecord)=>{
 verified.push(r);return 'INSERTED' as const
})}
describe('LIVE-PAPER.07–.08 full-path bounded paper orchestration',()=>{
 it('reconciles exits ahead of new discovery and never treats public price as a fill',async()=>{
  verified.length=0;journal.append.mockClear()
  const readPublicPair=vi.fn(async (token:string)=>price(token))
  const r=await runSniperLivePaperTick({
   now,work:[entry('mint1'),exit('exit1')],
   exits:[{workId:'exit1',position:open,policy,unresolvedPreviousExit:true}],
   entries:[{workId:'mint1',mint,originalPairAddress:pair}],
   maxPerTick:2,maxEntryQueueMs:1000,
  },{readPublicPair,store:journal})
  expect(r.records.map(x=>x.workId)).toEqual(['exit1','mint1'])
  expect(r.records[0]?.exitAction).toBe('UNRESOLVED_PREVIOUS_ATTEMPT')
  expect(r.records[1]?.outcome).toBe('CHAIN_PROOF_REQUIRED')
  expect(readPublicPair).toHaveBeenCalledTimes(1)
  expect(r.records.every(x=>x.canExecute===false)).toBe(true)
  expect(r.alwaysOn).toBe(false)
 })
 it('drops expired speculative entries but not old exits',async()=>{
  const r=await runSniperLivePaperTick({
   now,work:[entry('old','2026-10-22T19:00:00Z'),exit('exit1')],
   exits:[{workId:'exit1',position:open,policy,unresolvedPreviousExit:false}],
   entries:[{workId:'old',mint,originalPairAddress:pair}],
   maxPerTick:2,maxEntryQueueMs:1000,
  },{readPublicPair:async()=>price(mint),store:journal})
  expect(r.expiredEntries).toEqual(['old'])
  expect(r.records[0]?.outcome).toBe('EXIT_REVIEW')
  expect(r.records[0]?.exitAction).toBe('EXIT_ROUTE_MISSING')
 })
 it('unknown or mismatched feed cannot launder an unrelated token into the paper cycle',async()=>{
  await expect(runSniperLivePaperTick({
   now,work:[entry('new')],exits:[],entries:[{workId:'new',mint,originalPairAddress:pair}],
   maxPerTick:1,maxEntryQueueMs:1000,
  },{readPublicPair:async()=>price('4'.repeat(32)),store:journal}))
    .rejects.toThrow('FEED_AUTHORITY_INVALID')
 })
 it('rejects a future-received or wrong original pair public response',async()=>{
  const input={
   now,work:[entry('badpair')],exits:[],
   entries:[{workId:'badpair',mint,originalPairAddress:pair}],
   maxPerTick:1,maxEntryQueueMs:1000,
  }
  await expect(runSniperLivePaperTick(input,{
   readPublicPair:async()=>({
    ...price(mint),pair:{...price(mint).pair!,pairAddress:'4'.repeat(32)},
   }),store:journal,
  })).rejects.toThrow('PAIR_OR_RECEIPT_PROVENANCE_INVALID')
  await expect(runSniperLivePaperTick(input,{
   readPublicPair:async()=>({...price(mint),receivedAt:'2026-10-22T20:00:05Z'}),
   store:journal,
  })).rejects.toThrow('PAIR_OR_RECEIPT_PROVENANCE_INVALID')
 })
 it('does not acknowledge a cycle whose journal write failed',async()=>{
  await expect(runSniperLivePaperTick({
   now,work:[exit('fail')],exits:[{workId:'fail',position:open,policy}],
   entries:[],maxPerTick:1,maxEntryQueueMs:1000,
  },{readPublicPair:async()=>price(mint),store:{append:async()=>{throw Error('disk unavailable')}}}))
   .rejects.toThrow('disk unavailable')
 })
 it('explicit loop has finite cap, enforced pacing, abort and no trade authority',async()=>{
  const signal=new AbortController()
  const tick=vi.fn(async()=>{})
  const sleep=vi.fn(async()=>{})
  const result=await runSniperReadOnlyLoop({
   maxCycles:3,minIntervalMs:1000,signal:signal.signal,tick,sleep,
  })
  expect(result.completedCycles).toBe(3)
  expect(tick).toHaveBeenCalledTimes(3)
  expect(sleep).toHaveBeenCalledTimes(2)
  const stopped=new AbortController()
  stopped.abort()
  const none=await runSniperReadOnlyLoop({
   maxCycles:2,minIntervalMs:1000,signal:stopped.signal,tick,sleep,
  })
  expect(none.completedCycles).toBe(0)
  expect(none.aborted).toBe(true)
  await expect(runSniperReadOnlyLoop({
   maxCycles:1,minIntervalMs:50,signal:signal.signal,tick,sleep,
  })).rejects.toThrow('POLICY_INVALID')
 })
})
