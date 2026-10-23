import {createHash} from 'node:crypto'

/** Independent signer-host wire decoder. No sign/submit capability.
 * Legacy/v0 only: v1 has a different layout and must not be guessed.
 */
const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const ALT_OWNER='AddressLookupTab1e1111111111111111111111111'
const SOLANA_KEY=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
function base58(value:Uint8Array):string{
 let n=0n
 for(const byte of value)n=(n<<8n)|BigInt(byte)
 let text=''
 while(n){text=ALPHABET[Number(n%58n)]+text;n/=58n}
 let i=0
 while(i<value.length&&value[i]===0)i++
 return '1'.repeat(i)+text
}
class Reader{
 position=0
 constructor(readonly bytes:Buffer){}
 take(n:number):Buffer{
  if(!Number.isSafeInteger(n)||n<0||this.position+n>this.bytes.length)
   throw Error('SIGNER_WIRE_TRUNCATED')
  const result=this.bytes.subarray(this.position,this.position+n)
  this.position+=n
  return result
 }
 byte():number{return this.take(1)[0]!}
 count():number{
  const a=this.byte()
  if(a<128)return a
  const b=this.byte()
  if(b<128){
   const n=(a&127)|(b<<7)
   if(n<128)throw Error('SIGNER_SHORTVEC_NONCANONICAL')
   return n
  }
  const c=this.byte()
  if(c>3)throw Error('SIGNER_SHORTVEC_OVERFLOW')
  const n=(a&127)|((b&127)<<7)|(c<<14)
  if(n<16384)throw Error('SIGNER_SHORTVEC_NONCANONICAL')
  return n
 }
}
function bytesOf(encoded:string):Buffer{
 if(!encoded||encoded.length>1800||encoded.length%4!==0||
   !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
  throw Error('SIGNER_BASE64_INVALID')
 const bytes=Buffer.from(encoded,'base64')
 if(bytes.length<100||bytes.length>1232||bytes.toString('base64')!==encoded)
  throw Error('SIGNER_WIRE_SIZE_INVALID')
 return bytes
}
export type SniperAltObservation=Readonly<{
 address:string;ownerProgram:string;contextSlot:number
 lastExtendedSlot:number;deactivated:boolean
 addresses:readonly string[]
 evidenceIds:readonly string[]
 authority:'TRUSTED_RPC_LOOKUP_OBSERVATION'
}>
export type SniperSignerRpcLookup=Readonly<{
 readLookupTable:(address:string,minContextSlot:number)=>Promise<SniperAltObservation|undefined>
}>
export type SignerInstruction=Readonly<{
 programId:string;accounts:readonly string[];dataHex:string
}>
export type DecodedSniperSignerMessage=Readonly<{
 version:'SIGNER_WIRE_LEGACY_V0'
 format:'LEGACY'|'V0';sha256:string
 feePayer:string;blockhash:string;signerCount:1
 accounts:readonly string[];writableAccounts:readonly string[]
 programIds:readonly string[];instructions:readonly SignerInstruction[]
 lookupTableAddresses:readonly string[];lookupEvidenceIds:readonly string[]
 minContextSlot:number;authority:'DECODED_SIGNER_HOST_RESEARCH'
 canSign:false;canBroadcast:false
}>
export async function decodeSignerMessage(input:{
 unsignedTransactionBase64:string;expectedFeePayer:string
 minContextSlot:number;rpc:SniperSignerRpcLookup
}):Promise<DecodedSniperSignerMessage>{
 if(!SOLANA_KEY.test(input.expectedFeePayer)||
    !Number.isSafeInteger(input.minContextSlot)||input.minContextSlot<1)
  throw Error('SIGNER_WIRE_INPUT_INVALID')
 const bytes=bytesOf(input.unsignedTransactionBase64)
 const r=new Reader(bytes),signatureCount=r.count()
 if(signatureCount!==1)throw Error('SIGNER_WIRE_SINGLE_SIGNER_REQUIRED')
 if(r.take(64).some(byte=>byte!==0))throw Error('SIGNER_WIRE_ALREADY_SIGNED')
 const first=r.byte()
 let format:'LEGACY'|'V0'='LEGACY',required=first
 if(first&0x80){
  if(first!==0x80)throw Error('SIGNER_WIRE_UNSUPPORTED_VERSION')
  format='V0';required=r.byte()
 }
 const readonlySigned=r.byte(),readonlyUnsigned=r.byte()
 if(required!==1||readonlySigned!==0)throw Error('SIGNER_WIRE_HEADER_INVALID')
 const count=r.count()
 if(count<1||count>64||readonlyUnsigned>count-1)throw Error('SIGNER_WIRE_ACCOUNT_COUNT_INVALID')
 const staticKeys=Array.from({length:count},()=>base58(r.take(32)))
 if(staticKeys[0]!==input.expectedFeePayer)throw Error('SIGNER_WIRE_FEE_PAYER_INVALID')
 const blockhash=base58(r.take(32))
 if(blockhash==='1'.repeat(32))throw Error('SIGNER_WIRE_BLOCKHASH_INVALID')
 const ixCount=r.count()
 if(ixCount<1||ixCount>64)throw Error('SIGNER_WIRE_INSTRUCTION_COUNT_INVALID')
 const compiled:{program:number;accounts:number[];dataHex:string}[]=[]
 for(let i=0;i<ixCount;i++){
  const program=r.byte(),n=r.count()
  if(n>64)throw Error('SIGNER_WIRE_INSTRUCTION_ACCOUNT_BOUNDS')
  const accountIndices=[...r.take(n)]
  const length=r.count()
  if(length>1232)throw Error('SIGNER_WIRE_INSTRUCTION_DATA_BOUNDS')
  compiled.push({program,accounts:accountIndices,dataHex:r.take(length).toString('hex')})
 }
 const lookups:{address:string;writable:number[];readonly:number[]}[]=[]
 if(format==='V0'){
  const n=r.count()
  if(n>16)throw Error('SIGNER_WIRE_LOOKUP_COUNT_INVALID')
  for(let i=0;i<n;i++){
   const address=base58(r.take(32))
   const w=r.count();if(w>64)throw Error('SIGNER_WIRE_LOOKUP_BOUNDS')
   const writable=[...r.take(w)]
   const ro=r.count();if(ro>64)throw Error('SIGNER_WIRE_LOOKUP_BOUNDS')
   const readonly=[...r.take(ro)]
   if(writable.length+readonly.length===0||
      new Set([...writable,...readonly]).size!==writable.length+readonly.length)
    throw Error('SIGNER_WIRE_DUPLICATE_LOOKUP_INDEX')
   lookups.push({address,writable,readonly})
  }
 }
 if(r.position!==bytes.length)throw Error('SIGNER_WIRE_TRAILING_BYTES')
 if(new Set(lookups.map(x=>x.address)).size!==lookups.length)
  throw Error('SIGNER_WIRE_DUPLICATE_LOOKUP_TABLE')
 const loadedWritable:string[]=[],loadedReadonly:string[]=[],evidence:string[]=[]
 for(const lookup of lookups){
  const proof=await input.rpc.readLookupTable(lookup.address,input.minContextSlot)
  if(!proof||proof.address!==lookup.address||
     proof.authority!=='TRUSTED_RPC_LOOKUP_OBSERVATION'||
     proof.ownerProgram!==ALT_OWNER||proof.deactivated||
     !Number.isSafeInteger(proof.contextSlot)||
     proof.contextSlot<input.minContextSlot||
     !Number.isSafeInteger(proof.lastExtendedSlot)||
     proof.lastExtendedSlot>=proof.contextSlot||!proof.evidenceIds.length)
   throw Error('SIGNER_ALT_INDEPENDENT_PROOF_REQUIRED')
  for(const ix of lookup.writable){
   if(ix>=proof.addresses.length||!SOLANA_KEY.test(proof.addresses[ix]!))
    throw Error('SIGNER_ALT_WRITABLE_INDEX_INVALID')
   loadedWritable.push(proof.addresses[ix]!)
  }
  for(const ix of lookup.readonly){
   if(ix>=proof.addresses.length||!SOLANA_KEY.test(proof.addresses[ix]!))
    throw Error('SIGNER_ALT_READONLY_INDEX_INVALID')
   loadedReadonly.push(proof.addresses[ix]!)
  }
  evidence.push(...proof.evidenceIds)
 }
 const keys=[...staticKeys,...loadedWritable,...loadedReadonly]
 if(keys.length>64||new Set(keys).size!==keys.length)
  throw Error('SIGNER_WIRE_ACCOUNT_COLLISION_OR_LIMIT')
 const writable=[...staticKeys.slice(0,count-readonlyUnsigned),...loadedWritable]
 const instructions=compiled.map(ix=>{
  if(ix.program>=keys.length||ix.accounts.some(i=>i>=keys.length))
   throw Error('SIGNER_WIRE_COMPILED_INDEX_INVALID')
  const programId=keys[ix.program]!
  if(ix.program===0||writable.includes(programId))
   throw Error('SIGNER_WIRE_PROGRAM_MUST_BE_READONLY')
  return Object.freeze({
   programId,accounts:Object.freeze(ix.accounts.map(i=>keys[i]!)),
   dataHex:ix.dataHex,
  })
 })
 return Object.freeze({
  version:'SIGNER_WIRE_LEGACY_V0',format,
  sha256:createHash('sha256').update(bytes).digest('hex'),
  feePayer:keys[0]!,blockhash,signerCount:1,
  accounts:Object.freeze(keys),writableAccounts:Object.freeze(writable),
  programIds:Object.freeze(instructions.map(ix=>ix.programId)),
  instructions:Object.freeze(instructions),
  lookupTableAddresses:Object.freeze(lookups.map(x=>x.address)),
  lookupEvidenceIds:Object.freeze(evidence),
  minContextSlot:input.minContextSlot,
  authority:'DECODED_SIGNER_HOST_RESEARCH',canSign:false,canBroadcast:false,
 })
}
