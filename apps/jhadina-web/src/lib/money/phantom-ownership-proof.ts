import {createPublicKey,verify,randomBytes,randomUUID} from 'node:crypto'

const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const spkiPrefix=Buffer.from('302a300506032b6570032100','hex')

/** Intentionally strict decoding: never accept an arbitrary address-shaped
 * string as proof of key possession. Phantom Solana keys are 32-byte Ed25519.
 */
export function decodeSolanaPublicKey(value:unknown):Buffer{
 if(typeof value!=='string'||!value||value.length>44)throw new Error('MONEY_PHANTOM_ADDRESS_INVALID')
 let n=0n
 for(const ch of value){
  const digit=alphabet.indexOf(ch)
  if(digit<0)throw new Error('MONEY_PHANTOM_ADDRESS_INVALID')
  n=n*58n+BigInt(digit)
 }
 const bytes:number[]=[]
 while(n>0n){bytes.unshift(Number(n&255n));n>>=8n}
 const leading=value.match(/^1*/)?.[0].length??0
 const decoded=Buffer.from([...Array(leading).fill(0),...bytes])
 if(decoded.length!==32)throw new Error('MONEY_PHANTOM_ADDRESS_INVALID')
 return decoded
}
function canonicalSignature(value:unknown):Buffer{
 if(typeof value!=='string'||value.length>128||
  !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw new Error('MONEY_PHANTOM_SIGNATURE_INVALID')
 const decoded=Buffer.from(value,'base64')
 if(decoded.length!==64||decoded.toString('base64')!==value)throw new Error('MONEY_PHANTOM_SIGNATURE_INVALID')
 return decoded
}

export function verifyPhantomOwnership(input:{address:string;message:string;signatureBase64:string}):boolean{
 const key=decodeSolanaPublicKey(input.address)
 const signature=canonicalSignature(input.signatureBase64)
 if(!input.message||input.message.length>2048)throw new Error('MONEY_PHANTOM_CHALLENGE_INVALID')
 return verify(null,Buffer.from(input.message,'utf8'),createPublicKey({
  key:Buffer.concat([spkiPrefix,key]),format:'der',type:'spki',
 }),signature)
}

export const PHANTOM_CHALLENGE_TTL_MS=5*60*1000

export function issuePhantomOwnershipChallenge(input:{address:string;userId:string;origin:string;now?:Date}){
 decodeSolanaPublicKey(input.address)
 if(!/^[0-9a-f-]{36}$/i.test(input.userId))throw new Error('MONEY_WALLET_SESSION_REQUIRED')
 const url=new URL(input.origin)
 if((url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')||url.pathname!=='/'){
  throw new Error('MONEY_PHANTOM_CHALLENGE_ORIGIN_INVALID')
 }
 const now=input.now??new Date()
 const expiresAt=new Date(now.getTime()+PHANTOM_CHALLENGE_TTL_MS)
 const nonce=randomBytes(32).toString('hex')
 const challengeId=randomUUID()
 const message=[
  'Jhadina wallet ownership verification',
  'Domain: '+url.origin,
  'Network: Solana mainnet',
  'Wallet: '+input.address,
  'Session: '+input.userId,
  'Nonce: '+nonce,
  'Issued at: '+now.toISOString(),
  'Expires at: '+expiresAt.toISOString(),
  'Purpose: verify wallet ownership for read-only Jhadina Money Core.',
  'This message is not a transaction and does not authorize transfers or trading.',
 ].join('\n')
 return Object.freeze({challengeId,nonce,message,expiresAt:expiresAt.toISOString(),createdAt:now.toISOString()})
}
