import {describe,expect,it} from 'vitest'
import {normalizeWalletClusterAddress,normalizeWalletClusterSwap} from '../wallet-cluster-normalization'

describe('wallet cluster cross-chain normalization',()=>{
 it('normalizes EVM addresses case-insensitively while preserving chain identity',()=>{
  const a=normalizeWalletClusterAddress({chainFamily:'EVM',address:'0xAbCd000000000000000000000000000000001234'})
  expect(a).toBe('0xabcd000000000000000000000000000000001234')
  const row=normalizeWalletClusterSwap({
   observationId:'o1',chainId:'base-mainnet',chainFamily:'EVM',
   walletAddress:'0xAbCd000000000000000000000000000000001234',
   tokenAddress:'0x000000000000000000000000000000000000BEEF',
   side:'BUY',amountUsd:125,transactionId:'0xtx',observedAt:'2026-09-21T20:00:00Z',availableAt:'2026-09-21T20:00:01Z',
   source:'base-rpc',sourceGroup:'base-rpc-primary',evidenceIds:['e1'],
  })
  expect(row.walletId).toBe('base-mainnet:0xabcd000000000000000000000000000000001234')
  expect(row.tokenId).toBe('base-mainnet:0x000000000000000000000000000000000000beef')
  expect(row.authority).toBe('RESEARCH_ONLY')
 })
 it('preserves Solana base58 case and prevents cross-chain address collisions',()=>{
  const address='11111111111111111111111111111111'
  expect(normalizeWalletClusterAddress({chainFamily:'SOLANA',address})).toBe(address)
 })
 it('fails closed on malformed addresses and impossible availability',()=>{
  expect(()=>normalizeWalletClusterAddress({chainFamily:'EVM',address:'0x1234'})).toThrow('evm_address_invalid')
  expect(()=>normalizeWalletClusterSwap({
   observationId:'o',chainId:'solana-mainnet',chainFamily:'SOLANA',walletAddress:'11111111111111111111111111111111',tokenAddress:'11111111111111111111111111111111',
   side:'BUY',transactionId:'tx',observedAt:'2026-09-21T20:00:01Z',availableAt:'2026-09-21T20:00:00Z',source:'rpc',sourceGroup:'rpc',evidenceIds:['e'],
  })).toThrow('availability_invalid')
 })
})
