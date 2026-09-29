import type { DexSwapIntent } from './solana-dex-runtime-contracts.js'
import type { DirectDexBuildResult, DirectDexOrderBuilder } from './direct-solana-dex-adapters.js'

type FetchLike=(input:string|URL,init?:RequestInit)=>Promise<Response>
const NATIVE_SOL='So11111111111111111111111111111111111111112'

type RaydiumBuilderOptions=Readonly<{
 baseUrl?:string
 fetchFn?:FetchLike
 computeUnitPriceMicroLamports:string
 resolveTokenAccount?:(input:{owner:string;mint:string;intent:DexSwapIntent})=>Promise<string|undefined>|string|undefined
 now?:()=>string
}>

function record(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('DEX_RAYDIUM_RESPONSE_INVALID')
 return value as Record<string,unknown>
}
function atomic(value:unknown,code:string):bigint{
 if(typeof value==='string'&&/^\d+$/.test(value))return BigInt(value)
 if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)return BigInt(value)
 throw new Error(code)
}
function num(value:unknown,code:string):number{
 const n=typeof value==='number'?value:typeof value==='string'?Number(value):NaN
 if(!Number.isFinite(n)||n<0)throw new Error(code)
 return n
}

export class RaydiumTradeApiOrderBuilder implements DirectDexOrderBuilder{
 private readonly baseUrl:string
 private readonly fetchFn:FetchLike
 private readonly computeUnitPriceMicroLamports:string
 private readonly resolveTokenAccount?:RaydiumBuilderOptions['resolveTokenAccount']
 private readonly now:()=>string
 constructor(options:RaydiumBuilderOptions){
  this.baseUrl=(options.baseUrl??'https://transaction-v1.raydium.io').replace(/\/$/,'')
  if(!this.baseUrl.startsWith('https://'))throw new Error('DEX_RAYDIUM_HTTPS_REQUIRED')
  if(!/^\d+$/.test(options.computeUnitPriceMicroLamports))throw new Error('DEX_RAYDIUM_PRIORITY_FEE_INVALID')
  this.fetchFn=options.fetchFn??fetch
  this.computeUnitPriceMicroLamports=options.computeUnitPriceMicroLamports
  this.resolveTokenAccount=options.resolveTokenAccount
  this.now=options.now??(()=>new Date().toISOString())
 }
 async build(input:{provider:'raydium-direct'|'meteora-direct';intent:DexSwapIntent;takerAddress:string}):Promise<DirectDexBuildResult>{
  if(input.provider!=='raydium-direct')throw new Error('DEX_RAYDIUM_PROVIDER_REQUIRED')
  const {intent,takerAddress}=input
  const computeUrl=new URL(this.baseUrl+'/compute/swap-base-in')
  computeUrl.searchParams.set('inputMint',intent.inputMint)
  computeUrl.searchParams.set('outputMint',intent.outputMint)
  computeUrl.searchParams.set('amount',intent.inputAmountAtomic.toString())
  computeUrl.searchParams.set('slippageBps',String(intent.requestedSlippageBps))
  computeUrl.searchParams.set('txVersion','V0')
  const computeResponse=await this.fetchFn(computeUrl,{method:'GET',headers:{accept:'application/json'}})
  if(!computeResponse.ok)throw new Error('DEX_RAYDIUM_COMPUTE_HTTP_'+computeResponse.status)
  const swapResponse=record(await computeResponse.json())
  if(swapResponse.success!==true)throw new Error('DEX_RAYDIUM_COMPUTE_REJECTED')
  const data=record(swapResponse.data)
  if(String(data.inputMint??'')!==intent.inputMint||String(data.outputMint??'')!==intent.outputMint)throw new Error('DEX_RAYDIUM_MINT_BINDING_MISMATCH')
  if(atomic(data.inputAmount,'DEX_RAYDIUM_INPUT_AMOUNT_REQUIRED')!==intent.inputAmountAtomic)throw new Error('DEX_RAYDIUM_INPUT_AMOUNT_MISMATCH')
  const output=atomic(data.outputAmount,'DEX_RAYDIUM_OUTPUT_AMOUNT_REQUIRED')
  const minimum=atomic(data.otherAmountThreshold,'DEX_RAYDIUM_MINIMUM_OUTPUT_REQUIRED')
  if(output<=0n||minimum<intent.minimumOutputAtomic)throw new Error('DEX_RAYDIUM_MINIMUM_OUTPUT_UNSATISFIED')
  const inputIsSol=intent.inputMint===NATIVE_SOL
  const outputIsSol=intent.outputMint===NATIVE_SOL
  const inputAccount=inputIsSol?undefined:await this.resolveTokenAccount?.({owner:takerAddress,mint:intent.inputMint,intent})
  const outputAccount=outputIsSol?undefined:await this.resolveTokenAccount?.({owner:takerAddress,mint:intent.outputMint,intent})
  if(!inputIsSol&&!inputAccount)throw new Error('DEX_RAYDIUM_INPUT_TOKEN_ACCOUNT_REQUIRED')
  const txResponse=await this.fetchFn(this.baseUrl+'/transaction/swap-base-in',{
   method:'POST',
   headers:{'content-type':'application/json',accept:'application/json'},
   body:JSON.stringify({
    computeUnitPriceMicroLamports:this.computeUnitPriceMicroLamports,
    swapResponse,
    txVersion:'V0',
    wallet:takerAddress,
    wrapSol:inputIsSol,
    unwrapSol:outputIsSol,
    inputAccount,
    outputAccount,
   }),
  })
  if(!txResponse.ok)throw new Error('DEX_RAYDIUM_TRANSACTION_HTTP_'+txResponse.status)
  const txBody=record(await txResponse.json())
  if(txBody.success!==true)throw new Error('DEX_RAYDIUM_TRANSACTION_REJECTED')
  const rows=Array.isArray(txBody.data)?txBody.data:[]
  if(rows.length!==1)throw new Error('DEX_RAYDIUM_MULTI_TRANSACTION_ROUTE_NOT_ADMITTED')
  const tx=record(rows[0])
  const encoded=typeof tx.transaction==='string'?tx.transaction:''
  if(!encoded)throw new Error('DEX_RAYDIUM_TRANSACTION_REQUIRED')
  const impactPct=num(data.priceImpactPct??0,'DEX_RAYDIUM_PRICE_IMPACT_INVALID')
  const priceImpactBps=Math.ceil(impactPct*100)
  if(priceImpactBps>10000)throw new Error('DEX_RAYDIUM_PRICE_IMPACT_INVALID')
  const requestId=typeof swapResponse.id==='string'&&swapResponse.id.trim()?swapResponse.id:'raydium:'+intent.executionId
  const observedAt=this.now()
  return Object.freeze({
   requestId,
   quotedOutputAtomic:output,
   unsignedTransactionBase64:encoded,
   quoteObservedAt:observedAt,
   priceImpactBps,
   evidenceIds:Object.freeze([
    'raydium:compute:'+requestId,
    'raydium:transaction:'+requestId,
    'raydium:minimum:'+minimum.toString(),
   ]),
  })
 }
}
