/** SHARK-ALPHA.FABRIC.15 — frozen prospective comparisons.
 * Market price change is not an achievable entry/exit. No profit estimator.
 */
export type AlphaFrozenStrategy='SHARK_FUSED'|'CHAIN_ONLY'|'MOMENTUM_ONLY'
export type AlphaFrozenSelection=Readonly<{
 mint:string
 strategy:AlphaFrozenStrategy
 decision:'HIGHLIGHT'|'ABSTAIN'
 frozenAt:string
 evidenceAvailableAt:string
 receiptId:string
}>
export type AlphaFrozenOutcome=Readonly<{
 mint:string
 horizon:'24H_PRICE_ONLY'
 markedAt:string
 availableAt:string
 priceDirection:'UP'|'NOT_UP'|'CENSORED'
 samePoolVerified:boolean
 receiptId:string
}>
export type AlphaBaselineSummary=Readonly<{
 strategy:AlphaFrozenStrategy
 highlighted:number
 abstained:number
 resolvedHighlighted:number
 unresolvedHighlighted:number
 upwardPriceMarkRate?:number
}>
export type AlphaProspectiveBaselineReport=Readonly<{
 schema:'SHARK_ALPHA_BASELINES_V1'
 asOf:string
 cohortMintCount:number
 sameUniverse:true
 summaries:readonly AlphaBaselineSummary[]
 comparablePairedPriceMarks:number
 economicFeasibility:'NOT_EVALUATED'
 priceOnly:true
 realEntryFills:0
 realExitFills:0
 executablePnlVerified:false
 assumedFeesOrSlippageNotUsed:true
 noEdgeOrOutperformanceClaim:true
 canTrade:false
}>
const strategies:readonly AlphaFrozenStrategy[]=['SHARK_FUSED','CHAIN_ONLY','MOMENTUM_ONLY']
const iso=(s:string)=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT/.test(s)&&Number.isFinite(Date.parse(s))
const mintRx=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
export function compareFrozenAlphaBaselines(input:Readonly<{
 cohortMints:readonly string[]
 decisions:readonly AlphaFrozenSelection[]
 outcomes:readonly AlphaFrozenOutcome[]
 asOf:string
}>):AlphaProspectiveBaselineReport{
 const {cohortMints:mints,decisions,outcomes,asOf}=input
 if(!iso(asOf)||mints.length>2000||decisions.length>6000||outcomes.length>2000||
   new Set(mints).size!==mints.length||mints.some(m=>!mintRx.test(m)))
   throw new Error('alpha_baseline_cohort_invalid')
 const universe=new Set(mints)
 const cut=Date.parse(asOf)
 const seen=new Set<string>()
 const decisionsByStrategy=new Map<AlphaFrozenStrategy,Map<string,AlphaFrozenSelection>>()
 for(const strategy of strategies)decisionsByStrategy.set(strategy,new Map())
 for(const d of decisions){
   const key=d.strategy+':'+d.mint
   if(!strategies.includes(d.strategy)||!universe.has(d.mint)||!iso(d.frozenAt)||!iso(d.evidenceAvailableAt)||
      !d.receiptId.trim()||seen.has(key)||
      Date.parse(d.evidenceAvailableAt)>Date.parse(d.frozenAt)||
      Date.parse(d.frozenAt)>cut)
     throw new Error('alpha_baseline_decision_invalid')
   seen.add(key);decisionsByStrategy.get(d.strategy)!.set(d.mint,d)
 }
 // No cherry-picked denominator: each strategy must have a decision or abstention
 // for each candidate from the SAME prospectively frozen observed-launch cohort.
 for(const strategy of strategies){
   if(decisionsByStrategy.get(strategy)!.size!==mints.length)
     throw new Error('alpha_baseline_missing_frozen_decision')
 }
 const outcomesByMint=new Map<string,AlphaFrozenOutcome>()
 for(const o of outcomes){
   if(!universe.has(o.mint)||!iso(o.markedAt)||!iso(o.availableAt)||o.horizon!=='24H_PRICE_ONLY'||
     Date.parse(o.availableAt)<Date.parse(o.markedAt)||
     Date.parse(o.availableAt)>cut||!o.receiptId.trim()||outcomesByMint.has(o.mint))
     throw new Error('alpha_baseline_outcome_invalid')
   // Reject revisions to a decision made after the outcome was publicly available.
   for(const strategy of strategies)
     if(Date.parse(decisionsByStrategy.get(strategy)!.get(o.mint)!.frozenAt)>=Date.parse(o.markedAt))
       throw new Error('alpha_baseline_hindsight_decision')
   outcomesByMint.set(o.mint,o)
 }
 const resolved=(m:string)=>{
   const o=outcomesByMint.get(m)
   return o&&o.samePoolVerified&&o.priceDirection!=='CENSORED'?o:undefined
 }
 const summaries=strategies.map(strategy=>{
   const list=[...decisionsByStrategy.get(strategy)!.values()]
   const picks=list.filter(d=>d.decision==='HIGHLIGHT')
   const marks=picks.flatMap(d=>{const r=resolved(d.mint);return r?[r]:[]})
   return Object.freeze({
     strategy,highlighted:picks.length,abstained:list.length-picks.length,
     resolvedHighlighted:marks.length,unresolvedHighlighted:picks.length-marks.length,
     upwardPriceMarkRate:marks.length?marks.filter(r=>r.priceDirection==='UP').length/marks.length:undefined,
   })
 })
 const comparablePairedPriceMarks=mints.filter(m=>{
   if(!resolved(m))return false
   return strategies.every(s=>decisionsByStrategy.get(s)!.has(m))
 }).length
 return Object.freeze({
   schema:'SHARK_ALPHA_BASELINES_V1' as const,asOf,
   cohortMintCount:mints.length,sameUniverse:true as const,
   summaries:Object.freeze(summaries),comparablePairedPriceMarks,
   economicFeasibility:'NOT_EVALUATED' as const,priceOnly:true as const,
   realEntryFills:0 as const,realExitFills:0 as const,
   executablePnlVerified:false as const,assumedFeesOrSlippageNotUsed:true as const,
   noEdgeOrOutperformanceClaim:true as const,canTrade:false as const,
 })
}
