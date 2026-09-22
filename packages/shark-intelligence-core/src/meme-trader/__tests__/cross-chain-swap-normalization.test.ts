import {describe,expect,it} from 'vitest'
import {normalizeCrossChainSwapObservation} from '../cross-chain-swap-normalization'

describe('cross-chain wallet-cluster swap normalization',()=>{
 it('canonicalizes EVM addresses while preserving raw amounts and evidence time',()=>{
  const r=normalizeCrossChainSwapObservation({
   evidenceId:'e1',chain:'BASE',transactionId:'0xtx',
   walletAddress:'0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
   tokenIn:'0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
   tokenOut:'0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
   amountInRaw:'1234567',amountOutRaw:'2500000000000000000',tokenInDecimals:6,tokenOutDecimals:18,
   observedAt:'2026-09-21T20:00:00Z',availableAt:'2026-09-21T20:00:01Z',source:'base-rpc'
  })
  expect(r.walletId).toBe('base:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  expect(r.amountInRaw).toBe('1234567');expect(r.amountIn).toBeCloseTo(1.234567);expect(r.amountOut).toBeCloseTo(2.5)
  expect(r.authority).toBe('EVIDENCE_ONLY')
 })
 it('does not lowercase Solana identities',()=>{
  const r=normalizeCrossChainSwapObservation({
   evidenceId:'e2',chain:'SOLANA',transactionId:'sig',
   walletAddress:'11111111111111111111111111111111',tokenIn:'So11111111111111111111111111111111111111112',tokenOut:'11111111111111111111111111111111',
   amountInRaw:'1000000000',amountOutRaw:'2',tokenInDecimals:9,tokenOutDecimals:0,
   observedAt:'2026-09-21T20:00:00Z',availableAt:'2026-09-21T20:00:00Z',source:'solana-rpc'
  })
  expect(r.walletId).toBe('solana:11111111111111111111111111111111');expect(r.amountIn).toBe(1)
 })
 it('fails closed instead of silently rounding unsafe raw token amounts',()=>{
  expect(()=>normalizeCrossChainSwapObservation({evidenceId:'e3',chain:'BASE',transactionId:'t',walletAddress:'0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',tokenIn:'0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',tokenOut:'0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',amountInRaw:'900719925474099300000000',amountOutRaw:'1',tokenInDecimals:0,tokenOutDecimals:0,observedAt:'2026-09-21T20:00:00Z',availableAt:'2026-09-21T20:00:00Z',source:'x'})).toThrow('precision_unsafe')
 })
 it('fails closed on malformed chain addresses or impossible availability',()=>{
  expect(()=>normalizeCrossChainSwapObservation({evidenceId:'e',chain:'BASE',transactionId:'t',walletAddress:'bad',tokenIn:'bad',tokenOut:'bad',amountInRaw:'1',amountOutRaw:'1',tokenInDecimals:0,tokenOutDecimals:0,observedAt:'2026-09-21T20:00:00Z',availableAt:'2026-09-21T20:00:00Z',source:'x'})).toThrow('evm_address_invalid')
 })
})
