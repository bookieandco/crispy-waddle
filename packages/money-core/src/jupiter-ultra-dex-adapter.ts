import type { DexManagedOrder, DexProviderExecutionReceipt, DexSignedTransaction, DexSwapIntent, ManagedSolanaDexAdapter } from './solana-dex-runtime-contracts.js'

type FetchLike=(input:string|URL,init?:RequestInit)=>Promise<Response>

export type JupiterUltraDexAdapterOptions=Readonly<{
 baseUrl?:string
 resolveApiKey?:()=>Promise<string|undefined>|string|undefined
 fetchFn?:FetchLike
}>

function asRecord(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('DEX_JUPITER_RESPONSE_INVALID')
 return value as Record<string,unknown>
}
function requiredString(row:Record<string,unknown>,key:string,code:string):string{
 const value=row[key]
 if(typeof value!=='string'||!value.trim())throw new Error(code)
 return value
}
function optionalAtomic(row:Record<string,unknown>,...keys:string[]):bigint|undefined{
 for(const key of keys){
  const value=row[key]
  if(typeof value==='string'&&/^\d+$/.test(value))return BigInt(value)
  if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)return BigInt(value)
 }
 return undefined
}

export class JupiterUltraDexAdapter implements ManagedSolanaDexAdapter{
 readonly provider='jupiter-ultra' as const
 private readonly baseUrl:string
 private readonly resolveApiKey?:JupiterUltraDexAdapterOptions['resolveApiKey']
 private readonly fetchFn:FetchLike
 constructor(options:JupiterUltraDexAdapterOptions={}){
  this.baseUrl=(options.baseUrl??'https://api.jup.ag').replace(/\/$/,'')
  if(!this.baseUrl.startsWith('https://'))throw new Error('DEX_JUPITER_HTTPS_REQUIRED')
  this.resolveApiKey=options.resolveApiKey
  this.fetchFn=options.fetchFn??fetch
 }
 private async headers(extra:Record<string,string>={}):Promise<Record<string,string>>{
  const apiKey=await this.resolveApiKey?.()
  return apiKey?{...extra,'x-api-key':apiKey}:{...extra}
 }
 async createOrder(input:{intent:DexSwapIntent;takerAddress:string}):Promise<DexManagedOrder>{
  const {intent,takerAddress}=input
  const url=new URL(this.baseUrl+'/swap/v2/order')
  url.searchParams.set('inputMint',intent.inputMint)
  url.searchParams.set('outputMint',intent.outputMint)
  url.searchParams.set('amount',intent.inputAmountAtomic.toString())
  url.searchParams.set('taker',takerAddress)
  const response=await this.fetchFn(url,{method:'GET',headers:await this.headers({'accept':'application/json'})})
  if(!response.ok)throw new Error('DEX_JUPITER_ORDER_HTTP_'+response.status)
  const row=asRecord(await response.json())
  const requestId=requiredString(row,'requestId','DEX_JUPITER_REQUEST_ID_REQUIRED')
  const transaction=requiredString(row,'transaction','DEX_JUPITER_TRANSACTION_REQUIRED')
  const inAmount=optionalAtomic(row,'inAmount','inputAmount')
  const outAmount=optionalAtomic(row,'outAmount','outputAmount')
  if(inAmount===undefined||inAmount!==intent.inputAmountAtomic)throw new Error('DEX_JUPITER_INPUT_AMOUNT_MISMATCH')
  if(outAmount===undefined||outAmount<=0n)throw new Error('DEX_JUPITER_OUTPUT_AMOUNT_INVALID')
  return Object.freeze({
   provider:this.provider,
   requestId,
   inputMint:intent.inputMint,
   outputMint:intent.outputMint,
   inputAmountAtomic:inAmount,
   quotedOutputAtomic:outAmount,
   unsignedTransactionBase64:transaction,
   takerAddress,
   evidenceIds:Object.freeze(['jupiter:order:'+requestId]),
   authority:'PROVIDER_QUOTE_ONLY' as const,
   canBroadcast:false as const,
  })
 }
 async executeSigned(input:{intent:DexSwapIntent;order:DexManagedOrder;signed:DexSignedTransaction;now:string}):Promise<DexProviderExecutionReceipt>{
  const response=await this.fetchFn(this.baseUrl+'/swap/v2/execute',{
   method:'POST',
   headers:await this.headers({'content-type':'application/json','accept':'application/json'}),
   body:JSON.stringify({signedTransaction:input.signed.signedTransactionBase64,requestId:input.order.requestId}),
  })
  if(!response.ok)throw new Error('DEX_JUPITER_EXECUTE_HTTP_'+response.status)
  const row=asRecord(await response.json())
  const signature=typeof row.signature==='string'&&row.signature.trim()?row.signature:undefined
  const status=typeof row.status==='string'?row.status.toLowerCase():''
  const rawCode=row.code??row.errorCode
  const errorCode=typeof rawCode==='string'?rawCode:typeof rawCode==='number'?String(rawCode):typeof row.error==='string'?row.error:undefined
  const failed=Boolean(errorCode)||status.includes('fail')||status.includes('error')
  const state:DexProviderExecutionReceipt['state']=failed?'FAILED':signature?'ACKNOWLEDGED':'UNKNOWN'
  const receiptId='jupiter:execute:'+input.order.requestId+':'+(signature??'unknown')
  return Object.freeze({
   receiptId,
   provider:this.provider,
   requestId:input.order.requestId,
   executionId:input.intent.executionId,
   state,
   signature,
   inputAmountAtomic:optionalAtomic(row,'inputAmountResult','inAmount','inputAmount'),
   outputAmountAtomic:optionalAtomic(row,'outputAmountResult','outAmount','outputAmount'),
   errorCode,
   observedAt:input.now,
   evidenceIds:Object.freeze([receiptId]),
   authority:'PROVIDER_EXECUTION_EVIDENCE' as const,
  })
 }
}
