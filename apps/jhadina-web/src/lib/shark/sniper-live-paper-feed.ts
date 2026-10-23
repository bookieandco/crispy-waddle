/** SHARK-SNIPER.LIVE-PAPER.06 — public, read-only DexScreener canary.
 * This is an explicitly invoked, fixed-host GET adapter. NOT a chain launch
 * listener, DEX execution quote, signer, wallet or always-on deployed worker.
 * Canonical Helius/Pump ingestion remains the source of launch identity.
 */
export const SNIPER_PUBLIC_SOURCE='DEXSCREENER_PUBLIC_PRICE_ONLY' as const
const ORIGIN='https://api.dexscreener.com'
const PROFILE=ORIGIN+'/token-profiles/latest/v1'
const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const MAX_BYTES=1_000_000
const MAX_PROFILES=100
export type SniperPublicProfile=Readonly<{mint:string;firstSeenAt:string;source:'DEXSCREENER_PUBLIC_PROFILE';chainProof:false}>
export type SniperPublicPair=Readonly<{
 mint:string;pairAddress:string;dexId:string;priceUsd:number;
 reportedLiquidityUsd:number;pairCreatedAt?:string;receivedAt:string;
 observedAt:string;source:typeof SNIPER_PUBLIC_SOURCE;
 evidenceId:string;chainProof:false;executableQuote:false;verifiedSellPath:false
}>
export type SniperPublicRead=Readonly<{
 status:'READ_ONLY_OBSERVED'|'NO_MATCH_OR_UNVERIFIED_PAIR';
 mint:string;receivedAt:string;pair?:SniperPublicPair;
 authority:'PUBLIC_RESEARCH_ONLY';canSign:false;canTrade:false
}>
type ResponseLike=Readonly<{ok:boolean;status:number;text:()=>Promise<string>}>
type Fetcher=(url:string,init:{method:'GET';redirect:'error';signal:AbortSignal;headers:Readonly<Record<string,string>>})=>Promise<ResponseLike>
export type SniperPublicDeps=Readonly<{fetcher:Fetcher;now:()=>string;timeoutMs?:number}>
const validTime=(x:string)=>{const n=Date.parse(x);if(!x||!Number.isFinite(n))throw Error('SNIPER_PUBLIC_CLOCK_INVALID');return n}
const address=(x:string)=>MINT.test(x)
const object=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x)
const text=(x:unknown)=>typeof x==='string'?x:''
const finite=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)?x:NaN
const denied=(reason:string):never=>{throw Error('SNIPER_PUBLIC_'+reason)}
async function fixedGet(url:string,deps:SniperPublicDeps):Promise<unknown>{
 if(!url.startsWith(ORIGIN+'/')||new URL(url).origin!==ORIGIN)denied('HOST_INVALID')
 const timeout=deps.timeoutMs??5000
 if(!Number.isSafeInteger(timeout)||timeout<100||timeout>8000)denied('TIMEOUT_INVALID')
 const abort=new AbortController()
 // No user-supplied endpoint, body, credentials, redirects, wallet or auth header.
 const timer=setTimeout(()=>abort.abort(),timeout)
 try{
  const r=await deps.fetcher(url,{method:'GET',redirect:'error',signal:abort.signal,headers:{accept:'application/json'}})
  if(!r.ok)denied('HTTP_'+r.status)
  const raw=await r.text()
  if(raw.length>MAX_BYTES)denied('PAYLOAD_TOO_LARGE')
  try{return JSON.parse(raw) as unknown}catch{throw Error('SNIPER_PUBLIC_INVALID_JSON')}
 }finally{clearTimeout(timer)}
}
export async function readPublicSniperProfilesOnce(deps:SniperPublicDeps):Promise<readonly SniperPublicProfile[]>{
 const body=await fixedGet(PROFILE,deps)
 if(!Array.isArray(body)||body.length>MAX_PROFILES)throw Error('SNIPER_PUBLIC_PROFILE_SCHEMA_INVALID')
 const receivedAt=deps.now();validTime(receivedAt)
 const mints=new Set<string>()
 for(const item of body as unknown[]){
  if(object(item)&&item.chainId==='solana'&&address(text(item.tokenAddress)))mints.add(text(item.tokenAddress))
 }
 return Object.freeze([...mints].slice(0,MAX_PROFILES).map(mint=>Object.freeze({
  mint,firstSeenAt:receivedAt,source:'DEXSCREENER_PUBLIC_PROFILE' as const,chainProof:false as const,
 })))
}
export async function readPublicSniperPairOnce(input:{
 mint:string;originalPairAddress:string
},deps:SniperPublicDeps):Promise<SniperPublicRead>{
 if(!address(input.mint)||!address(input.originalPairAddress))denied('ADDRESS_INVALID')
 const body=await fixedGet(ORIGIN+'/token-pairs/v1/solana/'+input.mint,deps)
 const receivedAt=deps.now(),now=validTime(receivedAt)
 if(!Array.isArray(body)||body.length>100)throw Error('SNIPER_PUBLIC_PAIR_SCHEMA_INVALID')
 const row=(body as unknown[]).find((x:unknown)=>object(x)&&x.chainId==='solana'&&
  x.pairAddress===input.originalPairAddress&&object(x.baseToken)&&
  x.baseToken.address===input.mint)
 const base={mint:input.mint,receivedAt,authority:'PUBLIC_RESEARCH_ONLY' as const,
  canSign:false as const,canTrade:false as const}
 if(!object(row))return Object.freeze({...base,status:'NO_MATCH_OR_UNVERIFIED_PAIR' as const})
 const price=Number(row.priceUsd),liquidity=finite(object(row.liquidity)?row.liquidity.usd:undefined)
 const created=finite(row.pairCreatedAt)
 if(!Number.isFinite(price)||price<=0||!Number.isFinite(liquidity)||liquidity<=0||
   !text(row.dexId).trim()||(Number.isFinite(created)&&created>now)){
  return Object.freeze({...base,status:'NO_MATCH_OR_UNVERIFIED_PAIR' as const})
 }
 const pair:SniperPublicPair=Object.freeze({
  mint:input.mint,pairAddress:input.originalPairAddress,dexId:text(row.dexId),
  priceUsd:price,reportedLiquidityUsd:liquidity,
  ...(Number.isFinite(created)?{pairCreatedAt:new Date(created).toISOString()}:{}),
  receivedAt,observedAt:receivedAt,
  source:SNIPER_PUBLIC_SOURCE,
  evidenceId:'dex-public:'+input.mint+':'+input.originalPairAddress+':'+receivedAt,
  chainProof:false,executableQuote:false,verifiedSellPath:false,
 })
 return Object.freeze({...base,status:'READ_ONLY_OBSERVED' as const,pair})
}
