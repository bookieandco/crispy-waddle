import type { DexOnchainReceipt, DexSimulationReceipt, SolanaChainObserver } from './solana-dex-runtime-contracts.js'

type FetchLike=(input:string|URL,init?:RequestInit)=>Promise<Response>
type JsonRpcResult=Readonly<{result?:unknown;error?:unknown}>

export type SolanaRpcHttpObserverOptions=Readonly<{
 resolveRpcEndpoint:()=>Promise<string>|string
 fetchFn?:FetchLike
}>

function record(value:unknown):Record<string,unknown>|undefined{
 return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined
}
function atomic(value:unknown):bigint{
 const r=record(value)
 const amount=r?.amount
 return typeof amount==='string'&&/^-?\d+$/.test(amount)?BigInt(amount):0n
}
function tokenTotal(rows:unknown,owner:string,mint:string):bigint{
 if(!Array.isArray(rows))return 0n
 let total=0n
 for(const item of rows){
  const r=record(item)
  if(!r||r.owner!==owner||r.mint!==mint)continue
  total+=atomic(r.uiTokenAmount)
 }
 return total
}

export class SolanaRpcHttpObserver implements SolanaChainObserver{
 private readonly resolveRpcEndpoint:SolanaRpcHttpObserverOptions['resolveRpcEndpoint']
 private readonly fetchFn:FetchLike
 constructor(options:SolanaRpcHttpObserverOptions){
  this.resolveRpcEndpoint=options.resolveRpcEndpoint
  this.fetchFn=options.fetchFn??fetch
 }
 private async call(method:string,params:unknown[]):Promise<unknown>{
  const endpoint=await this.resolveRpcEndpoint()
  if(!endpoint.startsWith('https://'))throw new Error('DEX_SOLANA_RPC_HTTPS_REQUIRED')
  const response=await this.fetchFn(endpoint,{
   method:'POST',
   headers:{'content-type':'application/json','accept':'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),
  })
  if(!response.ok)throw new Error('DEX_SOLANA_RPC_HTTP_'+response.status)
  const payload=await response.json() as JsonRpcResult
  if(payload.error)throw new Error('DEX_SOLANA_RPC_ERROR')
  return payload.result
 }
 async simulateSignedTransaction(input:{signedTransactionBase64:string;primarySignature:string;now:string}):Promise<DexSimulationReceipt>{
  const result=record(await this.call('simulateTransaction',[input.signedTransactionBase64,{encoding:'base64',sigVerify:true,commitment:'processed'}]))
  const value=record(result?.value)
  if(!value)throw new Error('DEX_SOLANA_SIMULATION_RESPONSE_INVALID')
  const err=value.err
  const feeRaw=value.fee
  const unitsRaw=value.unitsConsumed
  const logs=Array.isArray(value.logs)?value.logs.filter((x):x is string=>typeof x==='string'):[]
  const passed=err===null||err===undefined
  return Object.freeze({
   simulationId:'solana:simulation:'+input.primarySignature,
   signature:input.primarySignature,
   passed,
   errorCode:passed?undefined:'SOLANA_SIMULATION_FAILED',
   unitsConsumed:typeof unitsRaw==='number'&&Number.isFinite(unitsRaw)?unitsRaw:undefined,
   feeLamports:typeof feeRaw==='number'&&Number.isSafeInteger(feeRaw)&&feeRaw>=0?BigInt(feeRaw):undefined,
   logs:Object.freeze(logs),
   observedAt:input.now,
   evidenceIds:Object.freeze(['solana:simulation:'+input.primarySignature]),
   authority:'CHAIN_SIMULATION_EVIDENCE' as const,
  })
 }
 async observeSwap(input:{signature:string;walletAddress:string;inputMint:string;outputMint:string;now:string}):Promise<DexOnchainReceipt>{
  const result=record(await this.call('getTransaction',[input.signature,{commitment:'confirmed',encoding:'jsonParsed',maxSupportedTransactionVersion:0}]))
  if(!result)return Object.freeze({
   signature:input.signature,found:false,confirmed:false,failed:false,observedAt:input.now,
   evidenceIds:Object.freeze(['solana:getTransaction:'+input.signature+':missing']),authority:'ONCHAIN_EVIDENCE' as const,
  })
  const meta=record(result.meta)
  const preIn=tokenTotal(meta?.preTokenBalances,input.walletAddress,input.inputMint)
  const postIn=tokenTotal(meta?.postTokenBalances,input.walletAddress,input.inputMint)
  const preOut=tokenTotal(meta?.preTokenBalances,input.walletAddress,input.outputMint)
  const postOut=tokenTotal(meta?.postTokenBalances,input.walletAddress,input.outputMint)
  const feeRaw=meta?.fee
  const slotRaw=result.slot
  return Object.freeze({
   signature:input.signature,
   found:true,
   confirmed:true,
   failed:meta?.err!==null&&meta?.err!==undefined,
   slot:typeof slotRaw==='number'&&Number.isSafeInteger(slotRaw)&&slotRaw>=0?slotRaw:undefined,
   feeLamports:typeof feeRaw==='number'&&Number.isSafeInteger(feeRaw)&&feeRaw>=0?BigInt(feeRaw):undefined,
   inputDebitAtomic:preIn>=postIn?preIn-postIn:0n,
   outputCreditAtomic:postOut>=preOut?postOut-preOut:0n,
   inputPostBalanceAtomic:postIn,
   outputPostBalanceAtomic:postOut,
   observedAt:input.now,
   evidenceIds:Object.freeze(['solana:getTransaction:'+input.signature]),
   authority:'ONCHAIN_EVIDENCE' as const,
  })
 }
}
