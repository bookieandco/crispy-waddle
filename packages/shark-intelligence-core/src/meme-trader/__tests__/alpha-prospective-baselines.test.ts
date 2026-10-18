import {describe,expect,it} from 'vitest'
import {compareFrozenAlphaBaselines} from '../alpha-prospective-baselines'
const a='2'.repeat(32),b='3'.repeat(32)
const strategies=['SHARK_FUSED','CHAIN_ONLY','MOMENTUM_ONLY'] as const
const decision=(mint:string,strategy:typeof strategies[number],d:'HIGHLIGHT'|'ABSTAIN')=>({
 mint,strategy,decision:d,frozenAt:'2026-10-17T00:00:00Z',
 evidenceAvailableAt:'2026-10-16T23:59:59Z',receiptId:'frozen:'+strategy+mint,
})
const outcomes=[{mint:a,horizon:'24H_PRICE_ONLY' as const,
 markedAt:'2026-10-18T00:00:00Z',availableAt:'2026-10-18T00:00:01Z',
 priceDirection:'UP' as const,samePoolVerified:true,receiptId:'mark:a'},
 {mint:b,horizon:'24H_PRICE_ONLY' as const,
 markedAt:'2026-10-18T00:00:00Z',availableAt:'2026-10-18T00:00:01Z',
 priceDirection:'CENSORED' as const,samePoolVerified:false,receiptId:'mark:b'}]
const decisions=strategies.flatMap(s=>[
 decision(a,s,s==='MOMENTUM_ONLY'?'ABSTAIN':'HIGHLIGHT'),
 decision(b,s,s==='SHARK_FUSED'?'ABSTAIN':'HIGHLIGHT'),
])
describe('point-in-time frozen, same-denominator baselines .15',()=>{
 it('compares only prospective price marks; never claims realized profitability',()=>{
  const r=compareFrozenAlphaBaselines({cohortMints:[a,b],decisions,outcomes,asOf:'2026-10-18T02:00:00Z'})
  expect(r.sameUniverse).toBe(true)
  expect(r.comparablePairedPriceMarks).toBe(1)
  expect(r.summaries.find(s=>s.strategy==='SHARK_FUSED')?.upwardPriceMarkRate).toBe(1)
  expect(r.summaries.find(s=>s.strategy==='CHAIN_ONLY')?.unresolvedHighlighted).toBe(1)
  expect(r.summaries.find(s=>s.strategy==='MOMENTUM_ONLY')?.upwardPriceMarkRate).toBeUndefined()
  expect(r.executablePnlVerified).toBe(false)
  expect(r.assumedFeesOrSlippageNotUsed).toBe(true)
  expect(r.realEntryFills).toBe(0)
  expect(r.canTrade).toBe(false)
 })
 it('rejects a baseline with missing decisions, duplicated submissions or hindsight changes',()=>{
  const input={cohortMints:[a,b],decisions,outcomes,asOf:'2026-10-18T02:00:00Z'}
  expect(()=>compareFrozenAlphaBaselines({...input,decisions:decisions.slice(1)})).toThrow('missing_frozen_decision')
  expect(()=>compareFrozenAlphaBaselines({...input,decisions:[...decisions,decisions[0]!]})).toThrow('decision_invalid')
  expect(()=>compareFrozenAlphaBaselines({...input,decisions:decisions.map(d=>d.mint===a&&d.strategy==='SHARK_FUSED'?{
    ...d,frozenAt:'2026-10-18T01:00:00Z',evidenceAvailableAt:'2026-10-18T01:00:00Z',
  }:d)})).toThrow('hindsight_decision')
  expect(()=>compareFrozenAlphaBaselines({...input,outcomes:[{...outcomes[0]!,availableAt:'2026-10-19T00:00:00Z'}]})).toThrow('outcome_invalid')
 })
})
