/**
 * Point-in-time Solana round-trip fee budget for SHARK paper/shadow decisions.
 * Quote-relative edge already includes price impact and venue fees. NEVER add
 * those a second time. Slippage tolerance is a WORST-CASE bound, not realized
 * slippage. No signer, transaction submission, or wallet authority.
 */
export type SolanaLegCostEvidence=Readonly<{
  signatureBaseFeeLamports:bigint
  computeUnitLimit:number
  microLamportsPerComputeUnit:bigint
  jitoTipLamports:bigint
  nonRecoverableRentLamports:bigint
  evidenceId:string
}>
export type SolanaSniperCostBudget=Readonly<{
  initialNotionalLamports:bigint
  /** Expected round-trip edge from actual entry and reverse-route quotes,
   * already net of quoted venue fees and quoted price impact. */
  quoteRelativeEdgeBps:number
  /** Extra adverse drift budget not already reflected in the quotes. */
  adverseSlippageBudgetBps:number
  entry:SolanaLegCostEvidence
  exit:SolanaLegCostEvidence
  minimumNetEdgeBps:number
  ownerMaxFixedCostBps:number
}>
export type SolanaSniperCostAssessment=Readonly<{
  status:'PASS_PAPER_COST'|'REJECT_COST'
  reasonCodes:readonly string[]
  entryFixedLamports:bigint
  exitFixedLamports:bigint
  roundTripFixedLamports:bigint
  roundTripFixedCostBps:number
  worstCaseNetEdgeBps:number
  evidenceIds:readonly string[]
  authority:'MONEY_PAPER_COST_ONLY'
  canSign:false
  canBroadcast:false
  canAuthorizeTrade:false
}>
const bps=(value:number,code:string)=>{
  if(!Number.isSafeInteger(value)||value<0||value>10000)throw new Error(code)
}
const uint=(value:bigint,code:string)=>{
  if(value<0n)throw new Error(code)
}
function legCost(l:SolanaLegCostEvidence):bigint{
  if(!l.evidenceId.trim())throw new Error('SOLANA_COST_EVIDENCE_REQUIRED')
  if(!Number.isSafeInteger(l.computeUnitLimit)||l.computeUnitLimit<1||l.computeUnitLimit>1_400_000){
    throw new Error('SOLANA_COST_CU_LIMIT_INVALID')
  }
  uint(l.signatureBaseFeeLamports,'SOLANA_COST_BASE_FEE_INVALID')
  uint(l.microLamportsPerComputeUnit,'SOLANA_COST_CU_PRICE_INVALID')
  uint(l.jitoTipLamports,'SOLANA_COST_TIP_INVALID')
  uint(l.nonRecoverableRentLamports,'SOLANA_COST_RENT_INVALID')
  const priority=(BigInt(l.computeUnitLimit)*l.microLamportsPerComputeUnit+999_999n)/1_000_000n
  return l.signatureBaseFeeLamports+priority+l.jitoTipLamports+l.nonRecoverableRentLamports
}
/** Conservative fixed-cost rounding; use observed fee bids, not magic constants. */
export function assessSolanaSniperCostBudget(input:SolanaSniperCostBudget):SolanaSniperCostAssessment{
  if(input.initialNotionalLamports<=0n)throw new Error('SOLANA_COST_NOTIONAL_REQUIRED')
  bps(input.adverseSlippageBudgetBps,'SOLANA_COST_SLIPPAGE_INVALID')
  bps(input.minimumNetEdgeBps,'SOLANA_COST_MIN_EDGE_INVALID')
  bps(input.ownerMaxFixedCostBps,'SOLANA_COST_FIXED_CAP_INVALID')
  if(!Number.isSafeInteger(input.quoteRelativeEdgeBps)||Math.abs(input.quoteRelativeEdgeBps)>1_000_000){
    throw new Error('SOLANA_COST_QUOTED_EDGE_INVALID')
  }
  const entryFixedLamports=legCost(input.entry)
  const exitFixedLamports=legCost(input.exit)
  const roundTripFixedLamports=entryFixedLamports+exitFixedLamports
  const fixedCost=Number((roundTripFixedLamports*10000n+input.initialNotionalLamports-1n)/input.initialNotionalLamports)
  const worstCaseNetEdgeBps=input.quoteRelativeEdgeBps-fixedCost-input.adverseSlippageBudgetBps
  const reasonCodes:string[]=[]
  if(fixedCost>input.ownerMaxFixedCostBps)reasonCodes.push('SOLANA_COST_OWNER_FIXED_FEE_CAP')
  if(worstCaseNetEdgeBps<input.minimumNetEdgeBps)reasonCodes.push('SOLANA_COST_INSUFFICIENT_NET_EDGE')
  return Object.freeze({
    status:reasonCodes.length?'REJECT_COST':'PASS_PAPER_COST',
    reasonCodes:Object.freeze(reasonCodes),entryFixedLamports,exitFixedLamports,
    roundTripFixedLamports,roundTripFixedCostBps:fixedCost,worstCaseNetEdgeBps,
    evidenceIds:Object.freeze([...new Set([input.entry.evidenceId,input.exit.evidenceId])].sort()),
    authority:'MONEY_PAPER_COST_ONLY',canSign:false,canBroadcast:false,canAuthorizeTrade:false,
  })
}
