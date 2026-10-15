import {createHash} from 'node:crypto'
export type PaperVenue='STOCKS'|'MEMECOINS'|'KALSHI'|'SPORTS'
export type FrozenPaperCase=Readonly<{
 id:string;venue:PaperVenue;ownerUserId:string;frozenAt:string;resolvedAt:string|null;
 predictionProbabilityBps:number;actualOutcome:0|1|null;
 grossPaperPnlMinor:bigint;transactionCostMinor:bigint;
 predictionReceiptId:string;settlementReceiptId:string|null;
 source:'PAPER_ONLY'
}>
export function gradeCapitalPaperPortfolio(input:Readonly<{
 ownerUserId:string;asOf:string;cases:readonly FrozenPaperCase[];unresolvedFeedGaps:number
}>){
 if(!input.ownerUserId||!Number.isFinite(Date.parse(input.asOf))||
  !Array.isArray(input.cases)||input.cases.length>10000||
  !Number.isSafeInteger(input.unresolvedFeedGaps)||input.unresolvedFeedGaps<0)
  throw Error('BIZ_PURSE_21_INPUT_INVALID')
 const reasons:string[]=[],cases=new Set<string>(),receipts=new Set<string>()
 const venues=new Map<PaperVenue,{n:number,brier:number,pnl:bigint}>()
 for(const c of input.cases){
  if(!c||c.ownerUserId!==input.ownerUserId||c.source!=='PAPER_ONLY'||
    !['STOCKS','MEMECOINS','KALSHI','SPORTS'].includes(c.venue)||
    !c.id||!c.predictionReceiptId||cases.has(c.id)||receipts.has(c.predictionReceiptId)||
    !Number.isInteger(c.predictionProbabilityBps)||c.predictionProbabilityBps<0||c.predictionProbabilityBps>10000||
    typeof c.grossPaperPnlMinor!=='bigint'||typeof c.transactionCostMinor!=='bigint'||c.transactionCostMinor<0n||
    !Number.isFinite(Date.parse(c.frozenAt))||Date.parse(c.frozenAt)>Date.parse(input.asOf))
   throw Error('BIZ_PURSE_21_PAPER_CASE_INVALID_OR_DUPLICATE')
  cases.add(c.id);receipts.add(c.predictionReceiptId)
  if(c.resolvedAt===null||c.actualOutcome===null||c.settlementReceiptId===null){
   reasons.push('UNRESOLVED_PAPER_OUTCOME');continue
  }
  if(![0,1].includes(c.actualOutcome)||!c.settlementReceiptId||receipts.has(c.settlementReceiptId)||
    !Number.isFinite(Date.parse(c.resolvedAt))||Date.parse(c.resolvedAt)<Date.parse(c.frozenAt)||
    Date.parse(c.resolvedAt)>Date.parse(input.asOf))
   throw Error('BIZ_PURSE_21_SETTLEMENT_PROVENANCE_INVALID')
  receipts.add(c.settlementReceiptId)
  const scored=venues.get(c.venue)??{n:0,brier:0,pnl:0n}
  scored.n++;scored.brier+=Math.pow(c.predictionProbabilityBps/10000-c.actualOutcome,2)
  scored.pnl=scored.pnl+(BigInt(c.grossPaperPnlMinor)-BigInt(c.transactionCostMinor))
  venues.set(c.venue,scored)
 }
 if(input.unresolvedFeedGaps)reasons.push('MARKET_FEED_GAPS_UNRESOLVED')
 if(!input.cases.length)reasons.push('NO_FROZEN_CASES')
 const summary=[...venues.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([venue,v])=>
  Object.freeze({venue,gradedCount:v.n,meanBrierScore:Math.round(v.brier/v.n*1000000)/1000000,
   netPaperPnlMinor:v.pnl.toString()}))
 return Object.freeze({status:reasons.length?'BLOCKED' as const:'PAPER_RESEARCH_REVIEW_READY' as const,
  ownerUserId:input.ownerUserId,gradedCaseCount:summary.reduce((a,x)=>a+x.gradedCount,0),
  totalCaseCount:cases.size,venues:Object.freeze(summary),reasons:Object.freeze([...new Set(reasons)]),
  reviewHash:createHash('sha256').update(JSON.stringify({owner:input.ownerUserId,asOf:input.asOf,
   cases:input.cases},(_,v)=>typeof v==='bigint'?v.toString():v)).digest('hex'),
  authority:'PAPER_RESEARCH_ONLY' as const,canTrade:false as const,canBet:false as const,
  canMoveMoney:false as const,canPromoteCashProfit:false as const})
}
