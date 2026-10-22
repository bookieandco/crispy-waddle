import {assessSolanaSniperCostBudget,type SolanaLegCostEvidence,type SolanaSniperCostAssessment} from './solana-sniper-execution-cost.js'

export type SniperSubmissionLane='STANDARD_RPC'|'JITO_BUNDLE'
export type SniperLandingObservation=Readonly<{
  observationId:string
  lane:SniperSubmissionLane
  availableAt:string
  outcome:'LANDED'|'FAILED'|'UNKNOWN'
  source:'CHAIN_ATTESTED'|'PAPER_ASSUMPTION'
  landingDelayMs?:number
}>
export type SniperRouteStudyCandidate=Readonly<{
  lane:SniperSubmissionLane
  evidenceId:string
  observedAt:string
  entry:SolanaLegCostEvidence
  exit:SolanaLegCostEvidence
  quoteRelativeEdgeBps:number
  extraAdverseSlippageBps:number
}>
export type SniperRouteStudyResult=Readonly<{
  lane:SniperSubmissionLane
  cost:SolanaSniperCostAssessment
  landingCount:number
  failedCount:number
  unknownCount:number
  observedLandingSuccessBps:number
  medianObservedLandingMs?:number
  readyForPaperComparison:boolean
  reasonCodes:readonly string[]
}>
export type SniperLandingComparison=Readonly<{
  selectedForPaper?:SniperSubmissionLane
  rankings:readonly SniperRouteStudyResult[]
  authority:'ROUTE_RESEARCH_ONLY'
  canSubmit:false
  canChangeFeeCaps:false
  canExecute:false
}>
/**
 * LIVE-WIRING.03: risk- and fee-aware research comparison for normal RPC vs
 * Jito. It NEVER sends private bundles, bids tips, or configures live signers.
 * MEV risk can remain even when an RPC provider claims private submission.
 */
export function compareSniperLandingRoutes(input:{
  candidates:readonly SniperRouteStudyCandidate[]
  observations:readonly SniperLandingObservation[]
  cutoff:string
  maxQuoteAgeMs:number
  notionalLamports:bigint
  minimumNetEdgeBps:number
  maxFixedCostBps:number
  minLandingSamples:number
  minLandingSuccessBps?:number
}):SniperLandingComparison{
 const cutoff=Date.parse(input.cutoff)
 const minSuccess=input.minLandingSuccessBps??8000
 if(!Number.isFinite(cutoff)||!Number.isSafeInteger(input.maxQuoteAgeMs)||input.maxQuoteAgeMs<1||
    !Number.isSafeInteger(input.minLandingSamples)||input.minLandingSamples<1||
    !Number.isSafeInteger(minSuccess)||minSuccess<0||minSuccess>10000)throw new Error('SNIPER_LANDING_POLICY_INVALID')
 const seen=new Set<string>()
 const rankings:SniperRouteStudyResult[]=[]
 for(const candidate of input.candidates){
  if(seen.has(candidate.lane))throw new Error('SNIPER_LANDING_DUPLICATE_LANE')
  seen.add(candidate.lane)
  const observedAt=Date.parse(candidate.observedAt)
  if(!candidate.evidenceId.trim()||!Number.isFinite(observedAt))throw new Error('SNIPER_LANDING_CANDIDATE_EVIDENCE_INVALID')
  const codes:string[]=[]
  if(observedAt>cutoff||cutoff-observedAt>input.maxQuoteAgeMs)codes.push('LANDING_ROUTE_QUOTE_FUTURE_OR_STALE')
  const cost=assessSolanaSniperCostBudget({
    initialNotionalLamports:input.notionalLamports,
    quoteRelativeEdgeBps:candidate.quoteRelativeEdgeBps,
    adverseSlippageBudgetBps:candidate.extraAdverseSlippageBps,
    entry:candidate.entry,exit:candidate.exit,
    minimumNetEdgeBps:input.minimumNetEdgeBps,
    ownerMaxFixedCostBps:input.maxFixedCostBps,
  })
  if(cost.status!=='PASS_PAPER_COST')codes.push('LANDING_ROUTE_TOO_EXPENSIVE')
  const rows=input.observations.filter(o=>
    o.lane===candidate.lane&&o.source==='CHAIN_ATTESTED'&&Date.parse(o.availableAt)<=cutoff)
  const unique=new Map<string,SniperLandingObservation>()
  for(const row of rows){
    if(!row.observationId.trim()||!Number.isFinite(Date.parse(row.availableAt)))throw new Error('SNIPER_LANDING_SAMPLE_INVALID')
    if(row.landingDelayMs!==undefined&&(!Number.isFinite(row.landingDelayMs)||row.landingDelayMs<0))throw new Error('SNIPER_LANDING_DELAY_INVALID')
    if(!unique.has(row.observationId))unique.set(row.observationId,row)
  }
  const samples=[...unique.values()]
  const landed=samples.filter(s=>s.outcome==='LANDED')
  const failed=samples.filter(s=>s.outcome==='FAILED')
  const unknown=samples.filter(s=>s.outcome==='UNKNOWN')
  const timing=landed.map(x=>x.landingDelayMs).filter((n):n is number=>n!==undefined).sort((a,b)=>a-b)
  const median=timing.length?timing[Math.floor((timing.length-1)/2)]:undefined
  const terminalCount=landed.length+failed.length
  const successBps=terminalCount?Math.floor(landed.length*10000/terminalCount):0
  if(terminalCount<input.minLandingSamples)codes.push('LANDING_SAMPLE_INSUFFICIENT')
  if(successBps<minSuccess)codes.push('LANDING_SUCCESS_BELOW_MINIMUM')
  if(unknown.length)codes.push('LANDING_UNRESOLVED_OUTCOMES')
  rankings.push(Object.freeze({
    lane:candidate.lane,cost,landingCount:landed.length,failedCount:failed.length,unknownCount:unknown.length,
    observedLandingSuccessBps:successBps,
    medianObservedLandingMs:median,readyForPaperComparison:codes.length===0,reasonCodes:Object.freeze(codes),
  }))
 }
 const valid=rankings.filter(r=>r.readyForPaperComparison)
 valid.sort((a,b)=>
  b.cost.worstCaseNetEdgeBps*b.observedLandingSuccessBps-a.cost.worstCaseNetEdgeBps*a.observedLandingSuccessBps||
  (a.medianObservedLandingMs??Infinity)-(b.medianObservedLandingMs??Infinity))
 return Object.freeze({
  selectedForPaper:valid[0]?.lane,rankings:Object.freeze(rankings),
  authority:'ROUTE_RESEARCH_ONLY',canSubmit:false,canChangeFeeCaps:false,canExecute:false,
 })
}
