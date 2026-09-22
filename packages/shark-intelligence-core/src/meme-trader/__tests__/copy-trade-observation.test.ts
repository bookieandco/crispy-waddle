import {describe,expect,it} from 'vitest'
import {observeWalletTradeSignal,resolveCopyTradeSignal} from '../copy-trade-observation'
describe('copy-trade observation telemetry',()=>{
 it('measures latency without authorizing a copied trade',()=>{
  const s=observeWalletTradeSignal({evidenceId:'chain:1',chainId:'solana-mainnet',walletId:'wallet:abc',tokenAddress:'TOKEN',side:'BUY',venue:'PUMPSWAP',transactionId:'sig',observedAt:'2026-09-21T20:00:00.000Z',availableAt:'2026-09-21T20:00:00.250Z'})
  expect(s.observationLagMs).toBe(250);expect(s.availableAt).toBe('2026-09-21T20:00:00.250Z');expect(s.timingClass).toBe('SUB_SECOND');expect(s.canAutoCopy).toBe(false);expect(s.canAuthorizeTrade).toBe(false)
  const o=resolveCopyTradeSignal({signal:s,resolvedAt:'2026-09-21T21:00:00Z',returnBps:1200,evidenceIds:['market:resolve']})
  expect(o.memoryTier).toBe('LEARNED');expect(o.authority).toBe('LEARNING_ONLY');expect(o.canAutoCopy).toBe(false)
  expect(()=>resolveCopyTradeSignal({signal:s,resolvedAt:'2026-09-21T20:00:00.100Z',returnBps:1,evidenceIds:['bad']})).toThrow('resolution_before_signal_available')
 })
})