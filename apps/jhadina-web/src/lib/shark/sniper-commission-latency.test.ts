import {describe,it,expect} from 'vitest'
import {summarizeSniperWebhookTiming} from './sniper-commission-latency'
import type {SniperIngressBatchReceipt} from './sniper-live-ingress'
const sample=(delay:number,processing:number):SniperIngressBatchReceipt=>({
 received:1,accepted:1,ignored:0,duplicates:0,persisted:1,
 launches:[{launchId:'launch:'+delay,observationId:'ob:'+delay,
 tokenAddress:'2'.repeat(32),signature:'4'.repeat(87),slot:99,
 discoveryDelayMs:delay,localProcessingMs:processing,
 verification:'PROVISIONAL_UNVERIFIED'}],
 authority:'INGRESS_EVIDENCE_ONLY',canExecute:false,
})
describe('COMMISSION.19 true-scope ingress percentile research',()=>{
 it('computes stage statistics but refuses subsecond end-to-end certification',()=>{
  const r=summarizeSniperWebhookTiming([sample(600,3),sample(900,6),sample(1800,12)])
  expect(r.providerTimestampToReceiptMs).toEqual({p50:900,p95:1800,p99:1800})
  expect(r.processingMs).toEqual({p50:6,p95:12,p99:12})
  expect(r.observedLaunches).toBe(3)
  expect(r.providerTimeResolution).toBe('SECONDS')
  expect(r.meetsSubsecondEndToEndSla).toBe(false)
  expect(r.observedTradeSubmissions).toBe(0)
  expect(r.canTrade).toBe(false)
 })
 it('empty source proves neither zero launches nor an SLA',()=>{
  const r=summarizeSniperWebhookTiming([])
  expect(r.providerTimestampToReceiptMs).toBeUndefined()
  expect(r.observedLaunches).toBe(0)
  expect(r.meetsSubsecondEndToEndSla).toBe(false)
 })
 it('rejects forged verification authority, corrupt counts and bad stage clocks',()=>{
  expect(()=>summarizeSniperWebhookTiming([{
   ...sample(10,2),received:2,
  }])).toThrow('PROVENANCE_INVALID')
  expect(()=>summarizeSniperWebhookTiming([{
   ...sample(10,2),launches:[{...sample(10,2).launches[0]!,discoveryDelayMs:-1}],
  }])).toThrow('PROVENANCE_INVALID')
  expect(()=>summarizeSniperWebhookTiming([{
   ...sample(10,2),canExecute:true,
  } as unknown as SniperIngressBatchReceipt])).toThrow('PROVENANCE_INVALID')
 })
})
