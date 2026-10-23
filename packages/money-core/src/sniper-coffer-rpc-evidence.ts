import {createHash} from 'node:crypto'
/** COFFER-ACCEPT.41: public, bounded, *untrusted* independent RPC evidence.
 * Two HTTPS responses agreeing on ALT state are useful for diagnostics but
 * are not cryptographic chain attestation, a signer RPC, or live authority.
 */
const ENDPOINTS=['https://api.mainnet.solana.com','https://solana-rpc.publicnode.com'] as const
const OWNER='AddressLookupTab1e1111111111111111111111111'
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const key=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const MAX_DATA=56+256*32
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x)
function b58(bytes:Uint8Array):string{
 let n=0n,s=''
 for(const b of bytes)n=(n<<8n)|BigInt(b)
 while(n){s=B58[Number(n%58n)]+s;n/=58n}
 let z=0;while(z<bytes.length&&bytes[z]===0)z++
 return '1'.repeat(z)+s
}
type ResponseLike=Readonly<{ok:boolean;status:number;text:()=>Promise<string>}>
type Fetcher=(url:string,init:{
 method:'POST';redirect:'error';signal:AbortSignal
 headers:Readonly<Record<string,string>>;body:string
})=>Promise<ResponseLike>
type RpcRead=Readonly<{slot:number;hash:string;addresses:readonly string[];lastExtendedSlot:number}>
export type SniperRpcAltEvidence=Readonly<{
 status:'TWO_RPC_MATCHED'|'RPC_EVIDENCE_BLOCKED'
 reasonCodes:readonly string[];account:string
 rawHash?:string;contextSlot?:number
 addresses:readonly string[];observedAt:string
 authority:'INDEPENDENT_RPC_OBSERVATION_ONLY'
 canUseAsSignerAttestation:false;canSign:false;canSubmit:false
}>
async function readOne(endpoint:string,address:string,minSlot:number,fetcher:Fetcher):Promise<RpcRead>{
 const controller=new AbortController()
 const timer=setTimeout(()=>controller.abort(),4000)
 try{
  const r=await fetcher(endpoint,{
   method:'POST',redirect:'error',signal:controller.signal,
   headers:{'content-type':'application/json',accept:'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getAccountInfo',
    params:[address,{encoding:'base64',commitment:'finalized',minContextSlot:minSlot}]}),
  })
  if(!r.ok)throw Error('RPC_ALT_PROVIDER_HTTP_'+r.status)
  const raw=await r.text()
  if(raw.length>65536)throw Error('RPC_ALT_RESPONSE_TOO_LARGE')
  let p:unknown
  try{p=JSON.parse(raw) as unknown}catch{throw Error('RPC_ALT_JSON_INVALID')}
  if(!object(p)||p.jsonrpc!=='2.0'||p.id!==1||p.error!==undefined||
     !object(p.result)||!object(p.result.context)||!object(p.result.value))
   throw Error('RPC_ALT_RESULT_MISSING')
  const slot=p.result.context.slot,value=p.result.value
  if(!Number.isSafeInteger(slot)||Number(slot)<minSlot||
     value.owner!==OWNER||value.executable!==false||
     !Array.isArray(value.data)||value.data.length!==2||value.data[1]!=='base64'||
     typeof value.data[0]!=='string')
   throw Error('RPC_ALT_OWNER_OR_CONTEXT_UNTRUSTED')
  const encoded=value.data[0]
  if(encoded.length>11004||encoded.length%4!==0||
     !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
   throw Error('RPC_ALT_DATA_NOT_CANONICAL')
  const bytes=Buffer.from(encoded,'base64')
  if(bytes.length<56||bytes.length>MAX_DATA||
     (bytes.length-56)%32!==0||bytes.toString('base64')!==encoded||
     value.space!==bytes.length||typeof value.lamports!=='number'||value.lamports<=0)
   throw Error('RPC_ALT_DATA_SIZE_INVALID')
  // Official ALT account serialization: 4-byte state discriminator,
  // 8-byte deactivation slot, last-extended slot, 1-byte index, option.
  if(bytes.readUInt32LE(0)!==1||bytes.readBigUInt64LE(4)!==0xffffffffffffffffn||
     ![0,1].includes(bytes[21]!))
   throw Error('RPC_ALT_NOT_ACTIVE')
  const last=bytes.readBigUInt64LE(12)
  if(last>=BigInt(Number(slot))||last>BigInt(Number.MAX_SAFE_INTEGER))
   throw Error('RPC_ALT_EXTENSION_NOT_WARM')
  const count=(bytes.length-56)/32
  if(count===0||bytes[20]!>count)throw Error('RPC_ALT_INDEX_METADATA_INVALID')
  const addresses=Array.from({length:count},(_,i)=>b58(bytes.subarray(56+i*32,88+i*32)))
  if(new Set(addresses).size!==addresses.length)
   throw Error('RPC_ALT_DUPLICATE_ADDRESSES')
  return {slot:Number(slot),hash:createHash('sha256').update(bytes).digest('hex'),
   addresses,lastExtendedSlot:Number(last)}
 }finally{clearTimeout(timer)}
}
export async function corroborateSniperAltPublicRpc(input:{
 address:string;minContextSlot:number;now:string
},deps:{fetcher:Fetcher}):Promise<SniperRpcAltEvidence>{
 if(!key.test(input.address)||!Number.isSafeInteger(input.minContextSlot)||
    input.minContextSlot<1||!Number.isFinite(Date.parse(input.now)))
  throw Error('RPC_ALT_REQUEST_INVALID')
 const reasons:string[]=[]
 let first:RpcRead|undefined,second:RpcRead|undefined
 try{first=await readOne(ENDPOINTS[0],input.address,input.minContextSlot,deps.fetcher)}
 catch{reasons.push('RPC_PRIMARY_UNAVAILABLE_OR_INVALID')}
 try{second=await readOne(ENDPOINTS[1],input.address,input.minContextSlot,deps.fetcher)}
 catch{reasons.push('RPC_SECONDARY_UNAVAILABLE_OR_INVALID')}
 if(first&&second&&(first.hash!==second.hash||first.slot!==second.slot||
    first.lastExtendedSlot!==second.lastExtendedSlot||
    first.addresses.join(',')!==second.addresses.join(',')))
  reasons.push('RPC_SNAPSHOT_DIVERGED')
 const ok=!!first&&!!second&&reasons.length===0
 return Object.freeze({
  status:ok?'TWO_RPC_MATCHED':'RPC_EVIDENCE_BLOCKED',
  reasonCodes:Object.freeze(reasons),account:input.address,
  ...(ok?{rawHash:first!.hash,contextSlot:first!.slot}:{}),
  addresses:Object.freeze(ok?[...first!.addresses]:[]),
  observedAt:input.now,authority:'INDEPENDENT_RPC_OBSERVATION_ONLY',
  canUseAsSignerAttestation:false,canSign:false,canSubmit:false,
 })
}
