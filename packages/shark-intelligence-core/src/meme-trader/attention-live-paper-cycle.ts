/**
 * SHARK-ATTENTION.LIVE-PAPER.08 — one deterministic additive evaluation
 * of the canonical SHARK public market worker's sequential pair receipts.
 * The existing SHARK-LIVE SQLite worker owns scheduling, durability and
 * replay/outcome bookkeeping. This helper starts no second polling loop.
 */
import {deriveDexPriceMove} from './attention-public-dex'
import type {AttentionDexSnapshot} from './attention-public-dex'
import {assessPublicAttention} from './attention-research'
import type {AttentionConfiguration,AttentionResearchAlert} from './attention-research'

export type AttentionLivePaperCycle=Readonly<{
  schema:'SHARK_ATTENTION_LIVE_PAPER_CYCLE_V1'
  mint:string
  receiptId:string
  previousReceiptId:string|null
  evaluatedAt:string
  disposition:'FIRST_OBSERVATION_NO_SIGNAL'|'PRICE_COMPARISON_RESEARCH_ONLY'|'STALE_OR_INCOMPARABLE_NO_SIGNAL'
  alerts:readonly AttentionResearchAlert[]
  observedEventIds:readonly string[]
  source:'CANONICAL_SHARK_PUBLIC_MARKET_SNAPSHOT'
  orderCount:0
  signedTransactionCount:0
  authority:'RESEARCH_ONLY'
  canNotify:false
  canTrade:false
}>

export function evaluateAttentionLivePaperCycle(input:Readonly<{
  current:AttentionDexSnapshot
  previous?:AttentionDexSnapshot|null
  config:AttentionConfiguration
}>):AttentionLivePaperCycle{
  const current=input.current
  if(current.source!=='DEXSCREENER_PUBLIC_PAIR'||current.canTrade!==false||
    current.sourceAuthenticated!==false||!current.receiptId)
    throw new Error('ATTENTION_CYCLE_SOURCE_UNTRUSTED')
  let observations:ReturnType<typeof deriveDexPriceMove>[]=[]
  let disposition:AttentionLivePaperCycle['disposition']='FIRST_OBSERVATION_NO_SIGNAL'
  if(input.previous){
    if(input.previous.mint!==current.mint)
      throw new Error('ATTENTION_CYCLE_CROSS_MINT')
    if(input.previous.source!=='DEXSCREENER_PUBLIC_PAIR'||input.previous.canTrade!==false)
      throw new Error('ATTENTION_CYCLE_PREVIOUS_UNTRUSTED')
    try{
      const signal=deriveDexPriceMove(input.previous,current)
      if(signal)observations=[signal]
      disposition='PRICE_COMPARISON_RESEARCH_ONLY'
    }catch(error){
      // Never make stale / mixed-pair snapshots into positive trade signals.
      if(!(error instanceof Error)||![
        'ATTENTION_DEX_POOL_MISMATCH','ATTENTION_DEX_PREVIOUS_STALE',
        'ATTENTION_DEX_NON_COMPARABLE',
      ].includes(error.message))throw error
      disposition='STALE_OR_INCOMPARABLE_NO_SIGNAL'
    }
  }
  const report=assessPublicAttention({
    mint:current.mint,informationCutoff:current.observedAt,
    observations:observations.filter((x):x is NonNullable<typeof x>=>x!==null),
    config:input.config,
  })
  return Object.freeze({
    schema:'SHARK_ATTENTION_LIVE_PAPER_CYCLE_V1' as const,
    mint:current.mint,receiptId:current.receiptId,
    previousReceiptId:input.previous?.receiptId??null,
    evaluatedAt:current.observedAt,disposition,
    alerts:report.alerts,
    observedEventIds:report.evidenceIds,
    source:'CANONICAL_SHARK_PUBLIC_MARKET_SNAPSHOT' as const,
    orderCount:0 as const,signedTransactionCount:0 as const,
    authority:'RESEARCH_ONLY' as const,canNotify:false as const,canTrade:false as const,
  })
}
