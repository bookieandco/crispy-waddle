/**
 * SHARK-ATTENTION.LIVE-PAPER.10 — prospective paired price-only study.
 * This is a *research counterfactual*, never a fill, executable ROI,
 * independently calibrated strategy or permission to trade.
 */
import {compareAttentionPaperPairs} from './attention-paper-evaluation'
import type {AttentionPaperPair,AttentionPaperComparison} from './attention-paper-evaluation'

export type PublicPaperDecision='PAPER_ENTER'|'NO_TRADE'
export type ProspectiveAttentionCase=Readonly<{
  caseId:string
  mint:string
  pairAddress:string
  decisionAt:string
  featureAvailableAt:string
  entryObservedAt:string
  entryPriceUsd:number
  entryReceiptId:string
  baselineDecision:PublicPaperDecision
  attentionDecision:PublicPaperDecision
  // Full assumed entry/exit slippage, venue and network/priority cost.
  assumedRoundTripCostBps:number
  // Unavailable or late marks MUST be censored, not backfilled as winners.
  mark:Readonly<{
    pairAddress:string
    observedAt:string
    availableAt:string
    priceUsd:number
    publicReceiptId:string
  }> | null
}>
export type ProspectiveAttentionReport=Readonly<{
  schema:'SHARK_ATTENTION_PROSPECTIVE_PAPER_V1'
  considered:number
  marked:number
  censored:number
  coverage:number|null
  perCase:readonly Readonly<{caseId:string;status:'PRICE_ONLY_MARKED'|'CENSORED_NO_ELIGIBLE_MARK';reason:string}>[]
  paired:AttentionPaperComparison
  evidence:'SAME_PAIR_PRICE_ONLY_ASSUMED_COSTS'
  independentlyValidated:false
  observedFillCount:0
  canTrade:false
}>

const key=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
function millis(x:string){
  if(typeof x!=='string'||!x.endsWith('Z')||!Number.isFinite(Date.parse(x)))
    throw new Error('ATTENTION_PROSPECTIVE_TIME_INVALID')
  return Date.parse(x)
}
const positive=(x:number)=>typeof x==='number'&&Number.isFinite(x)&&x>0
function netBps(choice:PublicPaperDecision,entry:number,mark:number,cost:number){
  if(choice==='NO_TRADE')return 0
  // Capped at -100% of notional; cannot represent leverage or actual fills.
  return Math.max(-10000,Math.round((mark/entry-1)*10000-cost))
}

export function gradeProspectiveAttentionPaper(rows:readonly ProspectiveAttentionCase[]):ProspectiveAttentionReport{
  if(!Array.isArray(rows)||rows.length>5000)
    throw new Error('ATTENTION_PROSPECTIVE_BATCH_INVALID')
  const seen=new Set<string>(),pairs:AttentionPaperPair[]=[]
  const perCase:Array<{caseId:string;status:'PRICE_ONLY_MARKED'|'CENSORED_NO_ELIGIBLE_MARK';reason:string}>=[]
  for(const row of rows){
    if(!row||typeof row!=='object'||typeof row.caseId!=='string'||!row.caseId||
      row.caseId.length>256||seen.has(row.caseId)||!key.test(row.mint)||
      !key.test(row.pairAddress)||!positive(row.entryPriceUsd)||
      typeof row.entryReceiptId!=='string'||!row.entryReceiptId||
      (row.baselineDecision!=='PAPER_ENTER'&&row.baselineDecision!=='NO_TRADE')||
      (row.attentionDecision!=='PAPER_ENTER'&&row.attentionDecision!=='NO_TRADE')||
      typeof row.assumedRoundTripCostBps!=='number'||
      !Number.isFinite(row.assumedRoundTripCostBps)||
      row.assumedRoundTripCostBps<0||row.assumedRoundTripCostBps>3000)
      throw new Error('ATTENTION_PROSPECTIVE_CASE_INVALID')
    seen.add(row.caseId)
    const available=millis(row.featureAvailableAt),decision=millis(row.decisionAt),
      entryObserved=millis(row.entryObservedAt)
    if(entryObserved>available||available>decision)
      throw new Error('ATTENTION_PROSPECTIVE_HINDSIGHT_INVALID')
    if(row.mark===null){
      perCase.push({caseId:row.caseId,status:'CENSORED_NO_ELIGIBLE_MARK',reason:'MISSING_MARK'})
      continue
    }
    const mark=row.mark
    if(!key.test(mark.pairAddress)||!positive(mark.priceUsd)||
      !mark.publicReceiptId||typeof mark.publicReceiptId!=='string')
      throw new Error('ATTENTION_PROSPECTIVE_MARK_INVALID')
    const observed=millis(mark.observedAt),reported=millis(mark.availableAt)
    if(reported<observed)throw new Error('ATTENTION_PROSPECTIVE_MARK_TIME_INVALID')
    const delta=observed-decision
    if(delta<24*3600_000||delta>30*3600_000||
      mark.pairAddress!==row.pairAddress){
      perCase.push({caseId:row.caseId,status:'CENSORED_NO_ELIGIBLE_MARK',reason:'OUTSIDE_SAME_PAIR_24_30H_WINDOW'})
      continue
    }
    pairs.push({
      caseId:row.caseId,subjectMint:row.mint,decisionAt:row.decisionAt,
      featureAvailableAt:row.featureAvailableAt,outcomeObservedAt:mark.observedAt,
      evidenceIds:[row.entryReceiptId,mark.publicReceiptId],
      baselineNetReturnBps:netBps(row.baselineDecision,row.entryPriceUsd,mark.priceUsd,row.assumedRoundTripCostBps),
      attentionNetReturnBps:netBps(row.attentionDecision,row.entryPriceUsd,mark.priceUsd,row.assumedRoundTripCostBps),
      netReturnBasis:'HYPOTHETICAL_PAPER_COST_ASSUMPTIONS',
    })
    perCase.push({caseId:row.caseId,status:'PRICE_ONLY_MARKED',reason:'UNVERIFIED_EXECUTION_COST_ASSUMPTIONS'})
  }
  const paired=compareAttentionPaperPairs(pairs)
  return Object.freeze({
    schema:'SHARK_ATTENTION_PROSPECTIVE_PAPER_V1' as const,
    considered:rows.length,marked:pairs.length,censored:rows.length-pairs.length,
    coverage:rows.length?pairs.length/rows.length:null,
    perCase:Object.freeze(perCase),paired,
    evidence:'SAME_PAIR_PRICE_ONLY_ASSUMED_COSTS' as const,
    independentlyValidated:false as const,observedFillCount:0 as const,canTrade:false as const,
  })
}
