import { createHash } from 'node:crypto'
import { computeDexQuoteSlippageBps,type DexRouteProvider,type DexRouteQuote } from './dex-route-gate.js'
import type { DexRouteDecision } from './dex-route-router.js'

type FetchLike=(input:string|URL,init?:RequestInit)=>Promise<Response>

export type DexPreparedTransaction=Readonly<{
 preparationId:string
 provider:DexRouteProvider
 quoteId:string
 providerRequestId:string
 takerAddress:string
 inputMint:string
 outputMint:string
 inputAmountAtomic:bigint
 minimumOutputAtomic:bigint
 unsignedTransactionBase64:string
 preparedAt:string
 evidenceIds:readonly string[]
 authority:'UNSIGNED_TRANSACTION_PREPARATION_ONLY'
 canSign:false
 canBroadcast:false
}>

export interface DexTransactionPreparationAdapter{
 readonly provider:DexRouteProvider
 prepare(input:{quote:DexRouteQuote;takerAddress:string;now:string}):Promise<DexPreparedTransaction>
}

function hash(value:unknown):string{
 return createHash('sha256').update(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item)).digest('hex')
}
function record(value:unknown,code:string):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code)
 return value as Record<string,unknown>
}
function requiredString(row:Record<string,unknown>,key:string,code:string):string{
 const value=row[key]
 if(typeof value!=='string'||!value.trim())throw new Error(code)
 return value
}
function atomic(value:unknown):bigint|undefined{
 return typeof value==='string'&&/^\d+$/.test(value)?BigInt(value):typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?BigInt(value):undefined
}
function validBase64(value:string):boolean{
 if(!value.trim()||value.length%4!==0)return false
 return /^[A-Za-z0-9+/]+={0,2}$/.test(value)
}
function assertPreparationBinding(prepared:DexPreparedTransaction,quote:DexRouteQuote,takerAddress:string):void{
 if(prepared.provider!==quote.provider)throw new Error('DEX_PREPARATION_PROVIDER_MISMATCH')
 if(prepared.quoteId!==quote.quoteId)throw new Error('DEX_PREPARATION_QUOTE_MISMATCH')
 if(prepared.takerAddress!==takerAddress)throw new Error('DEX_PREPARATION_TAKER_MISMATCH')
 if(prepared.inputMint!==quote.inputMint||prepared.outputMint!==quote.outputMint)throw new Error('DEX_PREPARATION_MINT_MISMATCH')
 if(prepared.inputAmountAtomic!==quote.inputAmountAtomic)throw new Error('DEX_PREPARATION_INPUT_AMOUNT_MISMATCH')
 if(prepared.minimumOutputAtomic<quote.minimumOutputAtomic)throw new Error('DEX_PREPARATION_MINIMUM_OUTPUT_WEAKENED')
 if(!validBase64(prepared.unsignedTransactionBase64))throw new Error('DEX_PREPARATION_TRANSACTION_INVALID')
 if(!prepared.evidenceIds.length)throw new Error('DEX_PREPARATION_EVIDENCE_REQUIRED')
 if(prepared.authority!=='UNSIGNED_TRANSACTION_PREPARATION_ONLY'||prepared.canSign!==false||prepared.canBroadcast!==false){
  throw new Error('DEX_PREPARATION_AUTHORITY_INVALID')
 }
}

export class JupiterSwapV2TransactionPreparationAdapter implements DexTransactionPreparationAdapter{
 readonly provider='jupiter-swap-v2' as const
 private readonly baseUrl:string
 private readonly resolveApiKey?:()=>Promise<string|undefined>|string|undefined
 private readonly fetchFn:FetchLike
 constructor(options:{baseUrl?:string;resolveApiKey?:()=>Promise<string|undefined>|string|undefined;fetchFn?:FetchLike}={}){
  this.baseUrl=(options.baseUrl??'https://api.jup.ag').replace(/\/$/,'')
  if(!this.baseUrl.startsWith('https://'))throw new Error('DEX_PREPARATION_JUPITER_HTTPS_REQUIRED')
  this.resolveApiKey=options.resolveApiKey
  this.fetchFn=options.fetchFn??fetch
 }
 async prepare(input:{quote:DexRouteQuote;takerAddress:string;now:string}):Promise<DexPreparedTransaction>{
  if(input.quote.provider!==this.provider)throw new Error('DEX_PREPARATION_JUPITER_QUOTE_REQUIRED')
  if(!input.takerAddress.trim())throw new Error('DEX_PREPARATION_TAKER_REQUIRED')
  const url=new URL(this.baseUrl+'/swap/v2/order')
  url.searchParams.set('inputMint',input.quote.inputMint)
  url.searchParams.set('outputMint',input.quote.outputMint)
  url.searchParams.set('amount',input.quote.inputAmountAtomic.toString())
  url.searchParams.set('taker',input.takerAddress)
  const slippage=computeDexQuoteSlippageBps(input.quote.quotedOutputAtomic,input.quote.minimumOutputAtomic)
  if(slippage>0)url.searchParams.set('slippageBps',String(slippage))
  const apiKey=await this.resolveApiKey?.()
  const response=await this.fetchFn(url,{method:'GET',headers:{accept:'application/json',...(apiKey?{'x-api-key':apiKey}:{})}})
  if(!response.ok)throw new Error('DEX_PREPARATION_JUPITER_HTTP_'+response.status)
  const row=record(await response.json(),'DEX_PREPARATION_JUPITER_RESPONSE_INVALID')
  const requestId=requiredString(row,'requestId','DEX_PREPARATION_JUPITER_REQUEST_ID_REQUIRED')
  const transaction=requiredString(row,'transaction','DEX_PREPARATION_JUPITER_TRANSACTION_REQUIRED')
  const inAmount=atomic(row.inAmount??row.inputAmount)
  const outAmount=atomic(row.outAmount??row.outputAmount)
  if(inAmount!==input.quote.inputAmountAtomic)throw new Error('DEX_PREPARATION_JUPITER_INPUT_MISMATCH')
  if(outAmount===undefined||outAmount<input.quote.minimumOutputAtomic)throw new Error('DEX_PREPARATION_JUPITER_OUTPUT_BELOW_MINIMUM')
  const prepared:DexPreparedTransaction=Object.freeze({
   preparationId:'dex-prep:'+hash({provider:this.provider,quoteId:input.quote.quoteId,requestId,taker:input.takerAddress,transaction:hash(transaction)}),
   provider:this.provider,quoteId:input.quote.quoteId,providerRequestId:requestId,takerAddress:input.takerAddress,
   inputMint:input.quote.inputMint,outputMint:input.quote.outputMint,inputAmountAtomic:input.quote.inputAmountAtomic,
   minimumOutputAtomic:input.quote.minimumOutputAtomic,unsignedTransactionBase64:transaction,preparedAt:input.now,
   evidenceIds:Object.freeze([...input.quote.evidenceIds,'jupiter-swap-v2:prepared:'+requestId]),
   authority:'UNSIGNED_TRANSACTION_PREPARATION_ONLY' as const,canSign:false as const,canBroadcast:false as const,
  })
  assertPreparationBinding(prepared,input.quote,input.takerAddress)
  return prepared
 }
}

export type RaydiumTokenAccounts=Readonly<{inputAccount?:string;outputAccount?:string}>
export type RaydiumTokenAccountResolver=(input:{wallet:string;inputMint:string;outputMint:string})=>Promise<RaydiumTokenAccounts>|RaydiumTokenAccounts

export class RaydiumTradeApiTransactionPreparationAdapter implements DexTransactionPreparationAdapter{
 readonly provider='raydium-direct' as const
 private readonly baseUrl:string
 private readonly fetchFn:FetchLike
 private readonly resolvePriorityFeeMicroLamports:()=>Promise<string>|string
 private readonly resolveTokenAccounts:RaydiumTokenAccountResolver
 private readonly nativeMint:string
 constructor(options:{
  baseUrl?:string
  fetchFn?:FetchLike
  resolvePriorityFeeMicroLamports:()=>Promise<string>|string
  resolveTokenAccounts:RaydiumTokenAccountResolver
  nativeMint?:string
 }){
  this.baseUrl=(options.baseUrl??'https://transaction-v1.raydium.io').replace(/\/$/,'')
  if(!this.baseUrl.startsWith('https://'))throw new Error('DEX_PREPARATION_RAYDIUM_HTTPS_REQUIRED')
  this.fetchFn=options.fetchFn??fetch
  this.resolvePriorityFeeMicroLamports=options.resolvePriorityFeeMicroLamports
  this.resolveTokenAccounts=options.resolveTokenAccounts
  this.nativeMint=options.nativeMint??'So11111111111111111111111111111111111111112'
 }
 async prepare(input:{quote:DexRouteQuote;takerAddress:string;now:string}):Promise<DexPreparedTransaction>{
  if(input.quote.provider!==this.provider)throw new Error('DEX_PREPARATION_RAYDIUM_QUOTE_REQUIRED')
  if(!input.takerAddress.trim())throw new Error('DEX_PREPARATION_TAKER_REQUIRED')
  const slippage=computeDexQuoteSlippageBps(input.quote.quotedOutputAtomic,input.quote.minimumOutputAtomic)
  const quoteUrl=new URL(this.baseUrl+'/compute/swap-base-in')
  quoteUrl.searchParams.set('inputMint',input.quote.inputMint)
  quoteUrl.searchParams.set('outputMint',input.quote.outputMint)
  quoteUrl.searchParams.set('amount',input.quote.inputAmountAtomic.toString())
  quoteUrl.searchParams.set('slippageBps',String(slippage))
  quoteUrl.searchParams.set('txVersion','V0')
  const quoteResponse=await this.fetchFn(quoteUrl,{method:'GET',headers:{accept:'application/json'}})
  if(!quoteResponse.ok)throw new Error('DEX_PREPARATION_RAYDIUM_QUOTE_HTTP_'+quoteResponse.status)
  const rawSwap=await quoteResponse.json()
  const swap=record(rawSwap,'DEX_PREPARATION_RAYDIUM_QUOTE_INVALID')
  if(swap.success!==true)throw new Error('DEX_PREPARATION_RAYDIUM_QUOTE_FAILED')
  const data=record(swap.data,'DEX_PREPARATION_RAYDIUM_DATA_INVALID')
  const currentInput=atomic(data.inputAmount)
  const currentOutput=atomic(data.outputAmount)
  const currentMinimum=atomic(data.otherAmountThreshold)
  if(currentInput!==input.quote.inputAmountAtomic)throw new Error('DEX_PREPARATION_RAYDIUM_INPUT_MISMATCH')
  if(currentOutput===undefined||currentMinimum===undefined||currentOutput<input.quote.minimumOutputAtomic||currentMinimum<input.quote.minimumOutputAtomic){
   throw new Error('DEX_PREPARATION_RAYDIUM_OUTPUT_BELOW_MINIMUM')
  }
  const accounts=await this.resolveTokenAccounts({wallet:input.takerAddress,inputMint:input.quote.inputMint,outputMint:input.quote.outputMint})
  const wrapSol=input.quote.inputMint===this.nativeMint,unwrapSol=input.quote.outputMint===this.nativeMint
  if(!wrapSol&&!accounts.inputAccount?.trim())throw new Error('DEX_PREPARATION_RAYDIUM_INPUT_ACCOUNT_REQUIRED')
  if(!unwrapSol&&!accounts.outputAccount?.trim())throw new Error('DEX_PREPARATION_RAYDIUM_OUTPUT_ACCOUNT_REQUIRED')
  const priorityFee=String(await this.resolvePriorityFeeMicroLamports()).trim()
  if(!/^\d+$/.test(priorityFee))throw new Error('DEX_PREPARATION_RAYDIUM_PRIORITY_FEE_INVALID')
  const txResponse=await this.fetchFn(this.baseUrl+'/transaction/swap-base-in',{
   method:'POST',headers:{'content-type':'application/json',accept:'application/json'},
   body:JSON.stringify({
    computeUnitPriceMicroLamports:priorityFee,swapResponse:rawSwap,txVersion:'V0',wallet:input.takerAddress,
    wrapSol,unwrapSol,inputAccount:wrapSol?undefined:accounts.inputAccount,outputAccount:unwrapSol?undefined:accounts.outputAccount,
   }),
  })
  if(!txResponse.ok)throw new Error('DEX_PREPARATION_RAYDIUM_TX_HTTP_'+txResponse.status)
  const txRow=record(await txResponse.json(),'DEX_PREPARATION_RAYDIUM_TX_RESPONSE_INVALID')
  if(txRow.success!==true||!Array.isArray(txRow.data)||txRow.data.length!==1)throw new Error('DEX_PREPARATION_RAYDIUM_SINGLE_TX_REQUIRED')
  const tx=record(txRow.data[0],'DEX_PREPARATION_RAYDIUM_TX_INVALID')
  const transaction=requiredString(tx,'transaction','DEX_PREPARATION_RAYDIUM_TRANSACTION_REQUIRED')
  const requestId=typeof swap.id==='string'&&swap.id.trim()?swap.id:'raydium:'+hash(rawSwap).slice(0,24)
  const prepared:DexPreparedTransaction=Object.freeze({
   preparationId:'dex-prep:'+hash({provider:this.provider,quoteId:input.quote.quoteId,requestId,taker:input.takerAddress,transaction:hash(transaction)}),
   provider:this.provider,quoteId:input.quote.quoteId,providerRequestId:requestId,takerAddress:input.takerAddress,
   inputMint:input.quote.inputMint,outputMint:input.quote.outputMint,inputAmountAtomic:input.quote.inputAmountAtomic,
   minimumOutputAtomic:currentMinimum,unsignedTransactionBase64:transaction,preparedAt:input.now,
   evidenceIds:Object.freeze([...input.quote.evidenceIds,'raydium:compute:'+requestId,'raydium:transaction:'+requestId]),
   authority:'UNSIGNED_TRANSACTION_PREPARATION_ONLY' as const,canSign:false as const,canBroadcast:false as const,
  })
  assertPreparationBinding(prepared,input.quote,input.takerAddress)
  return prepared
 }
}

export type MeteoraDlmmPreparationResult=Readonly<{
 providerRequestId:string
 currentInputAmountAtomic:bigint
 currentOutputAmountAtomic:bigint
 minimumOutputAtomic:bigint
 unsignedTransactionBase64:string
 evidenceIds:readonly string[]
}>

export class MeteoraDlmmTransactionPreparationAdapter implements DexTransactionPreparationAdapter{
 readonly provider='meteora-direct' as const
 constructor(private readonly prepareWithOfficialSdk:(input:{quote:DexRouteQuote;takerAddress:string;now:string})=>Promise<MeteoraDlmmPreparationResult>){}
 async prepare(input:{quote:DexRouteQuote;takerAddress:string;now:string}):Promise<DexPreparedTransaction>{
  if(input.quote.provider!==this.provider)throw new Error('DEX_PREPARATION_METEORA_QUOTE_REQUIRED')
  if(!input.takerAddress.trim())throw new Error('DEX_PREPARATION_TAKER_REQUIRED')
  const result=await this.prepareWithOfficialSdk(input)
  if(!result.providerRequestId.trim()||!result.evidenceIds.length)throw new Error('DEX_PREPARATION_METEORA_EVIDENCE_REQUIRED')
  if(result.currentInputAmountAtomic!==input.quote.inputAmountAtomic)throw new Error('DEX_PREPARATION_METEORA_INPUT_MISMATCH')
  if(result.currentOutputAmountAtomic<input.quote.minimumOutputAtomic||result.minimumOutputAtomic<input.quote.minimumOutputAtomic){
   throw new Error('DEX_PREPARATION_METEORA_OUTPUT_BELOW_MINIMUM')
  }
  const prepared:DexPreparedTransaction=Object.freeze({
   preparationId:'dex-prep:'+hash({provider:this.provider,quoteId:input.quote.quoteId,requestId:result.providerRequestId,taker:input.takerAddress,transaction:hash(result.unsignedTransactionBase64)}),
   provider:this.provider,quoteId:input.quote.quoteId,providerRequestId:result.providerRequestId,takerAddress:input.takerAddress,
   inputMint:input.quote.inputMint,outputMint:input.quote.outputMint,inputAmountAtomic:input.quote.inputAmountAtomic,
   minimumOutputAtomic:result.minimumOutputAtomic,unsignedTransactionBase64:result.unsignedTransactionBase64,preparedAt:input.now,
   evidenceIds:Object.freeze([...input.quote.evidenceIds,...result.evidenceIds]),
   authority:'UNSIGNED_TRANSACTION_PREPARATION_ONLY' as const,canSign:false as const,canBroadcast:false as const,
  })
  assertPreparationBinding(prepared,input.quote,input.takerAddress)
  return prepared
 }
}

export class GovernedDexTransactionPreparer{
 private readonly adapters:ReadonlyMap<DexRouteProvider,DexTransactionPreparationAdapter>
 constructor(adapters:readonly DexTransactionPreparationAdapter[]){
  const map=new Map<DexRouteProvider,DexTransactionPreparationAdapter>()
  for(const adapter of adapters){
   if(map.has(adapter.provider))throw new Error('DEX_PREPARATION_DUPLICATE_PROVIDER')
   map.set(adapter.provider,adapter)
  }
  this.adapters=map
 }
 async prepare(input:{routeDecision:DexRouteDecision;takerAddress:string;now:string}):Promise<DexPreparedTransaction>{
  const quote=input.routeDecision.selected
  if(!quote)throw new Error('DEX_PREPARATION_SELECTED_ROUTE_REQUIRED')
  if(input.routeDecision.canSign!==false||input.routeDecision.canBroadcast!==false||input.routeDecision.authority!=='ROUTE_SELECTION_ONLY'){
   throw new Error('DEX_PREPARATION_ROUTE_AUTHORITY_INVALID')
  }
  const selectedAttempt=input.routeDecision.attempts.find(x=>x.quote?.quoteId===quote.quoteId&&x.provider===quote.provider)
  if(!selectedAttempt||selectedAttempt.gate?.disposition!=='PASS')throw new Error('DEX_PREPARATION_PASSING_GATE_REQUIRED')
  const adapter=this.adapters.get(quote.provider)
  if(!adapter)throw new Error('DEX_PREPARATION_PROVIDER_UNCOMMISSIONED:'+quote.provider)
  const prepared=await adapter.prepare({quote,takerAddress:input.takerAddress,now:input.now})
  assertPreparationBinding(prepared,quote,input.takerAddress)
  return prepared
 }
}
