import { JupiterUltraDexAdapter } from './jupiter-ultra-dex-adapter.js'
import { RaydiumDirectDexAdapter,MeteoraDirectDexAdapter } from './direct-solana-dex-adapters.js'
import { RaydiumTradeApiOrderBuilder } from './raydium-trade-api-builder.js'
import { MeteoraDlmmOrderBuilderClient } from './meteora-dlmm-builder-client.js'
import { UniversalSolanaDexRouter } from './solana-dex-router.js'
import type { DexSwapIntent } from './solana-dex-runtime-contracts.js'

type FetchLike=(input:string|URL,init?:RequestInit)=>Promise<Response>

function record(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('DEX_TOKEN_ACCOUNT_RPC_RESPONSE_INVALID')
 return value as Record<string,unknown>
}

export class SolanaRpcTokenAccountResolver{
 private readonly fetchFn:FetchLike
 constructor(private readonly input:{resolveRpcEndpoint:()=>Promise<string>|string;fetchFn?:FetchLike}){this.fetchFn=input.fetchFn??fetch}
 async resolve(owner:string,mint:string):Promise<string|undefined>{
  const endpoint=await this.input.resolveRpcEndpoint()
  if(!endpoint.startsWith('https://'))throw new Error('DEX_TOKEN_ACCOUNT_RPC_HTTPS_REQUIRED')
  const response=await this.fetchFn(endpoint,{
   method:'POST',headers:{'content-type':'application/json',accept:'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getTokenAccountsByOwner',params:[owner,{mint},{encoding:'jsonParsed',commitment:'confirmed'}]}),
  })
  if(!response.ok)throw new Error('DEX_TOKEN_ACCOUNT_RPC_HTTP_'+response.status)
  const body=record(await response.json())
  if(body.error)throw new Error('DEX_TOKEN_ACCOUNT_RPC_ERROR')
  const result=record(body.result)
  const rows=Array.isArray(result.value)?result.value:[]
  const pubkeys=rows.map(item=>typeof record(item).pubkey==='string'?String(record(item).pubkey):'').filter(Boolean)
  if(pubkeys.length>1)throw new Error('DEX_TOKEN_ACCOUNT_AMBIGUOUS')
  return pubkeys[0]
 }
}

export type UniversalSolanaDexRuntimeOptions=Readonly<{
 resolveSolanaRpcEndpoint:()=>Promise<string>|string
 resolveJupiterApiKey:()=>Promise<string|undefined>|string|undefined
 raydiumComputeUnitPriceMicroLamports:string
 meteoraBuilderBaseUrl:string
 resolveMeteoraBuilderAuthorization:()=>Promise<string|undefined>|string|undefined
 fetchFn?:FetchLike
}>

export function createUniversalSolanaDexRuntime(options:UniversalSolanaDexRuntimeOptions):UniversalSolanaDexRouter{
 const fetchFn=options.fetchFn??fetch
 const tokenAccounts=new SolanaRpcTokenAccountResolver({resolveRpcEndpoint:options.resolveSolanaRpcEndpoint,fetchFn})
 const jupiter=new JupiterUltraDexAdapter({resolveApiKey:options.resolveJupiterApiKey,fetchFn})
 const raydium=new RaydiumDirectDexAdapter({
  builder:new RaydiumTradeApiOrderBuilder({
   computeUnitPriceMicroLamports:options.raydiumComputeUnitPriceMicroLamports,
   fetchFn,
   resolveTokenAccount:({owner,mint})=>tokenAccounts.resolve(owner,mint),
  }),
  resolveRpcEndpoint:options.resolveSolanaRpcEndpoint,
  fetchFn,
 })
 const meteora=new MeteoraDirectDexAdapter({
  builder:new MeteoraDlmmOrderBuilderClient({
   baseUrl:options.meteoraBuilderBaseUrl,
   resolveAuthorizationHeader:options.resolveMeteoraBuilderAuthorization,
   fetchFn,
  }),
  resolveRpcEndpoint:options.resolveSolanaRpcEndpoint,
  fetchFn,
 })
 return new UniversalSolanaDexRouter({adapters:[jupiter,raydium,meteora]})
}

export type DexRouterRuntimeBinding=Readonly<{
 router:UniversalSolanaDexRouter
 provider:'solana-dex-router'
 authority:'EXECUTION_ADAPTER_ONLY'
 canSign:false
 canAuthorizeTrade:false
}>

export function bindUniversalSolanaDexRuntime(options:UniversalSolanaDexRuntimeOptions):DexRouterRuntimeBinding{
 return Object.freeze({
  router:createUniversalSolanaDexRuntime(options),
  provider:'solana-dex-router',
  authority:'EXECUTION_ADAPTER_ONLY',
  canSign:false,
  canAuthorizeTrade:false,
 })
}

export type TokenAccountResolutionInput=Readonly<{owner:string;mint:string;intent?:DexSwapIntent}>
