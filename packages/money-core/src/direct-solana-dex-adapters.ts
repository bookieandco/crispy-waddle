import type {
 DexManagedOrder,
 DexProviderExecutionReceipt,
 DexSignedTransaction,
 DexSwapIntent,
 ManagedSolanaDexVenueAdapter,
 SolanaDexVenueProvider,
} from './solana-dex-runtime-contracts.js'

type FetchLike=(input:string|URL,init?:RequestInit)=>Promise<Response>

export type DirectDexBuildResult=Readonly<{
 requestId:string
 quotedOutputAtomic:bigint
 unsignedTransactionBase64:string
 quoteObservedAt:string
 priceImpactBps:number
 evidenceIds:readonly string[]
}>

export interface DirectDexOrderBuilder{
 build(input:{
  provider:'raydium-direct'|'meteora-direct'
  intent:DexSwapIntent
  takerAddress:string
 }):Promise<DirectDexBuildResult>
}

export type DirectSolanaDexAdapterOptions=Readonly<{
 provider:'raydium-direct'|'meteora-direct'
 builder:DirectDexOrderBuilder
 resolveRpcEndpoint:()=>Promise<string>|string
 fetchFn?:FetchLike
 maxRetries?:number
}>

function validHttps(url:string):void{
 if(!url.startsWith('https://'))throw new Error('DEX_DIRECT_RPC_HTTPS_REQUIRED')
}
function asRecord(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('DEX_DIRECT_RPC_RESPONSE_INVALID')
 return value as Record<string,unknown>
}

export class DirectSolanaDexVenueAdapter implements ManagedSolanaDexVenueAdapter{
 readonly provider:'raydium-direct'|'meteora-direct'
 private readonly builder:DirectDexOrderBuilder
 private readonly resolveRpcEndpoint:DirectSolanaDexAdapterOptions['resolveRpcEndpoint']
 private readonly fetchFn:FetchLike
 private readonly maxRetries:number
 constructor(options:DirectSolanaDexAdapterOptions){
  this.provider=options.provider
  this.builder=options.builder
  this.resolveRpcEndpoint=options.resolveRpcEndpoint
  this.fetchFn=options.fetchFn??fetch
  this.maxRetries=options.maxRetries??2
  if(!Number.isInteger(this.maxRetries)||this.maxRetries<0||this.maxRetries>10)throw new Error('DEX_DIRECT_MAX_RETRIES_INVALID')
 }
 async createOrder(input:{intent:DexSwapIntent;takerAddress:string}):Promise<DexManagedOrder>{
  const built=await this.builder.build({provider:this.provider,intent:input.intent,takerAddress:input.takerAddress})
  if(!built.requestId.trim())throw new Error('DEX_DIRECT_REQUEST_ID_REQUIRED')
  if(built.quotedOutputAtomic<=0n)throw new Error('DEX_DIRECT_QUOTED_OUTPUT_INVALID')
  if(!built.unsignedTransactionBase64.trim())throw new Error('DEX_DIRECT_TRANSACTION_REQUIRED')
  if(Number.isNaN(Date.parse(built.quoteObservedAt)))throw new Error('DEX_DIRECT_QUOTE_TIME_INVALID')
  if(!Number.isInteger(built.priceImpactBps)||built.priceImpactBps<0||built.priceImpactBps>10000)throw new Error('DEX_DIRECT_PRICE_IMPACT_INVALID')
  if(!built.evidenceIds.length)throw new Error('DEX_DIRECT_EVIDENCE_REQUIRED')
  return Object.freeze({
   provider:this.provider,
   requestId:built.requestId,
   inputMint:input.intent.inputMint,
   outputMint:input.intent.outputMint,
   inputAmountAtomic:input.intent.inputAmountAtomic,
   quotedOutputAtomic:built.quotedOutputAtomic,
   unsignedTransactionBase64:built.unsignedTransactionBase64,
   takerAddress:input.takerAddress,
   quoteObservedAt:built.quoteObservedAt,
   priceImpactBps:built.priceImpactBps,
   evidenceIds:Object.freeze([...built.evidenceIds]),
   authority:'PROVIDER_QUOTE_ONLY' as const,
   canBroadcast:false as const,
  })
 }
 async executeSigned(input:{intent:DexSwapIntent;order:DexManagedOrder;signed:DexSignedTransaction;now:string}):Promise<DexProviderExecutionReceipt>{
  if(input.order.provider!==this.provider)throw new Error('DEX_DIRECT_ORDER_PROVIDER_MISMATCH')
  const rpc=await this.resolveRpcEndpoint()
  validHttps(rpc)
  const response=await this.fetchFn(rpc,{
   method:'POST',
   headers:{'content-type':'application/json','accept':'application/json'},
   body:JSON.stringify({
    jsonrpc:'2.0',
    id:input.intent.executionId,
    method:'sendTransaction',
    params:[input.signed.signedTransactionBase64,{encoding:'base64',skipPreflight:false,maxRetries:this.maxRetries}],
   }),
  })
  if(!response.ok)throw new Error('DEX_DIRECT_RPC_HTTP_'+response.status)
  const row=asRecord(await response.json())
  const signature=typeof row.result==='string'&&row.result.trim()?row.result:undefined
  const err=row.error
  const errorCode=err===undefined?undefined:'DEX_DIRECT_RPC_REJECTED'
  const state:DexProviderExecutionReceipt['state']=errorCode?'FAILED':signature?'ACKNOWLEDGED':'UNKNOWN'
  const receiptId=this.provider+':execute:'+input.order.requestId+':'+(signature??'unknown')
  return Object.freeze({
   receiptId,
   provider:this.provider,
   requestId:input.order.requestId,
   executionId:input.intent.executionId,
   state,
   signature,
   inputAmountAtomic:input.order.inputAmountAtomic,
   errorCode,
   observedAt:input.now,
   evidenceIds:Object.freeze([...input.order.evidenceIds,receiptId]),
   authority:'PROVIDER_EXECUTION_EVIDENCE' as const,
  })
 }
}

export class RaydiumDirectDexAdapter extends DirectSolanaDexVenueAdapter{
 constructor(options:Omit<DirectSolanaDexAdapterOptions,'provider'>){super({...options,provider:'raydium-direct'})}
}

export class MeteoraDirectDexAdapter extends DirectSolanaDexVenueAdapter{
 constructor(options:Omit<DirectSolanaDexAdapterOptions,'provider'>){super({...options,provider:'meteora-direct'})}
}

export function isDirectDexProvider(provider:SolanaDexVenueProvider):provider is 'raydium-direct'|'meteora-direct'{
 return provider==='raydium-direct'||provider==='meteora-direct'
}
