import type { DexSwapIntent } from './solana-dex-runtime-contracts.js'
import type { DirectDexBuildResult, DirectDexOrderBuilder } from './direct-solana-dex-adapters.js'

type FetchLike=(input:string|URL,init?:RequestInit)=>Promise<Response>
export type MeteoraDlmmBuilderClientOptions=Readonly<{
 baseUrl:string
 resolveAuthorizationHeader?:()=>Promise<string|undefined>|string|undefined
 resolvePoolAddress?:(intent:DexSwapIntent)=>Promise<string|undefined>|string|undefined
 fetchFn?:FetchLike
}>
function row(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('DEX_METEORA_BUILDER_RESPONSE_INVALID')
 return value as Record<string,unknown>
}
export class MeteoraDlmmOrderBuilderClient implements DirectDexOrderBuilder{
 private readonly baseUrl:string
 private readonly auth?:MeteoraDlmmBuilderClientOptions['resolveAuthorizationHeader']
 private readonly pool?:MeteoraDlmmBuilderClientOptions['resolvePoolAddress']
 private readonly fetchFn:FetchLike
 constructor(options:MeteoraDlmmBuilderClientOptions){
  this.baseUrl=options.baseUrl.replace(/\/$/,'')
  if(!this.baseUrl.startsWith('https://'))throw new Error('DEX_METEORA_BUILDER_HTTPS_REQUIRED')
  this.auth=options.resolveAuthorizationHeader
  this.pool=options.resolvePoolAddress
  this.fetchFn=options.fetchFn??fetch
 }
 async build(input:{provider:'raydium-direct'|'meteora-direct';intent:DexSwapIntent;takerAddress:string}):Promise<DirectDexBuildResult>{
  if(input.provider!=='meteora-direct')throw new Error('DEX_METEORA_PROVIDER_REQUIRED')
  const poolAddress=await this.pool?.(input.intent)
  if(poolAddress!==undefined&&!poolAddress.trim())throw new Error('DEX_METEORA_POOL_INVALID')
  const authorization=await this.auth?.()
  const response=await this.fetchFn(this.baseUrl+'/build',{
   method:'POST',
   headers:{'content-type':'application/json',accept:'application/json',...(authorization?{authorization}:{})},
   body:JSON.stringify({
    ...(poolAddress?{poolAddress}:{}),
    inputMint:input.intent.inputMint,
    outputMint:input.intent.outputMint,
    inputAmountAtomic:input.intent.inputAmountAtomic.toString(),
    minimumOutputAtomic:input.intent.minimumOutputAtomic.toString(),
    slippageBps:input.intent.requestedSlippageBps,
    takerAddress:input.takerAddress,
    executionId:input.intent.executionId,
   }),
  })
  if(!response.ok)throw new Error('DEX_METEORA_BUILDER_HTTP_'+response.status)
  const body=row(await response.json())
  if(body.success!==true)throw new Error('DEX_METEORA_BUILDER_REJECTED')
  const data=row(body.data)
  const requestId=typeof data.requestId==='string'?data.requestId:''
  const quoted=typeof data.quotedOutputAtomic==='string'&&/^\d+$/.test(data.quotedOutputAtomic)?BigInt(data.quotedOutputAtomic):0n
  const tx=typeof data.unsignedTransactionBase64==='string'?data.unsignedTransactionBase64:''
  const quoteObservedAt=typeof data.quoteObservedAt==='string'?data.quoteObservedAt:''
  const priceImpactBps=typeof data.priceImpactBps==='number'?data.priceImpactBps:NaN
  if(!requestId||quoted<=0n||quoted<input.intent.minimumOutputAtomic||!tx||Number.isNaN(Date.parse(quoteObservedAt))||!Number.isInteger(priceImpactBps)||priceImpactBps<0||priceImpactBps>10000)throw new Error('DEX_METEORA_BUILDER_EVIDENCE_INVALID')
  const evidenceIds=Array.isArray(data.evidenceIds)?data.evidenceIds.filter((x):x is string=>typeof x==='string'&&x.length>0):[]
  if(!evidenceIds.length)throw new Error('DEX_METEORA_BUILDER_EVIDENCE_REQUIRED')
  return Object.freeze({requestId,quotedOutputAtomic:quoted,unsignedTransactionBase64:tx,quoteObservedAt,priceImpactBps,evidenceIds:Object.freeze(evidenceIds)})
 }
}
