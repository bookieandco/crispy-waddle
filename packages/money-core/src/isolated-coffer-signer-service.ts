import { createHash,createPrivateKey,createPublicKey,sign,timingSafeEqual,type KeyObject } from 'node:crypto'

const ED25519_PKCS8_SEED_PREFIX=Buffer.from('302e020100300506032b657004220420','hex')
const ED25519_SPKI_PREFIX_LENGTH=12
const BASE58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export type CofferSignerServiceRequest=Readonly<{
 walletConnectionId:string
 signerLeaseId:string
 unsignedTransactionBase64:string
 idempotencyKey:string
 expectedSignerAddress:string
 now:string
}>

export type CofferSignerServiceResult=Readonly<{
 signerAddress:string
 signedTransactionBase64:string
 primarySignature:string
 evidenceId:string
 containsPrivateKey:false
 containsRawToken:false
 authority:'ISOLATED_SIGNER_RECEIPT_ONLY'
}>

export type CofferSignerLeaseVerification=Readonly<{
 allowed:boolean
 reasonCodes:readonly string[]
 evidenceIds:readonly string[]
 authority:'SIGNER_LEASE_VERIFICATION_ONLY'
}>

export type CofferSignerLeaseVerifier=(input:Readonly<{
 walletConnectionId:string
 signerLeaseId:string
 expectedSignerAddress:string
 idempotencyKey:string
 unsignedTransactionHash:string
 now:string
}>)=>Promise<CofferSignerLeaseVerification>|CofferSignerLeaseVerification

function digest(value:Buffer|string):string{return createHash('sha256').update(value).digest('hex')}
function required(value:string,code:string):string{if(!value.trim())throw new Error(code);return value}
function validIso(value:string):boolean{return Boolean(value.trim())&&!Number.isNaN(Date.parse(value))}

function equalText(left:string,right:string):boolean{
 const a=Buffer.from(left),b=Buffer.from(right)
 return a.length===b.length&&timingSafeEqual(a,b)
}

function decodeBase58(value:string):Buffer{
 if(!value.trim())throw new Error('COFFER_SIGNER_BASE58_REQUIRED')
 let n=0n
 for(const char of value){
  const index=BASE58.indexOf(char)
  if(index<0)throw new Error('COFFER_SIGNER_BASE58_INVALID')
  n=n*58n+BigInt(index)
 }
 const bytes:number[]=[]
 while(n>0n){bytes.push(Number(n&255n));n>>=8n}
 bytes.reverse()
 let leading=0
 while(leading<value.length&&value[leading]==='1')leading++
 return Buffer.concat([Buffer.alloc(leading),Buffer.from(bytes)])
}

function encodeBase58(input:Uint8Array):string{
 const bytes=Buffer.from(input)
 let zeros=0
 while(zeros<bytes.length&&bytes[zeros]===0)zeros++
 let n=0n
 for(const byte of bytes)n=(n<<8n)+BigInt(byte)
 let encoded=''
 while(n>0n){const mod=Number(n%58n);encoded=BASE58[mod]+encoded;n/=58n}
 return '1'.repeat(zeros)+(encoded||'')
}

function readShortVec(bytes:Buffer,offset:number):Readonly<{value:number;next:number}>{
 let value=0,shift=0,index=offset
 for(let i=0;i<4;i++){
  if(index>=bytes.length)throw new Error('COFFER_SIGNER_SHORTVEC_TRUNCATED')
  const byte=bytes[index++]
  value|=(byte&0x7f)<<shift
  if((byte&0x80)===0)return Object.freeze({value,next:index})
  shift+=7
 }
 throw new Error('COFFER_SIGNER_SHORTVEC_INVALID')
}

function privateKeyFromSeed(seed:Buffer):KeyObject{
 if(seed.length!==32)throw new Error('COFFER_SIGNER_SEED_LENGTH_INVALID')
 return createPrivateKey({key:Buffer.concat([ED25519_PKCS8_SEED_PREFIX,seed]),format:'der',type:'pkcs8'})
}

function publicKeyBytes(privateKey:KeyObject):Buffer{
 const spki=createPublicKey(privateKey).export({format:'der',type:'spki'})
 const bytes=Buffer.isBuffer(spki)?spki:Buffer.from(spki)
 if(bytes.length<ED25519_SPKI_PREFIX_LENGTH+32)throw new Error('COFFER_SIGNER_PUBLIC_KEY_INVALID')
 return bytes.subarray(bytes.length-32)
}

export function deriveEd25519PublicKeyBase58(seed:Uint8Array):string{
 const copy=Buffer.from(seed)
 try{return encodeBase58(publicKeyBytes(privateKeyFromSeed(copy)))}finally{copy.fill(0)}
}

type ParsedUnsignedTransaction=Readonly<{
 transaction:Buffer
 message:Buffer
 signatureOffset:number
 signerPublicKey:Buffer
}>

function parseSingleSignerUnsignedSolanaTransaction(base64:string):ParsedUnsignedTransaction{
 let tx:Buffer
 try{tx=Buffer.from(required(base64,'COFFER_SIGNER_TRANSACTION_REQUIRED'),'base64')}catch{throw new Error('COFFER_SIGNER_TRANSACTION_BASE64_INVALID')}
 if(!tx.length||tx.toString('base64')!==base64.replace(/\s+/g,''))throw new Error('COFFER_SIGNER_TRANSACTION_BASE64_INVALID')
 const sigCount=readShortVec(tx,0)
 if(sigCount.value!==1)throw new Error('COFFER_SIGNER_SINGLE_SIGNER_REQUIRED')
 const signatureOffset=sigCount.next
 const messageOffset=signatureOffset+64
 if(messageOffset>=tx.length)throw new Error('COFFER_SIGNER_TRANSACTION_TRUNCATED')
 const existing=tx.subarray(signatureOffset,messageOffset)
 if(existing.some(byte=>byte!==0))throw new Error('COFFER_SIGNER_PREEXISTING_SIGNATURE_FORBIDDEN')
 const message=tx.subarray(messageOffset)
 let headerOffset=0
 if((message[0]&0x80)!==0){
  const version=message[0]&0x7f
  if(version!==0)throw new Error('COFFER_SIGNER_MESSAGE_VERSION_UNSUPPORTED')
  headerOffset=1
 }
 if(message.length<headerOffset+4)throw new Error('COFFER_SIGNER_MESSAGE_TRUNCATED')
 const requiredSignatures=message[headerOffset]
 if(requiredSignatures!==1)throw new Error('COFFER_SIGNER_SINGLE_SIGNER_REQUIRED')
 const accountCount=readShortVec(message,headerOffset+3)
 if(accountCount.value<1)throw new Error('COFFER_SIGNER_ACCOUNT_KEYS_REQUIRED')
 const keyStart=accountCount.next
 const keyEnd=keyStart+accountCount.value*32
 if(keyEnd>message.length)throw new Error('COFFER_SIGNER_ACCOUNT_KEYS_TRUNCATED')
 return Object.freeze({
  transaction:Buffer.from(tx),message:Buffer.from(message),signatureOffset,
  signerPublicKey:Buffer.from(message.subarray(keyStart,keyStart+32)),
 })
}

function assertExpectedSigner(expectedAddress:string,signerPublicKey:Buffer,derivedPublicKey:Buffer):void{
 const decoded=decodeBase58(required(expectedAddress,'COFFER_SIGNER_EXPECTED_ADDRESS_REQUIRED'))
 if(decoded.length!==32||!timingSafeEqual(decoded,derivedPublicKey))throw new Error('COFFER_SIGNER_KEY_ADDRESS_MISMATCH')
 if(!timingSafeEqual(signerPublicKey,derivedPublicKey))throw new Error('COFFER_SIGNER_TRANSACTION_SIGNER_MISMATCH')
}

export class IsolatedCofferSignerService{
 constructor(private readonly options:Readonly<{
  resolveSeedBase64:()=>Promise<string>|string
  verifyLease:CofferSignerLeaseVerifier
 }>){}

 async signVersionedTransaction(request:CofferSignerServiceRequest):Promise<CofferSignerServiceResult>{
  const walletConnectionId=required(request.walletConnectionId,'COFFER_SIGNER_WALLET_REQUIRED')
  const signerLeaseId=required(request.signerLeaseId,'COFFER_SIGNER_LEASE_REQUIRED')
  const idempotencyKey=required(request.idempotencyKey,'COFFER_SIGNER_IDEMPOTENCY_REQUIRED')
  const expectedSignerAddress=required(request.expectedSignerAddress,'COFFER_SIGNER_EXPECTED_ADDRESS_REQUIRED')
  if(!validIso(request.now))throw new Error('COFFER_SIGNER_NOW_INVALID')

  const parsed=parseSingleSignerUnsignedSolanaTransaction(request.unsignedTransactionBase64)
  const unsignedTransactionHash=digest(parsed.transaction)
  const lease=await this.options.verifyLease({
   walletConnectionId,signerLeaseId,expectedSignerAddress,idempotencyKey,unsignedTransactionHash,now:request.now,
  })
  if(lease.authority!=='SIGNER_LEASE_VERIFICATION_ONLY')throw new Error('COFFER_SIGNER_LEASE_AUTHORITY_INVALID')
  if(!lease.allowed)throw new Error('COFFER_SIGNER_LEASE_BLOCKED:'+lease.reasonCodes.join(','))
  if(!lease.evidenceIds.length)throw new Error('COFFER_SIGNER_LEASE_EVIDENCE_REQUIRED')

  const seedText=String(await this.options.resolveSeedBase64()).trim()
  if(!seedText)throw new Error('COFFER_SIGNER_SEED_REQUIRED')
  let seed:Buffer
  try{seed=Buffer.from(seedText,'base64')}catch{throw new Error('COFFER_SIGNER_SEED_BASE64_INVALID')}
  if(seed.toString('base64')!==seedText.replace(/\s+/g,''))throw new Error('COFFER_SIGNER_SEED_BASE64_INVALID')
  try{
   const privateKey=privateKeyFromSeed(seed)
   const derivedPublicKey=publicKeyBytes(privateKey)
   assertExpectedSigner(expectedSignerAddress,parsed.signerPublicKey,derivedPublicKey)
   const signature=sign(null,parsed.message,privateKey)
   if(signature.length!==64)throw new Error('COFFER_SIGNER_SIGNATURE_LENGTH_INVALID')
   signature.copy(parsed.transaction,parsed.signatureOffset)
   const primarySignature=encodeBase58(signature)
   const signedTransactionBase64=parsed.transaction.toString('base64')
   const evidenceId='coffer-signer:'+digest([
    walletConnectionId,signerLeaseId,idempotencyKey,unsignedTransactionHash,digest(signature),...lease.evidenceIds,
   ].join('|'))
   return Object.freeze({
    signerAddress:expectedSignerAddress,signedTransactionBase64,primarySignature,evidenceId,
    containsPrivateKey:false as const,containsRawToken:false as const,authority:'ISOLATED_SIGNER_RECEIPT_ONLY' as const,
   })
  }finally{
   seed.fill(0)
  }
 }
}

export function authorizeCofferSignerHttpRequest(input:{authorizationHeader:string|undefined;expectedAuthorizationHeader:string}):void{
 const provided=input.authorizationHeader?.trim()??''
 const expected=input.expectedAuthorizationHeader.trim()
 if(!provided||!expected||!equalText(provided,expected))throw new Error('COFFER_SIGNER_HTTP_UNAUTHORIZED')
}
