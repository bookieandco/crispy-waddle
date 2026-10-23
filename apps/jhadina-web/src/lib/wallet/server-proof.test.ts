import {describe, expect, it} from 'vitest'
import {generateKeyPairSync, sign} from 'node:crypto'
import {buildOwnershipChallenge, decodeSolanaPublicKey, validOwnershipSignature} from './server-proof'

const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function encode58(bytes:Buffer):string{
  let value=BigInt('0x'+bytes.toString('hex'))
  let encoded=''
  while(value>0n){
    encoded=ALPHABET[Number(value%58n)]+encoded
    value/=58n
  }
  for(const byte of bytes){
    if(byte!==0)break
    encoded='1'+encoded
  }
  return encoded
}

describe('Phantom server-owned proof .26',()=>{
  it('verifies an actual Ed25519 signature against exact nonce/origin/expiry',()=>{
    const pair=generateKeyPairSync('ed25519')
    const raw=pair.publicKey.export({format:'der',type:'spki'}).subarray(-32)
    const address=encode58(raw)
    expect(decodeSolanaPublicKey(address)?.equals(raw)).toBe(true)
    const message=buildOwnershipChallenge({walletAddress:address,
      nonce:'ab'.repeat(32),expiresAt:'2026-10-23T19:00:00.000Z',
      origin:'https://jhadina.example'})
    const signature=sign(null,Buffer.from(message),pair.privateKey).toString('base64')
    expect(validOwnershipSignature(message,address,signature)).toBe(true)
    expect(validOwnershipSignature(message+' altered',address,signature)).toBe(false)
    expect(validOwnershipSignature(message.replace('ab'.repeat(32),'cd'.repeat(32)),address,signature)).toBe(false)
    expect(validOwnershipSignature(message.replace('jhadina.example','other.example'),address,signature)).toBe(false)
    const second=generateKeyPairSync('ed25519').publicKey.export({format:'der',type:'spki'}).subarray(-32)
    expect(validOwnershipSignature(message,encode58(second),signature)).toBe(false)
    expect(validOwnershipSignature(message,address,Buffer.alloc(64).toString('base64'))).toBe(false)
  })
  it('rejects malformed key lengths, base64, bogus expiry, address and origin',()=>{
    expect(decodeSolanaPublicKey('PhantomWalletAddress')).toBe(null)
    expect(decodeSolanaPublicKey('0x'+'a'.repeat(40))).toBe(null)
    expect(validOwnershipSignature('message','wallet','')).toBe(false)
    expect(validOwnershipSignature('x'.repeat(100),'1'.repeat(32),'bad!!')).toBe(false)
    const address='1'.repeat(32)
    expect(()=>buildOwnershipChallenge({walletAddress:address,
      nonce:'unsafe',expiresAt:'2026-10-23T19:00:00Z',
      origin:'https://example.org'})).toThrow()
    expect(()=>buildOwnershipChallenge({walletAddress:address,
      nonce:'ab'.repeat(32),expiresAt:'not-a-date',
      origin:'https://example.org'})).toThrow()
    expect(()=>buildOwnershipChallenge({walletAddress:address,
      nonce:'ab'.repeat(32),expiresAt:'2026-10-23T19:00:00Z',
      origin:'http://evil.example'})).toThrow()
  })
})
