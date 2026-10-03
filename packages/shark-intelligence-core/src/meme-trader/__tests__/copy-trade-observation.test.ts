import {describe,expect,it} from 'vitest'
import {assessCopyTradeReflexivity,observeWalletTradeSignal,resolveCopyTradeSignal} from '../copy-trade-observation'
describe('copy-trade observation telemetry',()=>{
 it('measures latency without authorizing a copied trade',()=>{
  const s=observeWalletTradeSignal({evidenceId:'chain:1',chainId:'solana-mainnet',walletId:'wallet:abc',tokenAddress:'TOKEN',side:'BUY',venue:'PUMPSWAP',transactionId:'sig',observedAt:'2026-09-21T20:00:00.000Z',availableAt:'2026-09-21T20:00:00.250Z'})
  expect(s.observationLagMs).toBe(250);expect(s.availableAt).toBe('2026-09-21T20:00:00.250Z');expect(s.timingClass).toBe('SUB_SECOND');expect(s.canAutoCopy).toBe(false);expect(s.canAuthorizeTrade).toBe(false)
  const o=resolveCopyTradeSignal({signal:s,resolvedAt:'2026-09-21T21:00:00Z',returnBps:1200,evidenceIds:['market:resolve']})
  expect(o.memoryTier).toBe('LEARNED');expect(o.authority).toBe('LEARNING_ONLY');expect(o.canAutoCopy).toBe(false)
  expect(()=>resolveCopyTradeSignal({signal:s,resolvedAt:'2026-09-21T20:00:00.100Z',returnBps:1,evidenceIds:['bad']})).toThrow('resolution_before_signal_available')
 })

 it('flags rapid small repeat buys as reflexive copy-risk evidence without alleging motive',()=>{
  const base=Date.parse('2026-09-21T20:00:00Z')
  const mk=(id:string,seconds:number,quote:string)=>observeWalletTradeSignal({
   evidenceId:'chain:'+id,chainId:'solana-mainnet',walletId:'wallet:leader',tokenAddress:'TOKEN',side:'BUY',venue:'PUMPFUN',
   transactionId:id,observedAt:new Date(base+seconds*1000).toISOString(),availableAt:new Date(base+seconds*1000+250).toISOString(),quoteAmountRaw:quote,
  })
  const result=assessCopyTradeReflexivity([
   mk('a',0,'1000000'),
   mk('b',10,'100000'),
   mk('c',20,'80000'),
   mk('d',30,'50000'),
  ])
  expect(result.band).toBe('HIGH')
  expect(result.rapidRepeatBuyCount).toBe(3)
  expect(result.smallRepeatBuyCount).toBe(3)
  expect(result.reasons).toContain('small-repeat-buys-after-initial-entry')
  expect(result.canAutoCopy).toBe(false)
  expect(result.canAuthorizeTrade).toBe(false)
 })

 it('does not treat a single observed buy as reflexive farming evidence',()=>{
  const signal=observeWalletTradeSignal({
   evidenceId:'chain:single',chainId:'solana-mainnet',walletId:'wallet:leader',tokenAddress:'TOKEN',side:'BUY',venue:'PUMPSWAP',
   transactionId:'single',observedAt:'2026-09-21T20:00:00Z',availableAt:'2026-09-21T20:00:01Z',quoteAmountRaw:'1000000',
  })
  const result=assessCopyTradeReflexivity([signal])
  expect(result.band).toBe('LOW')
  expect(result.riskScore).toBe(0)
 })

})
