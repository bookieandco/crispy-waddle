import {describe,expect,it} from 'vitest'
import {canonicalTokenNodeId,canonicalWalletNodeId,chainIdentityFamily,normalizeChainAddress,sameChainAddress} from '../chain-identity'

describe('chain-aware SHARK identity normalization',()=>{
  it('canonicalizes Base/EVM checksum casing without changing identity',()=>{
    const a='0xAbCdEf0000000000000000000000000000001234'
    const b='0xabcdef0000000000000000000000000000001234'
    expect(chainIdentityFamily('base-mainnet')).toBe('EVM')
    expect(normalizeChainAddress('base-mainnet',a)).toBe(b)
    expect(sameChainAddress('eip155:8453',a,b)).toBe(true)
    expect(canonicalWalletNodeId('8453',a)).toBe(`wallet:${b}`)
    expect(canonicalTokenNodeId('base-mainnet',a)).toBe(`token:base-mainnet:${b}`)
  })

  it('preserves Solana case because base58 identity is case-sensitive',()=>{
    expect(chainIdentityFamily('solana-mainnet')).toBe('SOLANA')
    expect(normalizeChainAddress('solana-mainnet','AbC123')).toBe('AbC123')
    expect(sameChainAddress('solana-mainnet','AbC123','abc123')).toBe(false)
  })

  it('preserves unknown-chain identity instead of guessing',()=>{
    expect(chainIdentityFamily('future-chain')).toBe('UNKNOWN')
    expect(normalizeChainAddress('future-chain','MixedCaseIdentity')).toBe('MixedCaseIdentity')
  })

  it('fails closed on malformed EVM addresses',()=>{
    expect(()=>normalizeChainAddress('base','0x1234')).toThrow('chain_identity_evm_address_invalid')
  })
})


it('recognizes Robinhood Chain mainnet and testnet as EVM identities',()=>{
  expect(chainIdentityFamily('4663')).toBe('EVM')
  expect(chainIdentityFamily('46630')).toBe('EVM')
  expect(chainIdentityFamily('robinhood-mainnet')).toBe('EVM')
  expect(chainIdentityFamily('robinhood-chain-testnet')).toBe('EVM')
  expect(normalizeChainAddress('4663','0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
})
