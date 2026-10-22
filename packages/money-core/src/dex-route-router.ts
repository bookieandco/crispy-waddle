import { createHash } from 'node:crypto'
import { evaluateDexRouteQuote,type DexRouteGateDecision,type DexRouteGatePolicy,type DexRouteProvider,type DexRouteQuote } from './dex-route-gate.js'

type FetchLike=(input:string|URL,init?:RequestInit)=>Promise<Response>

export type DexQuoteRequest=Readonly<{
 inputMint:string
 outputMint:string
 inputAmountAtomic:bigint
 slippageBps:number
 now:string
}>

export interface DexQuoteOnlyAdapter{
 readonly provider:DexRouteProvider
 quote(request:DexQuoteRequest):Promise<DexRouteQuote>
}

export type DirectVenueQuoteResult=Readonly<{
 quotedOutputAtomic:bigint
 minimumOutputAtomic?:bigint
 quotedAt?:string
 expiresAt?:string
 priceImpactBps?:number
 feeBps?:number
 liquidityMinor?:bigint
 evidenceIds:readonly string[]
}>

export type DirectVenueQuoteFn=(request:DexQuoteRequest)=>Promise<DirectVenueQuoteResult>

function hash(value:string):string{return createHash('sha256').update(value).digest('hex')}
function minOutput(out:bigint,slippageBps:number):bigint{
 if(!Number.isInteger(slippageBps)||slippageBps<0||slippageBps>10000)throw new Error('DEX_ROUTER_SLIPPAGE_INVALID')
 return out*BigInt(10000-slippageBps)/10000n
}
function decimalFractionToBps(value:unknown):number|undefined{
 if(typeof value!=='string'||!/^\d+(?:\.\d+)?$/.test(value))return undefined
 const n=Number(value)
 if(!Number.isFinite(n)||n<0)return undefined
 return Math.round(n*10000)
}
function integer(value:unknown):number|undefined{
 return typeof value==='number'&&Number.isInteger(value)&&value>=0?value:typeof value==='string'&&/^\d+$/.test(value)?Number(value):undefined
}
function atomic(value:unknown):bigint|undefined{
 return typeof value==='string'&&/^\d+$/.test(value)?BigInt(value):typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?BigInt(value):undefined
}
function record(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('DEX_ROUTER_RESPONSE_INVALID')
 return value as Record<string,unknown>
}

export class JupiterSwapV2QuoteAdapter implements DexQuoteOnlyAdapter{
 readonly provider='jupiter-swap-v2' as const
 private readonly baseUrl:string
 private readonly resolveApiKey?:()=>Promise<string|undefined>|string|undefined
 private readonly fetchFn:FetchLike
 constructor(options:{baseUrl?:string;resolveApiKey?:()=>Promise<string|undefined>|string|undefined;fetchFn?:FetchLike}={}){
  this.baseUrl=(options.baseUrl??'https://api.jup.ag').replace(/\/$/,'')
  if(!this.baseUrl.startsWith('https://'))throw new Error('DEX_ROUTER_JUPITER_HTTPS_REQUIRED')
  this.resolveApiKey=options.resolveApiKey
  this.fetchFn=options.fetchFn??fetch
 }
 async quote(request:DexQuoteRequest):Promise<DexRouteQuote>{
  const url=new URL(this.baseUrl+'/swap/v2/order')
  url.searchParams.set('inputMint',request.inputMint)
  url.searchParams.set('outputMint',request.outputMint)
  url.searchParams.set('amount',request.inputAmountAtomic.toString())
  if(request.slippageBps>0)url.searchParams.set('slippageBps',String(request.slippageBps))
  const key=await this.resolveApiKey?.()
  const response=await this.fetchFn(url,{method:'GET',headers:{accept:'application/json',...(key?{'x-api-key':key}:{})}})
  if(!response.ok)throw new Error('DEX_ROUTER_JUPITER_ORDER_HTTP_'+response.status)
  const row=record(await response.json())
  const out=atomic(row.outAmount)
  if(out===undefined||out<=0n)throw new Error('DEX_ROUTER_JUPITER_OUTPUT_INVALID')
  const requestId=typeof row.requestId==='string'&&row.requestId.trim()?row.requestId:'quote:'+hash(url.toString()).slice(0,24)
  // Missing provider fee evidence must not be silently treated as a free route.
  const feeBps=integer(row.feeBps)
  if(feeBps===undefined)throw new Error('DEX_ROUTER_JUPITER_FEE_EVIDENCE_REQUIRED')
  const impact=decimalFractionToBps(row.priceImpactPct)
  return Object.freeze({
   quoteId:'jupiter:'+requestId,
   provider:this.provider,
   inputMint:request.inputMint,outputMint:request.outputMint,inputAmountAtomic:request.inputAmountAtomic,
   quotedOutputAtomic:out,minimumOutputAtomic:minOutput(out,request.slippageBps),
   quotedAt:request.now,priceImpactBps:impact,feeBps,
   evidenceIds:Object.freeze(['jupiter-swap-v2:order:'+requestId]),
   authority:'ROUTE_QUOTE_EVIDENCE_ONLY' as const,canExecute:false as const,
  })
 }
}

abstract class DirectVenueQuoteAdapter implements DexQuoteOnlyAdapter{
 abstract readonly provider:DexRouteProvider
 constructor(private readonly quoteFn:DirectVenueQuoteFn){}
 async quote(request:DexQuoteRequest):Promise<DexRouteQuote>{
  const raw=await this.quoteFn(request)
  if(raw.quotedOutputAtomic<=0n||!raw.evidenceIds.length)throw new Error('DEX_ROUTER_DIRECT_QUOTE_INVALID')
  if(raw.feeBps===undefined||!Number.isSafeInteger(raw.feeBps)||raw.feeBps<0){
   throw new Error('DEX_ROUTER_DIRECT_FEE_EVIDENCE_REQUIRED')
  }
  const quotedAt=raw.quotedAt??request.now
  return Object.freeze({
   quoteId:this.provider+':'+hash([request.inputMint,request.outputMint,request.inputAmountAtomic.toString(),quotedAt,...raw.evidenceIds].join('|')).slice(0,32),
   provider:this.provider,inputMint:request.inputMint,outputMint:request.outputMint,inputAmountAtomic:request.inputAmountAtomic,
   quotedOutputAtomic:raw.quotedOutputAtomic,
   minimumOutputAtomic:raw.minimumOutputAtomic??minOutput(raw.quotedOutputAtomic,request.slippageBps),
   quotedAt,expiresAt:raw.expiresAt,priceImpactBps:raw.priceImpactBps,feeBps:raw.feeBps,liquidityMinor:raw.liquidityMinor,
   evidenceIds:Object.freeze([...raw.evidenceIds]),
   authority:'ROUTE_QUOTE_EVIDENCE_ONLY' as const,canExecute:false as const,
  })
 }
}

export class RaydiumDirectQuoteAdapter extends DirectVenueQuoteAdapter{readonly provider='raydium-direct' as const}
export class MeteoraDirectQuoteAdapter extends DirectVenueQuoteAdapter{readonly provider='meteora-direct' as const}

export type DexRouteAttempt=Readonly<{
 provider:DexRouteProvider
 quote?:DexRouteQuote
 gate?:DexRouteGateDecision
 errorCode?:string
 authority:'ROUTE_ATTEMPT_EVIDENCE_ONLY'
}>

export type DexRouteDecision=Readonly<{
 routeDecisionId:string
 selected?:DexRouteQuote
 attempts:readonly DexRouteAttempt[]
 reasonCodes:readonly string[]
 authority:'ROUTE_SELECTION_ONLY'
 canSign:false
 canBroadcast:false
}>

function errorCode(error:unknown):string{
 const raw=error instanceof Error?error.message:'DEX_ROUTER_PROVIDER_ERROR'
 return raw.replace(/[^A-Z0-9_:-]/gi,'_').slice(0,160)
}

export class GovernedDexRouteRouter{
 private readonly adapters:readonly DexQuoteOnlyAdapter[]
 private readonly policy:DexRouteGatePolicy
 private readonly quoteTimeoutMs?:number
 constructor(input:{adapters:readonly DexQuoteOnlyAdapter[];policy:DexRouteGatePolicy;quoteTimeoutMs?:number}){
  const seen=new Set<DexRouteProvider>()
  for(const adapter of input.adapters){
   if(seen.has(adapter.provider))throw new Error('DEX_ROUTER_DUPLICATE_PROVIDER')
   seen.add(adapter.provider)
  }
  if(!input.adapters.length)throw new Error('DEX_ROUTER_ADAPTER_REQUIRED')
  this.adapters=Object.freeze([...input.adapters])
  this.policy=input.policy
  if(input.quoteTimeoutMs!==undefined&&(!Number.isSafeInteger(input.quoteTimeoutMs)||input.quoteTimeoutMs<1||input.quoteTimeoutMs>30000)){
   throw new Error('DEX_ROUTER_QUOTE_TIMEOUT_INVALID')
  }
  this.quoteTimeoutMs=input.quoteTimeoutMs
 }
 async route(input:{request:DexQuoteRequest;consecutiveRealizedLosses:number;lossHaltActive?:boolean}):Promise<DexRouteDecision>{
  // Quote independent approved venues concurrently. Promise.all preserves configured order
  // for deterministic receipts even if responses arrive out of order.
  // This is quote-only and cannot sign, broadcast, or authorize spending.
  const attempts:DexRouteAttempt[]=await Promise.all(this.adapters.map(async(adapter):Promise<DexRouteAttempt>=>{
   try{
    // Timeout bounds the DECISION wait only; transport cancellation is not
    // guaranteed by this interface. Late responses cannot change the decision.
    const quote=await (this.quoteTimeoutMs===undefined
     ? adapter.quote(input.request)
     : new Promise<DexRouteQuote>((resolve,reject)=>{
       const timer=setTimeout(()=>reject(new Error('DEX_ROUTER_QUOTE_DEADLINE_EXCEEDED')),this.quoteTimeoutMs!)
       adapter.quote(input.request).then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)})
      }))
    if(quote.provider!==adapter.provider)throw new Error('DEX_ROUTER_PROVIDER_BINDING_MISMATCH')
    const gate=evaluateDexRouteQuote({quote,policy:this.policy,now:input.request.now,consecutiveRealizedLosses:input.consecutiveRealizedLosses,lossHaltActive:input.lossHaltActive})
    return Object.freeze({provider:adapter.provider,quote,gate,authority:'ROUTE_ATTEMPT_EVIDENCE_ONLY' as const})
   }catch(error){
    return Object.freeze({provider:adapter.provider,errorCode:errorCode(error),authority:'ROUTE_ATTEMPT_EVIDENCE_ONLY' as const})
   }
  }))
  const passing=attempts.filter(x=>x.quote&&x.gate?.disposition==='PASS') as Array<DexRouteAttempt&{quote:DexRouteQuote;gate:DexRouteGateDecision}>
  passing.sort((a,b)=>a.quote.quotedOutputAtomic===b.quote.quotedOutputAtomic?a.quote.feeBps-b.quote.feeBps:a.quote.quotedOutputAtomic>b.quote.quotedOutputAtomic?-1:1)
  const selected=passing[0]?.quote
  const reasons=selected?[]:['DEX_ROUTER_NO_ADMISSIBLE_ROUTE',...attempts.flatMap(x=>x.gate?.reasonCodes??(x.errorCode?[x.errorCode]:[]))]
  const stable=attempts.map(x=>({provider:x.provider,quoteId:x.quote?.quoteId??null,gate:x.gate?.disposition??null,error:x.errorCode??null}))
  return Object.freeze({
   routeDecisionId:'dex-route:'+hash(JSON.stringify({request:{...input.request,inputAmountAtomic:input.request.inputAmountAtomic.toString()},stable})),
   selected,attempts:Object.freeze(attempts),reasonCodes:Object.freeze([...new Set(reasons)]),
   authority:'ROUTE_SELECTION_ONLY' as const,canSign:false as const,canBroadcast:false as const,
  })
 }
}
