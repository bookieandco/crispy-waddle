import {createHash} from 'node:crypto'
import type {DexManagedOrder} from './solana-dex-runtime-contracts.js'

/** LIVE-GATE.31: bounded parser for legacy + v0 wire transactions.
 * No trusted program semantic decoder, address-table resolution, current
 * blockhash confirmation or signature cryptography is present here.
 * It CANNOT attest a safe Jupiter swap or authorize signing.
 * Newer v1 transactions fail closed until separately supported and audited.
 */
export type SniperTransactionByteAudit=Readonly<{
 version:'SHARK-SNIPER.LIVE-GATE.31'
 orderRequestId:string
 transactionSha256:string
 format:'LEGACY'|'V0'|'UNSUPPORTED'
 status:'STRUCTURE_OBSERVED'|'BLOCKED'
 reasonCodes:readonly string[]
 feePayer?:string
 signerCount?:number
 staticAccounts?:number
 instructionCount?:number
 programIds:readonly string[]
 semanticAuthorized:false
 altResolved:false
 canSign:false;canSubmit:false;canTrade:false
 authority:'UNSIGNED_TRANSACTION_STRUCTURE_ONLY'
}>
const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const MAX_WIRE=1232
const MAX_INSTRUCTIONS=64
const MAX_ACCOUNTS=64
function b58(bytes:Uint8Array):string{
 let x=0n
 for(const byte of bytes)x=(x<<8n)|BigInt(byte)
 let output=''
 while(x>0n){const rem=Number(x%58n);output=ALPHABET[rem]+output;x/=58n}
 let zeroes=0
 for(const byte of bytes){if(byte!==0)break;zeroes++}
 return '1'.repeat(zeroes)+output
}
class Read{
 offset=0
 constructor(readonly bytes:Buffer){}
 take(n:number):Buffer{
  if(!Number.isSafeInteger(n)||n<0||this.offset+n>this.bytes.length){
   throw Error('WIRE_TRUNCATED')
  }
  const value=this.bytes.subarray(this.offset,this.offset+n)
  this.offset+=n
  return value
 }
 byte():number{return this.take(1)[0]!}
 /** Strict Solana compact-u16; reject noncanonical and overflow encodings. */
 count():number{
  const start=this.offset
  const b0=this.byte()
  if(!(b0&0x80))return b0
  const b1=this.byte()
  if(!(b1&0x80)){
   const n=(b0&127)|((b1&127)<<7)
   if(n<128)throw Error('SHORTVEC_NONCANONICAL')
   return n
  }
  const b2=this.byte()
  if(b2&0x80||b2>3)throw Error('SHORTVEC_OVERFLOW')
  const n=(b0&127)|((b1&127)<<7)|(b2<<14)
  if(n<16384||this.offset-start>3)throw Error('SHORTVEC_NONCANONICAL')
  return n
 }
}
function strict64(source:string):Buffer{
 if(!source||source.length>2200||source.length%4!==0||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(source)){
  throw Error('BASE64_INVALID')
 }
 const bytes=Buffer.from(source,'base64')
 if(bytes.length>MAX_WIRE||bytes.length<100||bytes.toString('base64')!==source){
  throw Error('WIRE_BOUNDS_INVALID')
 }
 return bytes
}
export function sha256UnsignedTransaction(data:string):string{
 return createHash('sha256').update(strict64(data)).digest('hex')
}
export function auditSniperUnsignedTransaction(input:{
 order:DexManagedOrder;expectedFeePayer:string
 allowedStaticPrograms:readonly string[];now:string
}):SniperTransactionByteAudit{
 const reasons:string[]=[]
 const programs:string[]=[]
 let format:SniperTransactionByteAudit['format']='UNSUPPORTED'
 let feePayer:string|undefined,signerCount:number|undefined
 let staticAccounts:number|undefined,instructionCount:number|undefined
 let transactionSha256=''
 const fail=(code:string)=>{if(!reasons.includes(code))reasons.push(code)}
 try{
  const {order}=input
  if(order.provider!=='jupiter-ultra'||order.authority!=='PROVIDER_QUOTE_ONLY'||
     order.canBroadcast!==false||!order.requestId.trim()||
     !order.unsignedTransactionBase64||!order.evidenceIds.length||
     !input.expectedFeePayer.trim()||
     !Number.isFinite(Date.parse(input.now))||
     input.allowedStaticPrograms.length===0||input.allowedStaticPrograms.length>32){
   throw Error('ORDER_POLICY_INVALID')
  }
  const bytes=strict64(order.unsignedTransactionBase64)
  transactionSha256=createHash('sha256').update(bytes).digest('hex')
  const reader=new Read(bytes)
  const signatures=reader.count()
  if(signatures!==1)throw Error('SIGNER_COUNT_NOT_ISOLATED')
  const signatureBytes=reader.take(signatures*64)
  if(signatureBytes.some(b=>b!==0))throw Error('PROVIDER_TRANSACTION_ALREADY_SIGNED')
  let prefix=reader.byte()
  if(prefix&0x80){
   if(prefix!==0x80)throw Error('TRANSACTION_VERSION_NOT_AUDITED')
   format='V0'
   prefix=reader.byte()
  }else{format='LEGACY'}
  const requiredSignatures=prefix
  const readonlySigned=reader.byte(),readonlyUnsigned=reader.byte()
  const keys=reader.count()
  if(requiredSignatures!==signatures||keys<1||keys>MAX_ACCOUNTS||
     readonlySigned>requiredSignatures||
     readonlyUnsigned>keys-requiredSignatures){
   throw Error('MESSAGE_HEADER_INVALID')
  }
  signerCount=requiredSignatures;staticAccounts=keys
  const addresses=Array.from({length:keys},()=>b58(reader.take(32)))
  feePayer=addresses[0]
  if(feePayer!==input.expectedFeePayer||readonlySigned!==0){
   throw Error('FEE_PAYER_NOT_ISOLATED')
  }
  const hash=reader.take(32)
  if(hash.every(b=>b===0))throw Error('BLOCKHASH_MISSING')
  const n=reader.count()
  if(n<1||n>MAX_INSTRUCTIONS)throw Error('INSTRUCTION_COUNT_INVALID')
  instructionCount=n
  for(let i=0;i<n;i++){
   const programIndex=reader.byte()
   if(programIndex>=keys||programIndex<requiredSignatures){
    throw Error('PROGRAM_INDEX_INVALID')
   }
   const accounts=reader.count()
   if(accounts>MAX_ACCOUNTS)throw Error('ACCOUNT_INDEX_COUNT_INVALID')
   const indexes=reader.take(accounts)
   if(indexes.some(index=>index>=keys)){
    // May be an ALT account. Resolve onchain before interpretation.
    throw Error('UNRESOLVED_ACCOUNT_INDEX')
   }
   const dataLen=reader.count()
   if(dataLen>MAX_WIRE)throw Error('INSTRUCTION_DATA_OVERSIZE')
   reader.take(dataLen)
   programs.push(addresses[programIndex]!)
  }
  if(format==='V0'){
   const lookups=reader.count()
   if(lookups>0){
    // Even if all compiled instruction indices are static, account
    // privileges must not be accepted without checking the ALT content.
    throw Error('ADDRESS_LOOKUP_TABLE_UNRESOLVED')
   }
  }
  if(reader.offset!==bytes.length)throw Error('WIRE_TRAILING_BYTES')
  if(programs.some(program=>!input.allowedStaticPrograms.includes(program))){
   throw Error('PROGRAM_NOT_ALLOWLISTED')
  }
  // This parser cannot inspect CPI, token flows, authorized destination,
  // fee payer deltas or swap-program instruction semantics. No sign grant.
 }catch(error){
  fail(error instanceof Error?error.message:'UNSIGNED_TRANSACTION_INVALID')
 }
 return Object.freeze({
  version:'SHARK-SNIPER.LIVE-GATE.31',orderRequestId:input.order.requestId,
  transactionSha256,format,status:reasons.length?'BLOCKED':'STRUCTURE_OBSERVED',
  reasonCodes:Object.freeze(reasons),...(feePayer?{feePayer}:{}),
  ...(signerCount!==undefined?{signerCount}:{}),
  ...(staticAccounts!==undefined?{staticAccounts}:{}),
  ...(instructionCount!==undefined?{instructionCount}:{}),
  programIds:Object.freeze(programs),
  semanticAuthorized:false,altResolved:false,
  canSign:false,canSubmit:false,canTrade:false,
  authority:'UNSIGNED_TRANSACTION_STRUCTURE_ONLY',
 })
}
