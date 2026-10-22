import {describe,it,expect,vi} from 'vitest'
import {runSharkPublicPilotOnce} from './shark-pilot-once'
import type {runMemeAssessmentCycle} from './meme-assessment-worker'
const mint='2'.repeat(32),pair='3'.repeat(32),quote='4'.repeat(32)
const at='2026-10-21T19:01:00Z'
const cycle={assessment:{market:{chainId:'solana',subjectId:mint}}} as unknown as Parameters<typeof runMemeAssessmentCycle>[0]
const payload=[{chainId:'solana',dexId:'pump',pairAddress:pair,
 baseToken:{address:mint},quoteToken:{address:quote},
 priceUsd:'0.2',marketCap:20000,volume:{h1:2400},liquidity:{usd:10000},
 info:{socials:[{platform:'x'}],websites:[]}}]
const fetcher=vi.fn(async()=>({ok:true,status:200,text:async()=>JSON.stringify(payload)}))
const stage={mint,pairAddress:pair,stage:'NEW_PAIR' as const,
 observedAt:'2026-10-21T19:00:00Z',availableAt:'2026-10-21T19:00:30Z',
 verifiedByCanonicalLifecycle:true,evidenceIds:['pump-receipt']}
const common={mint,originalPairAddress:pair,availableAt:at,
 sourceReceiptId:'dex-read-1',presetId:'VIDEO1_NEW_PAIR_SOL_V1' as const,cycle}
describe('SHARK-PILOT.34 manually invoked canonical bridge',()=>{
 it('does not persist when stage, terminal fee or provider information is missing',async()=>{
  const execute=vi.fn() as unknown as typeof runMemeAssessmentCycle
  const noStage=await runSharkPublicPilotOnce(common,{fetcher,executeCycle:execute})
  expect(noStage.assessmentInvoked).toBe(false)
  const noFee=await runSharkPublicPilotOnce({...common,stage},{fetcher,executeCycle:execute})
  expect(noFee.assessmentInvoked).toBe(false)
  expect(noFee.reason).toBe('REVIEW')
  expect(execute).not.toHaveBeenCalled()
 })
 it('uses canonical intelligence cycle once on a match and never grants trade authority',async()=>{
  const execute=vi.fn(async()=>({assessment:{
   assessmentId:'assess-1',assessedAt:'2026-10-21T19:01:10Z',
   token:{chainId:'solana',tokenAddress:mint},
   rugProtection:{disposition:'ALLOW_CANDIDATE'},
   rugSelfProtection:{action:'ALLOW_PAPER_STUDY',missingCriticalCoverage:[]},
   riskAssessment:{band:'candidate'},evidenceIds:['assessed'],
  }})) as unknown as typeof runMemeAssessmentCycle
  const fee={chainId:'solana' as const,mint,terminal:'fixture-terminal',
   metricName:'GLOBAL_FEES_PAID' as const,metricDefinition:'fixture-unverified',
   currency:'SOL' as const,amount:0.4,
   observedAt:'2026-10-21T19:00:59Z',availableAt:'2026-10-21T19:00:59Z',
   evidenceId:'terminal-receipt',providerVersion:'fixture-v1'}
  const result=await runSharkPublicPilotOnce({...common,stage,terminalFee:fee},
   {fetcher,executeCycle:execute})
  expect(result.assessmentInvoked).toBe(true)
  expect(execute).toHaveBeenCalledTimes(1)
  expect(result.canTrade).toBe(false)
  expect(result.canSign).toBe(false)
  expect(result.canSpend).toBe(false)
 })
 it('rejects mismatched canonical subject before provider IO',async()=>{
  fetcher.mockClear()
  await expect(runSharkPublicPilotOnce({...common,cycle:{
    assessment:{market:{chainId:'solana',subjectId:quote}}} as never},
    {fetcher})).rejects.toThrow('canonical_mint_mismatch')
  expect(fetcher).not.toHaveBeenCalled()
 })
})
