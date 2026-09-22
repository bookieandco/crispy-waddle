import { METEORA_DLMM_PROGRAM_ID } from './meteora-dlmm'

export const SHARK_SOAK_REFERENCE_MINT='So11111111111111111111111111111111111111112' as const
export const SHARK_PROVIDER_PROGRAMS=Object.freeze({
  pump:'6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  pumpswap:'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA',
  raydium:'675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  meteora:METEORA_DLMM_PROGRAM_ID,
})

export type SharkProviderSoakState='READY'|'UNCONFIGURED'|'DEGRADED'|'FAILED'
export type SharkProviderSoakCheck=Readonly<{
  provider:'dexscreener'|'helius'|'helius-webhook'|'coingecko'|'solana-rpc'|'pump'|'pumpswap'|'raydium'|'meteora'
  state:SharkProviderSoakState
  latencyMs:number|null
  detail:string
  authority:'READ_ONLY'
}>

export type SharkProviderSoakReceipt=Readonly<{
  receiptVersion:'SHARK-PROVIDER-SOAK-01'
  checkedAt:string
  referenceMint:typeof SHARK_SOAK_REFERENCE_MINT
  checks:readonly SharkProviderSoakCheck[]
  passed:boolean
  blockers:readonly string[]
  writesPerformed:0
  financialAuthority:'NONE'
  walletSigningAuthority:'NONE'
}>

type FetchLike=typeof fetch
type SoakOptions=Readonly<{
  fetchImpl?:FetchLike
  now?:()=>Date
  timeoutMs?:number
  solanaRpcUrl?:string
  heliusRpcUrl?:string
  heliusApiKey?:string
  coinGeckoApiKey?:string
  publicOrigin?:string
}>

const elapsed=(start:number)=>Math.max(0,Date.now()-start)
const check=(provider:SharkProviderSoakCheck['provider'],state:SharkProviderSoakState,latencyMs:number|null,detail:string):SharkProviderSoakCheck=>
  Object.freeze({provider,state,latencyMs,detail,authority:'READ_ONLY'})

async function boundedFetch(fetchImpl:FetchLike,url:string,init:RequestInit,timeoutMs:number):Promise<Response>{
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),timeoutMs)
  try{return await fetchImpl(url,{...init,signal:controller.signal})}
  finally{clearTimeout(timer)}
}

async function dexScreener(fetchImpl:FetchLike,timeoutMs:number):Promise<SharkProviderSoakCheck>{
  const started=Date.now()
  try{
    const response=await boundedFetch(fetchImpl,`https://api.dexscreener.com/token-pairs/v1/solana/${SHARK_SOAK_REFERENCE_MINT}`,{headers:{accept:'application/json'}},timeoutMs)
    if(!response.ok)return check('dexscreener','FAILED',elapsed(started),`http_${response.status}`)
    const body=await response.json() as unknown
    if(!Array.isArray(body))return check('dexscreener','DEGRADED',elapsed(started),'unexpected_response_shape')
    return check('dexscreener','READY',elapsed(started),`pairs_${body.length}`)
  }catch{return check('dexscreener','FAILED',elapsed(started),'request_failed')}
}

async function jsonRpc(fetchImpl:FetchLike,url:string,method:string,params:unknown[],timeoutMs:number):Promise<any>{
  const response=await boundedFetch(fetchImpl,url,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:'shark-provider-soak',method,params}),
  },timeoutMs)
  if(!response.ok)throw new Error(`http_${response.status}`)
  const json=await response.json() as any
  if(json?.error)throw new Error('rpc_error')
  return json?.result
}

function heliusUrl(options:SoakOptions):string|undefined{
  if(options.heliusRpcUrl?.trim())return options.heliusRpcUrl.trim()
  if(options.heliusApiKey?.trim())return `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(options.heliusApiKey.trim())}`
  return undefined
}

async function helius(fetchImpl:FetchLike,options:SoakOptions,timeoutMs:number):Promise<SharkProviderSoakCheck>{
  const url=heliusUrl(options)
  if(!url)return check('helius','UNCONFIGURED',null,'provider_not_configured')
  const started=Date.now()
  try{
    const result=await jsonRpc(fetchImpl,url,'getHealth',[],timeoutMs)
    return check('helius',result==='ok'?'READY':'DEGRADED',elapsed(started),result==='ok'?'health_ok':'unexpected_health_response')
  }catch{return check('helius','FAILED',elapsed(started),'rpc_request_failed')}
}


function normalizedOrigin(value:string):string{
  const url=new URL(value)
  if(url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')throw new Error('invalid_public_origin')
  return url.origin
}

async function heliusWebhookRegistration(fetchImpl:FetchLike,apiKey:string|undefined,publicOrigin:string|undefined,timeoutMs:number):Promise<SharkProviderSoakCheck>{
  if(!apiKey?.trim()||!publicOrigin?.trim())return check('helius-webhook','UNCONFIGURED',null,'registration_check_not_configured')
  const started=Date.now()
  let expected:string
  try{expected=`${normalizedOrigin(publicOrigin.trim())}/api/webhooks/helius/launches`}
  catch{return check('helius-webhook','FAILED',elapsed(started),'public_origin_invalid')}
  try{
    const url=`https://api-mainnet.helius-rpc.com/v0/webhooks?api-key=${encodeURIComponent(apiKey.trim())}`
    const response=await boundedFetch(fetchImpl,url,{method:'GET',headers:{accept:'application/json'}},timeoutMs)
    if(!response.ok)return check('helius-webhook','FAILED',elapsed(started),`http_${response.status}`)
    const body=await response.json() as unknown
    if(!Array.isArray(body))return check('helius-webhook','DEGRADED',elapsed(started),'unexpected_response_shape')
    const match=body.find(row=>{
      if(!row||typeof row!=='object')return false
      const candidate=(row as Record<string,unknown>).webhookURL
      if(typeof candidate!=='string')return false
      try{return new URL(candidate).toString()===new URL(expected).toString()}catch{return false}
    }) as Record<string,unknown>|undefined
    if(!match)return check('helius-webhook','FAILED',elapsed(started),'registration_missing')
    if(match.active===false)return check('helius-webhook','DEGRADED',elapsed(started),'registration_inactive')
    return check('helius-webhook','READY',elapsed(started),'registration_found')
  }catch{return check('helius-webhook','FAILED',elapsed(started),'registration_request_failed')}
}

async function coinGecko(fetchImpl:FetchLike,apiKey:string|undefined,timeoutMs:number):Promise<SharkProviderSoakCheck>{
  if(!apiKey?.trim())return check('coingecko','UNCONFIGURED',null,'provider_not_configured')
  const started=Date.now()
  try{
    const query=new URLSearchParams({aggregate:'1',limit:'1',currency:'usd',include_empty_intervals:'false'})
    const url=`https://pro-api.coingecko.com/api/v3/onchain/networks/solana/tokens/${SHARK_SOAK_REFERENCE_MINT}/ohlcv/hour?${query}`
    const response=await boundedFetch(fetchImpl,url,{headers:{'x-cg-pro-api-key':apiKey.trim(),accept:'application/json'}},timeoutMs)
    if(!response.ok)return check('coingecko','FAILED',elapsed(started),`http_${response.status}`)
    const body=await response.json() as any
    const rows=body?.data?.attributes?.ohlcv_list
    return check('coingecko',Array.isArray(rows)?'READY':'DEGRADED',elapsed(started),Array.isArray(rows)?`ohlcv_rows_${rows.length}`:'unexpected_response_shape')
  }catch{return check('coingecko','FAILED',elapsed(started),'request_failed')}
}

async function solanaPrograms(fetchImpl:FetchLike,rpcUrl:string|undefined,timeoutMs:number):Promise<SharkProviderSoakCheck[]>{
  if(!rpcUrl?.trim()){
    return [
      check('solana-rpc','UNCONFIGURED',null,'provider_not_configured'),
      check('pump','UNCONFIGURED',null,'solana_rpc_not_configured'),
      check('pumpswap','UNCONFIGURED',null,'solana_rpc_not_configured'),
      check('raydium','UNCONFIGURED',null,'solana_rpc_not_configured'),
      check('meteora','UNCONFIGURED',null,'solana_rpc_not_configured'),
    ]
  }
  const started=Date.now()
  try{
    const addresses=Object.values(SHARK_PROVIDER_PROGRAMS)
    const result=await jsonRpc(fetchImpl,rpcUrl.trim(),'getMultipleAccounts',[addresses,{encoding:'base64',commitment:'confirmed'}],timeoutMs)
    const values=Array.isArray(result?.value)?result.value:[]
    const rpc=check('solana-rpc',values.length===addresses.length?'READY':'DEGRADED',elapsed(started),`accounts_${values.length}_of_${addresses.length}`)
    const names=(Object.keys(SHARK_PROVIDER_PROGRAMS) as Array<keyof typeof SHARK_PROVIDER_PROGRAMS>)
    const programs=names.map((name,index)=>{
      const account=values[index]
      const executable=account?.executable===true
      return check(name,executable?'READY':'FAILED',elapsed(started),executable?'program_account_executable':'program_account_missing_or_nonexecuting')
    })
    return [rpc,...programs]
  }catch{
    return [
      check('solana-rpc','FAILED',elapsed(started),'rpc_request_failed'),
      check('pump','FAILED',elapsed(started),'program_visibility_unavailable'),
      check('pumpswap','FAILED',elapsed(started),'program_visibility_unavailable'),
      check('raydium','FAILED',elapsed(started),'program_visibility_unavailable'),
      check('meteora','FAILED',elapsed(started),'program_visibility_unavailable'),
    ]
  }
}

export async function runSharkProviderSoak(options:SoakOptions={}):Promise<SharkProviderSoakReceipt>{
  const fetchImpl=options.fetchImpl??fetch
  const timeoutMs=Number.isInteger(options.timeoutMs)&&Number(options.timeoutMs)>=1000&&Number(options.timeoutMs)<=15000?Number(options.timeoutMs):5000
  const rpcUrl=options.solanaRpcUrl?.trim()||options.heliusRpcUrl?.trim()||heliusUrl(options)
  const [dex,heliusCheck,heliusWebhookCheck,coin,programChecks]=await Promise.all([
    dexScreener(fetchImpl,timeoutMs),
    helius(fetchImpl,options,timeoutMs),
    heliusWebhookRegistration(fetchImpl,options.heliusApiKey,options.publicOrigin,timeoutMs),
    coinGecko(fetchImpl,options.coinGeckoApiKey,timeoutMs),
    solanaPrograms(fetchImpl,rpcUrl,timeoutMs),
  ])
  const checks=Object.freeze([dex,heliusCheck,heliusWebhookCheck,coin,...programChecks])
  const blockers=Object.freeze(checks.filter(item=>item.state!=='READY').map(item=>`${item.provider}:${item.state.toLowerCase()}`))
  return Object.freeze({
    receiptVersion:'SHARK-PROVIDER-SOAK-01',
    checkedAt:(options.now?.()??new Date()).toISOString(),
    referenceMint:SHARK_SOAK_REFERENCE_MINT,
    checks,
    passed:blockers.length===0,
    blockers,
    writesPerformed:0,
    financialAuthority:'NONE',
    walletSigningAuthority:'NONE',
  })
}
