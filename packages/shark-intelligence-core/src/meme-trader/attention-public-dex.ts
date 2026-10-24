/**
 * SHARK-ATTENTION.LIVE-PAPER.07 — narrowly-scoped, public-only DexScreener
 * snapshot reader. This is not a new scanner: feed already belongs to the
 * canonical SHARK market worker. An independently commissioned caller decides
 * when to read. No wallet, Telegram, paid API, news scraper or trading code.
 *
 * Official documented endpoint: /token-pairs/v1/solana/{tokenAddress}
 * Rate ceiling published at 300 requests/min; the caller must enforce a
 * lower shared project budget and respect all provider terms.
 */
import {normalizeDexScreenerPair} from './dexscreener-event-ingest'
import type {PublicAttentionEvidence} from './attention-research'

export type AttentionDexSnapshot=Readonly<{
  chainId:'solana'
  mint:string
  pairAddress:string
  priceUsd:number
  liquidityUsd:number
  observedAt:string
  receiptId:string
  source:'DEXSCREENER_PUBLIC_PAIR'
  sourceAuthenticated:false
  canTrade:false
}>

const mintPattern=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const MAX_BODY=256*1024
const MAX_PAIRS=100
const MAX_POLL_GAP_MS=15*60_000
const stamp=(value:string)=> {
  const t=Date.parse(value)
  if(!Number.isFinite(t)||typeof value!=='string'||!value.endsWith('Z'))throw new Error('ATTENTION_DEX_TIME_INVALID')
  return t
}
const object=(value:unknown):Record<string,unknown>|null=>
  value!==null&&typeof value==='object'&&!Array.isArray(value) ? value as Record<string,unknown> : null
function normalized(mint:string,pairs:unknown,observedAt:string):AttentionDexSnapshot{
  if(!mintPattern.test(mint)||!Array.isArray(pairs)||pairs.length>MAX_PAIRS)
    throw new Error('ATTENTION_DEX_PAIR_BATCH_INVALID')
  stamp(observedAt)
  const valid:AttentionDexSnapshot[]=[]
  for(const item of pairs){
    const pair=object(item)
    if(!pair)throw new Error('ATTENTION_DEX_PAIR_INVALID')
    if(pair.chainId!=='solana')continue
    const base=object(pair.baseToken)
    // Pool must have the requested token as BASE. Quote-side matches are not
    // comparable to base-side prices and must not be silently included.
    if(base?.address!==mint)continue
    const address=pair.pairAddress
    if(typeof address!=='string'||!mintPattern.test(address))throw new Error('ATTENTION_DEX_PAIR_ID_INVALID')
    const n=normalizeDexScreenerPair(pair,observedAt)
    const price=n.payload.priceUsd,liquidity=n.payload.liquidityUsd
    if(!Number.isFinite(price)||price===undefined||price<=0||
       !Number.isFinite(liquidity)||liquidity===undefined||liquidity<0)
      continue
    const receiptId='dex-public:'+mint+':'+address+':'+observedAt+':'+price+':'+liquidity
    valid.push(Object.freeze({chainId:'solana' as const,mint,pairAddress:address,
      priceUsd:price,liquidityUsd:liquidity,observedAt,receiptId,
      source:'DEXSCREENER_PUBLIC_PAIR' as const,sourceAuthenticated:false as const,
      canTrade:false as const}))
  }
  if(!valid.length)throw new Error('ATTENTION_DEX_NO_VALID_BASE_PAIR')
  valid.sort((a,b)=>b.liquidityUsd-a.liquidityUsd||
    a.pairAddress.localeCompare(b.pairAddress))
  return valid[0]
}

/** Uses one fixed HTTPS host, no dynamic URL, auth header, redirect or retry. */
export async function readPublicDexSnapshot(input:Readonly<{
  mint:string
  request:typeof fetch
  clock:()=>string
}>):Promise<AttentionDexSnapshot>{
  if(!mintPattern.test(input.mint))throw new Error('ATTENTION_DEX_MINT_INVALID')
  const url='https://api.dexscreener.com/token-pairs/v1/solana/'+input.mint
  const controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),5000)
  try{
    const response=await input.request(url,{
      method:'GET',headers:{Accept:'application/json'},redirect:'error',
      cache:'no-store',signal:controller.signal,
    })
    if(!response.ok)throw new Error('ATTENTION_DEX_HTTP_UNAVAILABLE')
    const length=response.headers.get('content-length')
    if(length!==null&&(!/^[0-9]+$/.test(length)||Number(length)>MAX_BODY))
      throw new Error('ATTENTION_DEX_BODY_TOO_LARGE')
    // Enforce a byte ceiling while streaming, even if Content-Length is absent
    // or dishonest. Never buffer an unbounded third-party response.
    if(response.headers.get('content-type')&&
       !response.headers.get('content-type')!.toLowerCase().includes('application/json'))
      throw new Error('ATTENTION_DEX_CONTENT_TYPE_INVALID')
    if(!response.body)throw new Error('ATTENTION_DEX_EMPTY_BODY')
    const reader=response.body.getReader()
    const decoder=new TextDecoder('utf-8',{fatal:true})
    let bytes=0
    let raw=''
    try{
      for(;;){
        const next=await reader.read()
        if(next.done)break
        bytes+=next.value.byteLength
        if(bytes>MAX_BODY)throw new Error('ATTENTION_DEX_BODY_TOO_LARGE')
        raw+=decoder.decode(next.value,{stream:true})
      }
      raw+=decoder.decode()
    }finally{reader.releaseLock()}
    const at=input.clock() // after network receipt; never invent provider event time
    return normalized(input.mint,JSON.parse(raw) as unknown,at)
  }finally{clearTimeout(timeout)}
}

/** Deterministic for test fixtures; not an independent source attestation. */
export function normalizePublicDexSnapshot(input:{
  mint:string;pairs:unknown;observedAt:string
}):AttentionDexSnapshot{return normalized(input.mint,input.pairs,input.observedAt)}

/** Only same-pool, fresh sequential snapshots can produce price-change evidence. */
export function deriveDexPriceMove(
  previous:AttentionDexSnapshot,current:AttentionDexSnapshot,
):PublicAttentionEvidence|null{
  if(previous.mint!==current.mint||previous.pairAddress!==current.pairAddress)
    throw new Error('ATTENTION_DEX_POOL_MISMATCH')
  const gap=stamp(current.observedAt)-stamp(previous.observedAt)
  if(gap<=0||gap>MAX_POLL_GAP_MS)throw new Error('ATTENTION_DEX_PREVIOUS_STALE')
  if(previous.receiptId===current.receiptId||previous.priceUsd<=0||current.priceUsd<=0)
    throw new Error('ATTENTION_DEX_NON_COMPARABLE')
  const change=(current.priceUsd/previous.priceUsd-1)*10000
  if(!Number.isFinite(change)||Math.abs(change)>1000000)throw new Error('ATTENTION_DEX_PRICE_MOVE_OUT_OF_RANGE')
  return Object.freeze({
    eventId:current.receiptId,
    mint:current.mint,
    source:'PUBLIC_MARKET' as const,signal:'PRICE_MOVE' as const,publicOnly:true as const,
    sourceUrl:'https://dexscreener.com/solana/'+current.pairAddress,
    providerReceiptId:current.receiptId,
    claimId:'market:price:'+current.pairAddress,
    eventAt:current.observedAt,observedAt:current.observedAt,availableAt:current.observedAt,
    priceMoveBps:change,
  })
}
