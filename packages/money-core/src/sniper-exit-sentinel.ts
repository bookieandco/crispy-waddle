export const SNIPER_EXIT_SENTINEL_VERSION='SHARK-SNIPER.FASTPATH.07' as const
export type SniperPositionState=Readonly<{
 positionId:string
 tokenAddress:string
 entryConfirmedAt?:string
 openTokenAmountAtomic:bigint
 peakReturnBps:number
 markedReturnBps:number
 availableAt:string
 evidenceIds:readonly string[]
}>
export type SniperExitQuote=Readonly<{
 quoteId:string
 tokenAddress:string
 sellAmountAtomic:bigint
 quotedAt:string
 expiresAt:string
 minimumProceedsLamports:bigint
 evidenceIds:readonly string[]
 verifiedSellPath:boolean
}>
export type SniperExitDecision=Readonly<{
 version:typeof SNIPER_EXIT_SENTINEL_VERSION
 positionId:string
 action:'NO_POSITION'|'HOLD_PAPER'|'EXIT_PAPER_CANDIDATE'|'EXIT_ROUTE_MISSING'|'UNRESOLVED_PREVIOUS_ATTEMPT'
 reasonCodes:readonly string[]
 latestRoute?:string
 authority:'EXIT_RESEARCH_ONLY'
 canSign:false
 canBroadcast:false
 canExecute:false
}>
export type SniperExitPolicy=Readonly<{
 maxHoldSeconds:number
 profitTakeBps:number
 trailingGivebackBps:number
 maxDrawdownBps:number
 maxQuoteAgeMs:number
}>
/** Exit research does not imply a guaranteed realizable sale.
 * An unknown prior attempt must be reconciled before building another.
 */
export function evaluateSniperExit(input:{
 position:SniperPositionState
 quote?:SniperExitQuote
 policy:SniperExitPolicy
 now:string
 rugAction?:'ALLOW_PAPER_STUDY'|'CAUTION'|'BLOCK_NEW_ENTRY'|'EXIT_RECOMMENDED'|'QUARANTINE'
 unresolvedPreviousExit?:boolean
}):SniperExitDecision{
 const {position:p,policy}=input
 const now=Date.parse(input.now),available=Date.parse(p.availableAt)
 if(!p.positionId.trim()||!p.tokenAddress.trim()||!p.evidenceIds.length||!Number.isFinite(now)||!Number.isFinite(available)||
  available>now||p.openTokenAmountAtomic<0n||!Number.isSafeInteger(p.peakReturnBps)||
  !Number.isSafeInteger(p.markedReturnBps)||!Number.isSafeInteger(policy.maxHoldSeconds)||policy.maxHoldSeconds<1||
  !Number.isSafeInteger(policy.maxQuoteAgeMs)||policy.maxQuoteAgeMs<1||
  [policy.profitTakeBps,policy.trailingGivebackBps,policy.maxDrawdownBps].some(v=>!Number.isSafeInteger(v)||v<0)){
  throw new Error('SNIPER_EXIT_INPUT_INVALID')
 }
 const result=(action:SniperExitDecision['action'],reasons:string[],latestRoute?:string):SniperExitDecision=>Object.freeze({
  version:SNIPER_EXIT_SENTINEL_VERSION,positionId:p.positionId,action,reasonCodes:Object.freeze(reasons),
  latestRoute,authority:'EXIT_RESEARCH_ONLY',canSign:false,canBroadcast:false,canExecute:false,
 })
 if(p.openTokenAmountAtomic===0n)return result('NO_POSITION',['NO_OPEN_INVENTORY'])
 if(!p.entryConfirmedAt||!Number.isFinite(Date.parse(p.entryConfirmedAt))||Date.parse(p.entryConfirmedAt)>now){
  throw new Error('SNIPER_EXIT_UNCONFIRMED_POSITION')
 }
 if(input.unresolvedPreviousExit)return result('UNRESOLVED_PREVIOUS_ATTEMPT',['EXIT_SETTLEMENT_RECONCILIATION_REQUIRED'])
 const reasons:string[]=[]
 if((now-Date.parse(p.entryConfirmedAt))/1000>=policy.maxHoldSeconds)reasons.push('MAX_HOLD_EXPIRED')
 if(p.markedReturnBps>=policy.profitTakeBps)reasons.push('PROFIT_TARGET')
 if(p.peakReturnBps-p.markedReturnBps>=policy.trailingGivebackBps)reasons.push('TRAILING_GIVEBACK')
 if(p.markedReturnBps<=-policy.maxDrawdownBps)reasons.push('DRAWDOWN_LIMIT')
 if(input.rugAction==='EXIT_RECOMMENDED'||input.rugAction==='QUARANTINE')reasons.push('RUG_SENTINEL_EXIT_SIGNAL')
 if(!reasons.length)return result('HOLD_PAPER',[])
 const q=input.quote
 if(!q||q.tokenAddress!==p.tokenAddress||q.sellAmountAtomic!==p.openTokenAmountAtomic||
  !q.verifiedSellPath||q.minimumProceedsLamports<=0n||!q.evidenceIds.length||
  !Number.isFinite(Date.parse(q.quotedAt))||!Number.isFinite(Date.parse(q.expiresAt))||
  Date.parse(q.quotedAt)>now||now-Date.parse(q.quotedAt)>policy.maxQuoteAgeMs||
  Date.parse(q.expiresAt)<=now){
  return result('EXIT_ROUTE_MISSING',[...reasons,'NO_VERIFIED_FRESH_FULL_POSITION_EXIT'])
 }
 return result('EXIT_PAPER_CANDIDATE',reasons,q.quoteId)
}
