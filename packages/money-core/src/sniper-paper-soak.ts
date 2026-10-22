import {buildPaperPortfolio,simulatePaperFill} from './paper-execution-engine.js'
import type {PaperOrder,PaperFill,PaperFillModel} from './paper-execution-contracts.js'
import type {ExecutionMarketSnapshot} from './execution-planning-contracts.js'
import type {SniperSettlementEvidence} from './sniper-shadow-purse-handoff.js'

export const SNIPER_PAPER_SOAK_VERSION='SHARK-SNIPER.LIVE-WIRING.04' as const
export type SniperPaperTradeReceipt=Readonly<{
 version:typeof SNIPER_PAPER_SOAK_VERSION
 runId:string
 tokenAddress:string
 status:'NO_ENTRY_FILL'|'OPEN_NO_SELL_ROUTE'|'PARTIAL_EXIT'|'CLOSED'
 entryFill?:PaperFill
 exitFill?:PaperFill
 realizedNetPnlMinor?:bigint
 currency:string
 settlement?:SniperSettlementEvidence
 evidenceIds:readonly string[]
 authority:'PAPER_SIMULATION_ONLY'
 canExecute:false
 canCreditPurse:false
}>
export type SniperPaperLeg=Readonly<{
 order:PaperOrder
 market:ExecutionMarketSnapshot
 filledAt:string
 model:PaperFillModel
}>
/** LIVE-WIRING.04: consumes Money Core's canonical simulation engine, never a
 * parallel sniper fill engine. A missing/unverified reverse route is an OPEN
 * position, not a magically realized win. No signer, RPC broadcast or wallet.
 */
export function runSniperPaperRoundTrip(input:{
 tokenAddress:string
 entry:SniperPaperLeg
 exit?:SniperPaperLeg
 exitRouteAttested:boolean
 startingCashMinor:bigint
 markPriceMinor:bigint
 asOf:string
}):SniperPaperTradeReceipt{
 const {entry,exit}=input
 const runId=entry.order.paperRunId
 const currency=entry.order.requestedNotional.currency
 if(!input.tokenAddress.trim()||runId.trim()===''||input.startingCashMinor<=0n||input.markPriceMinor<=0n||
   !Number.isFinite(Date.parse(input.asOf))||entry.order.side!=='BUY'||entry.order.instrumentId!==entry.market.instrumentId||
   !entry.order.instrumentId.endsWith(':'+input.tokenAddress)||entry.filledAt>input.asOf){
  throw new Error('SNIPER_PAPER_IDENTITY_INVALID')
 }
 if(exit&&(exit.order.side!=='SELL'||exit.order.paperRunId!==runId||
  exit.order.instrumentId!==entry.order.instrumentId||exit.order.requestedNotional.currency!==currency||
  exit.filledAt>input.asOf||exit.filledAt<entry.filledAt)){
  throw new Error('SNIPER_PAPER_EXIT_BINDING_INVALID')
 }
 const first=simulatePaperFill({order:entry.order,market:entry.market,model:entry.model,filledAt:entry.filledAt})
 const receipt=(status:SniperPaperTradeReceipt['status'],evidenceIds:readonly string[],last?:PaperFill,realized?:bigint):SniperPaperTradeReceipt=>{
  const settlement:SniperSettlementEvidence|undefined=status==='CLOSED'&&realized!==undefined?Object.freeze({
   outcomeId:'sniper-paper:'+runId+':'+(last?.paperFillId??'none'),
   tokenAddress:input.tokenAddress,settledAt:exit!.filledAt,availableAt:input.asOf,
   realizedNetPnlLamports:realized,independentlyVerified:false,
   evidenceIds:Object.freeze([...evidenceIds]),kind:'PAPER',
  }):undefined
  return Object.freeze({
   version:SNIPER_PAPER_SOAK_VERSION,runId,tokenAddress:input.tokenAddress,status,
   entryFill:first,exitFill:last,realizedNetPnlMinor:realized,currency,settlement,
   evidenceIds:Object.freeze([...new Set(evidenceIds)].sort()),
   authority:'PAPER_SIMULATION_ONLY',canExecute:false,canCreditPurse:false,
  })
 }
 if(!first)return receipt('NO_ENTRY_FILL',entry.market.evidenceIds)
 const common=[...first.evidenceIds,...(exit?.market.evidenceIds??[])]
 let last:PaperFill|undefined
 if(exit&&input.exitRouteAttested){
  last=simulatePaperFill({order:exit.order,market:exit.market,model:exit.model,filledAt:exit.filledAt})
  if(last&&last.quantityMicros>first.quantityMicros){
   // Reject an unrealistic simulated sale of more units than were acquired.
   throw new Error('SNIPER_PAPER_EXIT_EXCEEDS_ACQUIRED_TOKENS')
  }
 }
 const fills=last?[first,last]:[first]
 const portfolio=buildPaperPortfolio({
  paperRunId:runId,currency,
  initialCash:{minor:input.startingCashMinor,currency},
  orders:last?[entry.order,exit!.order]:[entry.order],
  fills,marks:{[entry.order.instrumentId]:input.markPriceMinor},asOf:input.asOf,
 })
 const remaining=portfolio.positions.find(x=>x.instrumentId===entry.order.instrumentId)?.quantityMicros??0n
 if(!last)return receipt('OPEN_NO_SELL_ROUTE',common)
 if(remaining>0n)return receipt('PARTIAL_EXIT',[...common,...last.evidenceIds],last,portfolio.realizedPnl.minor)
 return receipt('CLOSED',[...common,...last.evidenceIds],last,portfolio.realizedPnl.minor)
}

/** Bounded deterministic forward paper ledger; callers can feed each event
 * immediately, while durable 24/7 deployment remains a separate acceptance.
 */
export class SniperPaperSoakLedger{
 private readonly receipts=new Map<string,SniperPaperTradeReceipt>()
 constructor(private readonly limit=1000){
  if(!Number.isSafeInteger(limit)||limit<1)throw new Error('SNIPER_PAPER_LEDGER_LIMIT_INVALID')
 }
 append(tradeId:string,receipt:SniperPaperTradeReceipt):'INSERTED'|'DUPLICATE'{
  if(!tradeId.trim()||receipt.authority!=='PAPER_SIMULATION_ONLY'||receipt.canExecute!==false){
   throw new Error('SNIPER_PAPER_LEDGER_AUTHORITY_INVALID')
  }
  const prior=this.receipts.get(tradeId)
  if(prior){
   if(JSON.stringify(prior,(_,v)=>typeof v==='bigint'?v.toString():v)!==
     JSON.stringify(receipt,(_,v)=>typeof v==='bigint'?v.toString():v)){
    throw new Error('SNIPER_PAPER_LEDGER_CONFLICT')
   }
   return 'DUPLICATE'
  }
  if(this.receipts.size>=this.limit)throw new Error('SNIPER_PAPER_LEDGER_CAPACITY_REACHED')
  this.receipts.set(tradeId,receipt)
  return 'INSERTED'
 }
 all():readonly SniperPaperTradeReceipt[]{return Object.freeze([...this.receipts.values()])}
}
