/**
 * SHARK-SNIPER.COMMISSION.17: an explicitly invoked, read-only Solana
 * transaction identity cross-check. A Helius webhook is provisional even
 * when authenticated; this RPC check cannot prove complete launch coverage,
 * sellability, DEX liquidity, or trade authorization.
 */
const RPC='https://api.mainnet-beta.solana.com'
const B58=/^[1-9A-HJ-NP-Za-km-z]+$/
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x)
const valid=(value:string,min:number,max:number)=>value.length>=min&&value.length<=max&&B58.test(value)
const nowMs=(s:string)=>{const ms=Date.parse(s);if(!s||!Number.isFinite(ms))throw Error('SNIPER_CHAIN_TIME_INVALID');return ms}
export type SniperChainReceipt=Readonly<{
 version:'SHARK-SNIPER.COMMISSION.17'
 signature:string;mint:string;claimedSlot:number;receivedAt:string
 status:'CONFIRMED_MINT_INSTRUCTION'|'UNAVAILABLE'|'NOT_MATCHED'|'FAILED_TRANSACTION'
 verifiedSlot?:number
 rpcLatencyMs:number
 confirmation:'CONFIRMED'|'UNVERIFIED'
 independentlyCheckedMintInstruction:boolean
 /** Source time and slot are not a clock that proves millisecond latency. */
 sourceTimestampResolution:'SECONDS_OR_UNAVAILABLE'
 authority:'CHAIN_IDENTITY_RESEARCH_ONLY'
 canTrade:false;canSign:false
}>
type Fetcher=(url:string,init:{
 method:'POST';redirect:'error';headers:Readonly<Record<string,string>>
 body:string;signal:AbortSignal
})=>Promise<Readonly<{ok:boolean;status:number;text:()=>Promise<string>}>>
export type SniperChainDeps=Readonly<{
 fetcher:Fetcher;now:()=>string;monotonic:()=>number;timeoutMs?:number
}>
function hasMintInitialization(value:unknown,mint:string):boolean{
 if(!object(value)||!object(value.transaction)||!object(value.transaction.message))return false
 const instructions=value.transaction.message.instructions
 if(!Array.isArray(instructions))return false
 return instructions.some(i=>{
  if(!object(i)||!object(i.parsed)||!object(i.parsed.info))return false
  const program=i.program
  const type=i.parsed.type
  return (program==='spl-token'||program==='spl-token-2022')&&
   (type==='initializeMint'||type==='initializeMint2')&&
   i.parsed.info.mint===mint
 })
}
export async function verifySniperMintTransaction(input:{
 signature:string;mint:string;slot:number;receivedAt:string
},deps:SniperChainDeps):Promise<SniperChainReceipt>{
 if(!valid(input.signature,80,90)||!valid(input.mint,32,44)||
  !Number.isSafeInteger(input.slot)||input.slot<=0){
  throw Error('SNIPER_CHAIN_IDENTITY_INVALID')
 }
 const startedAt=deps.monotonic(),received=nowMs(input.receivedAt)
 const requestAt=nowMs(deps.now())
 if(!Number.isFinite(startedAt)||received>requestAt)throw Error('SNIPER_CHAIN_CHRONOLOGY_INVALID')
 const timeout=deps.timeoutMs??4000
 if(!Number.isSafeInteger(timeout)||timeout<100||timeout>8000)throw Error('SNIPER_CHAIN_TIMEOUT_INVALID')
 const controller=new AbortController()
 const timer=setTimeout(()=>controller.abort(),timeout)
 let raw:unknown
 try{
  const response=await deps.fetcher(RPC,{
   method:'POST',redirect:'error',signal:controller.signal,
   headers:{'content-type':'application/json',accept:'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getTransaction',
    params:[input.signature,{encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}]}),
  })
  if(!response.ok)throw Error('SNIPER_CHAIN_RPC_UNAVAILABLE')
  const body=await response.text()
  if(body.length>400000)throw Error('SNIPER_CHAIN_RPC_OVERSIZE')
  try{raw=JSON.parse(body) as unknown}catch{throw Error('SNIPER_CHAIN_RPC_INVALID')}
 }finally{clearTimeout(timer)}
 const endedAt=deps.monotonic()
 if(!Number.isFinite(endedAt)||endedAt<startedAt)throw Error('SNIPER_CHAIN_MONOTONIC_INVALID')
 const requestElapsed=endedAt-startedAt
 const result=object(raw)?raw.result:undefined
 const verifiedSlot=object(result)&&Number.isSafeInteger(result.slot)&&Number(result.slot)>0?Number(result.slot):undefined
 const failed=object(result)&&object(result.meta)&&result.meta.err!==null
 const matched=verifiedSlot===input.slot&&hasMintInitialization(result,input.mint)
 const status:SniperChainReceipt['status']=result==null?'UNAVAILABLE':
  failed?'FAILED_TRANSACTION':matched?'CONFIRMED_MINT_INSTRUCTION':'NOT_MATCHED'
 return Object.freeze({
  version:'SHARK-SNIPER.COMMISSION.17',signature:input.signature,mint:input.mint,
  claimedSlot:input.slot,receivedAt:input.receivedAt,status,
  ...(verifiedSlot===undefined?{}:{verifiedSlot}),
  rpcLatencyMs:requestElapsed,
  confirmation:matched&&!failed?'CONFIRMED':'UNVERIFIED',
  independentlyCheckedMintInstruction:matched&&!failed,
  sourceTimestampResolution:'SECONDS_OR_UNAVAILABLE',
  authority:'CHAIN_IDENTITY_RESEARCH_ONLY',canTrade:false,canSign:false,
 })
}
