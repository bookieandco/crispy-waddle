import {describe,expect,it} from 'vitest'
import {generateKeyPairSync,sign} from 'node:crypto'
import {
 decodeSolanaPublicKey,verifyPhantomOwnership,
 issuePhantomOwnershipChallenge,PHANTOM_CHALLENGE_TTL_MS,
} from './phantom-ownership-proof'

const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const toBase58=(bytes:Buffer)=>{
 let n=BigInt('0x'+bytes.toString('hex'))
 let result=''
 while(n>0n){result=alphabet[Number(n%58n)]+result;n/=58n}
 for(const value of bytes){if(value!==0)break;result='1'+result}
 return result
}
const keys=generateKeyPairSync('ed25519')
const address=toBase58(keys.publicKey.export({type:'spki',format:'der'}).subarray(-32))
const userId='11111111-2222-4333-8444-555555555555'
describe('Phantom .07 Ed25519 wallet ownership verification',()=>{
 it('accepts only valid signatures over the original server challenge bytes',()=>{
  const challenge=issuePhantomOwnershipChallenge({address,userId,origin:'https://jhadina.example',
   now:new Date('2026-10-21T20:00:00.000Z')})
  const signatureBase64=sign(null,Buffer.from(challenge.message,'utf8'),keys.privateKey).toString('base64')
  expect(verifyPhantomOwnership({address,message:challenge.message,signatureBase64})).toBe(true)
  expect(verifyPhantomOwnership({address,message:challenge.message+' altered',signatureBase64})).toBe(false)
  expect(verifyPhantomOwnership({address,message:challenge.message.replace(userId,'other'),signatureBase64})).toBe(false)
  expect(challenge.message).toContain('not a transaction')
  expect(Date.parse(challenge.expiresAt)-Date.parse(challenge.createdAt)).toBe(PHANTOM_CHALLENGE_TTL_MS)
  expect(decodeSolanaPublicKey(address)).toHaveLength(32)
 })
 it('rejects a signature from a different wallet without accepting an address claim',()=>{
  const other=generateKeyPairSync('ed25519')
  const challenge=issuePhantomOwnershipChallenge({address,userId,origin:'https://jhadina.example'})
  const signatureBase64=sign(null,Buffer.from(challenge.message),other.privateKey).toString('base64')
  expect(verifyPhantomOwnership({address,message:challenge.message,signatureBase64})).toBe(false)
 })
 it('denies bad base58 addresses, malformed base64, nonpublic or unsafe origins',()=>{
  expect(()=>decodeSolanaPublicKey('bogus')).toThrow('MONEY_PHANTOM_ADDRESS_INVALID')
  expect(()=>decodeSolanaPublicKey('0'.repeat(32))).toThrow('MONEY_PHANTOM_ADDRESS_INVALID')
  expect(()=>verifyPhantomOwnership({address,message:'challenge',signatureBase64:'AA=='})).toThrow('MONEY_PHANTOM_SIGNATURE_INVALID')
  expect(()=>issuePhantomOwnershipChallenge({address,userId,origin:'http://untrusted.example'})).toThrow('MONEY_PHANTOM_CHALLENGE_ORIGIN_INVALID')
 })
})
