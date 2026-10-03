import {describe,expect,it} from 'vitest'
import {decodeBase58,encodeBase58} from '../solana-pda'

describe('Solana Base58 helpers',()=>{
  it('encodes the 32-byte zero public key canonically',()=>{
    expect(encodeBase58(new Uint8Array(32))).toBe('11111111111111111111111111111111')
  })

  it('round-trips public keys with and without leading zero bytes',()=>{
    for(const bytes of [
      Uint8Array.from([0,1,2,3,4,5]),
      Uint8Array.from([1,2,3,4,5]),
      new Uint8Array(32),
    ]){
      expect(decodeBase58(encodeBase58(bytes))).toEqual(bytes)
    }
  })
})
