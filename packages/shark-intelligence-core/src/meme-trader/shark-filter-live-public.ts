import {evaluateSharkDiscoveryScreen,type SharkDiscoveryStage,type SharkDiscoveryPresetId,type SharkDiscoveryObservation} from './stage-aware-discovery-screen'
import type {PumpMigrationRadarCandidate} from './migration-radar'
import {adaptTerminalFeeSnapshot,attachDeclaredTerminalFee,type TerminalFeeSnapshot} from './shark-fee-evidence'

const BASE58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const ENDPOINT='https://api.dexscreener.com/token-pairs/v1/solana/'
const MAX_BYTES=250_000

export type PublicDexPair=Readonly<{
  mint:string
  pairAddress:string
  dexId:string
  quoteMint:string
  pairCreatedAt?:number
  receivedAt:string
  priceUsd?:number
  liquidityUsd?:number
  marketCapUsd?:number
  /** Explicitly hourly. Imported video thresholds do not identify a window. */
  hourlyVolumeUsd?:number
  socialLinksCount?:number
  localReceiptId:string
  provider:'DEXSCREENER_PUBLIC_TOKEN_PAIRS_V1'
  providerIndependentlyAttested:false
  evidenceAuthority:'PUBLIC_MARKET_RESEARCH_ONLY'
}>
export type PublicDexReadResult=Readonly<{
  status:'PAIR_OBSERVED'|'NO_PAIR'|'SOURCE_UNAVAILABLE'
  pair?:PublicDexPair
  missing:readonly string[]
  authority:'PUBLIC_MARKET_READ_ONLY'
  canAuthorizeTrade:false
}>
export type VerifiedStageReceipt=Readonly<{
  mint:string
  pairAddress:string
  stage:SharkDiscoveryStage
  observedAt:string
  availableAt:string
  evidenceIds:readonly string[]
  verifiedByCanonicalLifecycle:boolean
  defensiveBlockReasons?:readonly string[]
}>
export type PublicFilterCanary=Readonly<{
  status:'SCREENED_RESEARCH_ONLY'|'STAGE_UNVERIFIED'|'FEED_UNAVAILABLE'
  pair?:PublicDexPair
  screen?:ReturnType<typeof evaluateSharkDiscoveryScreen>
  missing:readonly string[]
  prospectivePaperEntry:false
  canSign:false
  canBroadcast:false
  authority:'PUBLIC_FILTER_CANARY_ONLY'
}>
const at=(s:string,field:string)=>{
  const n=Date.parse(s)
  if(!s.trim()||!Number.isFinite(n))throw new Error('shark_public_time_invalid:'+field)
  return n
}
const record=(x:unknown):Record<string,unknown>|undefined=>
  x!==null&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:undefined
const text=(x:unknown)=>typeof x==='string'?x:''
const money=(x:unknown):number|undefined=>
  typeof x==='number'&&Number.isFinite(x)&&x>=0?x:undefined
const optionalPrice=(x:unknown):number|undefined=>{
  if(typeof x!=='string'||x.trim()==='')return undefined
  const n=Number(x)
  return Number.isFinite(n)&&n>=0?n:undefined
}

/**
 * Parse documented DexScreener token-pairs/v1 array only. Never infer Pump
 * graduation, organic buyers, terminal fee totals or executable sell quotes.
 * Caller MUST pin pair; otherwise multiple pools risk a retrospective switch.
 */
export function normalizePublicDexPairs(input:{
  payload:unknown
  mint:string
  pairAddress:string
  receivedAt:string
  localReceiptId:string
}):PublicDexReadResult{
  if(!BASE58.test(input.mint)||!BASE58.test(input.pairAddress))
    throw new Error('shark_public_mint_or_pair_invalid')
  const received=at(input.receivedAt,'received')
  if(!input.localReceiptId.trim())throw new Error('shark_public_receipt_id_required')
  if(!Array.isArray(input.payload)||input.payload.length>30)
    throw new Error('shark_public_payload_invalid')
  const records=input.payload.map(record).filter((p):p is Record<string,unknown>=>p!==undefined)
  const matched=records.filter(p=>p.chainId==='solana'&&p.pairAddress===input.pairAddress)
  if(matched.length===0)return Object.freeze({
    status:'NO_PAIR',missing:Object.freeze(['original-pair-not-returned']),
    authority:'PUBLIC_MARKET_READ_ONLY',canAuthorizeTrade:false,
  })
  if(matched.length!==1)throw new Error('shark_public_duplicate_pair')
  const p=matched[0]!
  const base=record(p.baseToken),quote=record(p.quoteToken)
  const baseAddr=text(base?.address),quoteAddr=text(quote?.address)
  if(!BASE58.test(baseAddr)||!BASE58.test(quoteAddr)||
     (baseAddr!==input.mint&&quoteAddr!==input.mint))
    throw new Error('shark_public_pair_token_binding_invalid')
  const dexId=text(p.dexId)
  if(!dexId.trim())throw new Error('shark_public_dex_id_missing')
  const created=p.pairCreatedAt
  if(created!==undefined&&(!Number.isSafeInteger(created)||typeof created!=='number'||created<0||created>received))
    throw new Error('shark_public_pair_creation_invalid')
  const liquidity=record(p.liquidity),volume=record(p.volume),info=record(p.info)
  const social=info?.socials
  const websites=info?.websites
  const socialLinksCount=Array.isArray(social)&&Array.isArray(websites)?
    social.length+websites.length:undefined
  const pair:PublicDexPair=Object.freeze({
    mint:input.mint,pairAddress:input.pairAddress,dexId,
    quoteMint:baseAddr===input.mint?quoteAddr:baseAddr,
    pairCreatedAt:created as number|undefined,receivedAt:input.receivedAt,
    priceUsd:optionalPrice(p.priceUsd),liquidityUsd:money(liquidity?.usd),
    marketCapUsd:money(p.marketCap),hourlyVolumeUsd:money(volume?.h1),
    socialLinksCount,localReceiptId:input.localReceiptId,
    provider:'DEXSCREENER_PUBLIC_TOKEN_PAIRS_V1',
    providerIndependentlyAttested:false,
    evidenceAuthority:'PUBLIC_MARKET_RESEARCH_ONLY',
  })
  return Object.freeze({status:'PAIR_OBSERVED',pair,missing:Object.freeze(
    ['terminal-global-fees-not-in-source','holder-independence-not-in-source','sellability-not-proven']),
    authority:'PUBLIC_MARKET_READ_ONLY',canAuthorizeTrade:false,
  })
}


/**
 * Only the pre-existing canonical Pump radar can promote discovery to a
 * lifecycle label. Completed curve != migrated pool. A migrated label requires
 * the radar's verified PumpSwap pool to be this exact original pair.
 */
export function stageReceiptFromPumpRadar(input:{
  candidate:PumpMigrationRadarCandidate
  pairAddress:string
}):VerifiedStageReceipt|undefined{
  const c=input.candidate
  if(c.authority!=='RESEARCH_ONLY'||c.canAuthorizeTrade!==false||
     !BASE58.test(c.mint)||!BASE58.test(input.pairAddress)||
     !c.evidenceIds.length||c.evidenceIds.some(id=>!id.trim())||
     c.missingChecks.length>0)return undefined
  const stage:SharkDiscoveryStage|undefined=
    c.stage==='DISCOVERED'?'NEW_PAIR':
    c.stage==='APPROACHING_GRADUATION'?'FINAL_STRETCH':
    c.stage==='PUMPSWAP_MIGRATED'?'MIGRATED':undefined
  if(!stage)return undefined
  if(stage==='MIGRATED'&&c.pumpSwapPoolAddress!==input.pairAddress)return undefined
  const observed=at(c.observedAt,'radar-observed')
  const available=at(c.availableAt,'radar-available')
  if(available<observed)return undefined
  return Object.freeze({
    mint:c.mint,pairAddress:input.pairAddress,stage,
    observedAt:c.observedAt,availableAt:c.availableAt,
    evidenceIds:Object.freeze([...new Set(c.evidenceIds)].sort()),
    verifiedByCanonicalLifecycle:true as const,
    defensiveBlockReasons:Object.freeze([...new Set(c.blockers)].sort()),
  })
}

type PublicFetch=(url:string,init:RequestInit)=>Promise<Pick<Response,'ok'|'status'|'text'>>
/**
 * One explicit, bounded, GET-only canary. No credentials, redirects,
 * Telegram, RPC POST, scheduler, payout, purchase or signing.
 */
export async function readPublicDexPair(input:{
  mint:string
  pairAddress:string
  receivedAt:string
  localReceiptId:string
  fetcher:PublicFetch
}):Promise<PublicDexReadResult>{
  if(!BASE58.test(input.mint)||!BASE58.test(input.pairAddress))
    throw new Error('shark_public_mint_or_pair_invalid')
  if(!input.localReceiptId.trim())throw new Error('shark_public_receipt_id_required')
  at(input.receivedAt,'received')
  const url=ENDPOINT+encodeURIComponent(input.mint)
  try{
    const result=await input.fetcher(url,{method:'GET',redirect:'error',
      headers:{Accept:'application/json'},signal:AbortSignal.timeout(4000)})
    if(!result.ok||result.status!==200)throw new Error('shark_public_http_status')
    const body=await result.text()
    if(body.length>MAX_BYTES)throw new Error('shark_public_body_oversized')
    return normalizePublicDexPairs({...input,payload:JSON.parse(body) as unknown})
  }catch{
    return Object.freeze({
      status:'SOURCE_UNAVAILABLE',missing:Object.freeze(['public-data-transport-or-schema-error']),
      authority:'PUBLIC_MARKET_READ_ONLY',canAuthorizeTrade:false,
    })
  }
}

/** Use only canonical lifecycle evidence to attach a stage to a DEX pair. */
export function runPublicFilterCanary(input:{
  read:PublicDexReadResult
  stage?:VerifiedStageReceipt
  feeSnapshot?:TerminalFeeSnapshot
  presetId:SharkDiscoveryPresetId
  informationCutoff:string
}):PublicFilterCanary{
  const cutoff=at(input.informationCutoff,'cutoff')
  const pair=input.read.pair
  const terminal=(status:PublicFilterCanary['status'],missing:readonly string[]):PublicFilterCanary=>
    Object.freeze({status,pair,missing:Object.freeze([...missing]),
      prospectivePaperEntry:false,canSign:false,canBroadcast:false,
      authority:'PUBLIC_FILTER_CANARY_ONLY'})
  if(input.read.status!=='PAIR_OBSERVED'||!pair)
    return terminal('FEED_UNAVAILABLE',input.read.missing)
  const stage=input.stage
  if(!stage||!stage.verifiedByCanonicalLifecycle||
     stage.mint!==pair.mint||stage.pairAddress!==pair.pairAddress||
     !stage.evidenceIds.length||stage.evidenceIds.some(id=>!id.trim()))
    return terminal('STAGE_UNVERIFIED',['canonical-launch-stage-unavailable'])
  const stageTime=at(stage.observedAt,'stage-observed'),available=at(stage.availableAt,'stage-available')
  if(available<stageTime||available>cutoff||available>at(pair.receivedAt,'received'))
    return terminal('STAGE_UNVERIFIED',['canonical-launch-stage-not-yet-available'])
  if(at(pair.receivedAt,'received')>cutoff)
    throw new Error('shark_public_future_quote')
  const obs:SharkDiscoveryObservation={
    chainId:'solana',mint:pair.mint,stage:stage.stage,protocol:pair.dexId,
    observedAt:pair.receivedAt,availableAt:pair.receivedAt,
    evaluatedAsOf:input.informationCutoff,
    ageMinutes:pair.pairCreatedAt===undefined?undefined:
      (at(pair.receivedAt,'received')-pair.pairCreatedAt)/60000,
    // h1 is an explicit experiment mapping, not presumed video's volume window.
    volumeUsd:pair.hourlyVolumeUsd,marketCapUsd:pair.marketCapUsd,
    socialLinksCount:pair.socialLinksCount,
    evidenceIds:[pair.localReceiptId,...stage.evidenceIds],
    defensiveBlockReasons:stage.defensiveBlockReasons,
  }
  const adapted=adaptTerminalFeeSnapshot({
    mint:pair.mint,snapshot:input.feeSnapshot,cutoff:pair.receivedAt,
  })
  const screen=evaluateSharkDiscoveryScreen(attachDeclaredTerminalFee(obs,adapted),input.presetId)
  return Object.freeze({
    status:'SCREENED_RESEARCH_ONLY',pair,screen,
    missing:Object.freeze([...new Set([...input.read.missing,...adapted.warnings])].sort()),
    prospectivePaperEntry:false,canSign:false,canBroadcast:false,
    authority:'PUBLIC_FILTER_CANARY_ONLY',
  })
}
