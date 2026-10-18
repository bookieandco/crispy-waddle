/** SHARK-ALPHA.FABRIC.14 — a denominator of *observed* launches.
 * Incomplete chain coverage is never converted into a claim about all launches.
 * Later descriptive 24h price marks are not proof of a tradable winner.
 */
export type AlphaCohortLaunch=Readonly<{
 mint:string
 launchEventId:string
 sourceAvailableAt:string
 cohortAdmittedAt:string
 eligibility:'PROSPECTIVE_PUMP_CREATE_RESEARCH'|'RETROSPECTIVE_OR_UNVERIFIED'
 evidenceIds:readonly string[]
}>
export type AlphaCohortSelection=Readonly<{
 mint:string
 strategy:'SHARK_FUSED'|'CHAIN_ONLY'|'MOMENTUM_ONLY'
 decidedAt:string
 decision:'HIGHLIGHT'|'ABSTAIN'
 evidenceIds:readonly string[]
}>
export type AlphaCohortOutcome=Readonly<{
 mint:string
 observedAt:string
 availableAt:string
 hoursAfterLaunch:number
 mark:'PRICE_ONLY_UP_2X'|'PRICE_ONLY_NOT_UP_2X'|'CENSORED_MISSING_OR_PAIR_SWITCH'
 evidenceIds:readonly string[]
}>
export type AlphaCohortRow=Readonly<{
 mint:string
 status:'ELIGIBLE'|'RETROSPECTIVE_EXCLUDED'|'CENSORED_NO_OUTCOME'|'CENSORED'
 markedUp2x?:boolean
 sharkHighlighted:boolean
 missedMarkedUp2x:boolean
 evidenceIds:readonly string[]
}>
export type AlphaCohortReport=Readonly<{
 schema:'SHARK_ALPHA_MISSED_WINNERS_V1'
 asOf:string
 observedLaunches:number
 eligibleProspectiveLaunches:number
 selectedByShark:number
 markedOutcomeCoverage:number
 markedUp2xCount:number
 highlightedMarkedUp2xCount:number
 missedMarkedUp2xCount:number
 missingOrCensored:number
 retrospectiveExcluded:number
 estimatedAllPumpLaunches:undefined
 missedWinnerRate?:number
 rows:readonly AlphaCohortRow[]
 outcomeType:'PRICE_ONLY_NOT_EXECUTABLE'
 allLaunchCoverage:'UNKNOWN_INCOMPLETE'
 canTrade:false
}>
const timestamp=(s:string)=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT/.test(s)&&Number.isFinite(Date.parse(s))
const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
export function auditAlphaMissedWinners(input:Readonly<{
 launches:readonly AlphaCohortLaunch[]
 selections:readonly AlphaCohortSelection[]
 outcomes:readonly AlphaCohortOutcome[]
 asOf:string
}>):AlphaCohortReport{
 const {launches,selections,outcomes,asOf}=input
 if(!timestamp(asOf)||launches.length>2000||selections.length>6000||outcomes.length>6000)
   throw new Error('alpha_cohort_input_invalid')
 const end=Date.parse(asOf)
 const unique=new Set<string>()
 const marks=new Map<string,AlphaCohortOutcome>()
 const highlighted=new Set<string>()
 const admission=new Map<string,AlphaCohortLaunch>()
 for(const l of launches){
   if(!MINT.test(l.mint)||!l.launchEventId.trim()||!timestamp(l.sourceAvailableAt)||!timestamp(l.cohortAdmittedAt)||
     Date.parse(l.sourceAvailableAt)>Date.parse(l.cohortAdmittedAt)||
     Date.parse(l.cohortAdmittedAt)>end||!l.evidenceIds.length||unique.has(l.mint))
     throw new Error('alpha_cohort_launch_invalid')
   unique.add(l.mint);admission.set(l.mint,l)
 }
 for(const s of selections){
   const launch=admission.get(s.mint)
   if(!launch||!timestamp(s.decidedAt)||Date.parse(s.decidedAt)<Date.parse(launch.cohortAdmittedAt)||
     Date.parse(s.decidedAt)>end||!s.evidenceIds.length)throw new Error('alpha_cohort_selection_clock_invalid')
   if(s.strategy==='SHARK_FUSED'&&s.decision==='HIGHLIGHT')highlighted.add(s.mint)
 }
 for(const o of outcomes){
   const launch=admission.get(o.mint)
   if(!launch||!timestamp(o.observedAt)||!timestamp(o.availableAt)||
     Date.parse(o.availableAt)<Date.parse(o.observedAt)||
     Date.parse(o.observedAt)<Date.parse(launch.cohortAdmittedAt)||
     Date.parse(o.availableAt)>end||!Number.isFinite(o.hoursAfterLaunch)||
     o.hoursAfterLaunch<24||o.hoursAfterLaunch>30||!o.evidenceIds.length||marks.has(o.mint))
     throw new Error('alpha_cohort_outcome_invalid')
   marks.set(o.mint,o)
 }
 const rows=launches.map(l=>{
   const eligible=l.eligibility==='PROSPECTIVE_PUMP_CREATE_RESEARCH'
   const outcome=marks.get(l.mint)
   const markedUp2x=eligible&&outcome&&outcome.mark!=='CENSORED_MISSING_OR_PAIR_SWITCH'?
     outcome.mark==='PRICE_ONLY_UP_2X':undefined
   const status=!eligible?'RETROSPECTIVE_EXCLUDED' as const:
     !outcome?'CENSORED_NO_OUTCOME' as const:
     markedUp2x===undefined?'CENSORED' as const:'ELIGIBLE' as const
   return Object.freeze({
     mint:l.mint,status,markedUp2x,
     sharkHighlighted:highlighted.has(l.mint),
     missedMarkedUp2x:markedUp2x===true&&!highlighted.has(l.mint),
     evidenceIds:Object.freeze([...new Set([...l.evidenceIds,...(outcome?.evidenceIds??[])])].sort()),
   })
 })
 const eligible=rows.filter(r=>r.status!=='RETROSPECTIVE_EXCLUDED')
 const observed=rows.filter(r=>r.markedUp2x!==undefined)
 const winners=observed.filter(r=>r.markedUp2x===true)
 const missed=winners.filter(r=>r.missedMarkedUp2x)
 return Object.freeze({
  schema:'SHARK_ALPHA_MISSED_WINNERS_V1' as const,asOf,
  observedLaunches:rows.length,eligibleProspectiveLaunches:eligible.length,
  selectedByShark:eligible.filter(r=>r.sharkHighlighted).length,
  markedOutcomeCoverage:observed.length,markedUp2xCount:winners.length,
  highlightedMarkedUp2xCount:winners.length-missed.length,
  missedMarkedUp2xCount:missed.length,
  missingOrCensored:eligible.length-observed.length,
  retrospectiveExcluded:rows.length-eligible.length,
  estimatedAllPumpLaunches:undefined,
  missedWinnerRate:winners.length?missed.length/winners.length:undefined,
  rows:Object.freeze(rows),outcomeType:'PRICE_ONLY_NOT_EXECUTABLE' as const,
  allLaunchCoverage:'UNKNOWN_INCOMPLETE' as const,canTrade:false as const,
 })
}
