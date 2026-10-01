export type PublicOpportunityProductionMetrics={
  stateAndDcCount:number
  countyEquivalentCount:number
  jurisdictionCount:number
  sourceDiscoveryJobCount:number
  jurisdictionsWithVerifiedSource:number
  verifiedProcurementSourceCount:number
  activeReadOnlySourceCount:number
  healthySourceCount:number
  degradedSourceCount:number
  failedSourceCount:number
  inboxObservationCount:number
  awardCount:number
  primeProfileCount:number
  workPackageCount:number
  providerCandidateCount:number
  compliancePackCount:number
  verifiedCompliancePackCount:number
  pendingComplianceSourceJobCount:number
  complianceAssessmentCount:number
  blockedComplianceAssessmentCount:number
  authority:{
    externalContactAuthorized:boolean
    providerOutreachAuthorized:boolean
    bidSubmissionAuthorized:boolean
    contractExecutionAuthorized:boolean
    paymentAuthorized:boolean
  }
}

export type PublicOpportunityProductionCertification={
  runtimeIntegrity:'PASS'|'BLOCKED'
  liveReferenceIngestion:'PASS'|'BLOCKED'
  nationalCoverage:'PASS'|'PARTIAL'
  certification:
    |'BLOCKED'
    |'RUNTIME_CERTIFIED'
    |'LIVE_REFERENCE_CERTIFIED'
    |'NATIONAL_COVERAGE_CERTIFIED'
  blockers:string[]
  liveBlockers:string[]
  coverageDebt:string[]
  warnings:string[]
  metrics:PublicOpportunityProductionMetrics
  externalActionAuthorized:false
}

export function assessPublicOpportunityProductionFinal(
  metrics:PublicOpportunityProductionMetrics,
):PublicOpportunityProductionCertification{
  const blockers:string[]=[]
  const liveBlockers:string[]=[]
  const coverageDebt:string[]=[]
  const warnings:string[]=[]

  if(metrics.stateAndDcCount!==51)blockers.push(`State/DC jurisdiction coverage is ${metrics.stateAndDcCount}/51.`)
  if(metrics.countyEquivalentCount<3000)blockers.push(`County/county-equivalent catalog is unexpectedly small: ${metrics.countyEquivalentCount}.`)
  if(metrics.jurisdictionCount<metrics.stateAndDcCount+metrics.countyEquivalentCount)blockers.push('Jurisdiction total is inconsistent with state/county counts.')
  if(metrics.sourceDiscoveryJobCount<metrics.jurisdictionCount)blockers.push(`Source discovery jobs ${metrics.sourceDiscoveryJobCount} do not cover all ${metrics.jurisdictionCount} jurisdictions.`)
  if(metrics.compliancePackCount!==51)blockers.push(`Compliance pack manifest is ${metrics.compliancePackCount}/51.`)
  if(metrics.failedSourceCount>0)blockers.push(`${metrics.failedSourceCount} public source(s) are in failed state.`)

  const authority=metrics.authority
  if(authority.externalContactAuthorized||authority.providerOutreachAuthorized||authority.bidSubmissionAuthorized||authority.contractExecutionAuthorized||authority.paymentAuthorized){
    blockers.push('External action authority invariant is violated.')
  }

  if(metrics.verifiedProcurementSourceCount<1)liveBlockers.push('No officially verified procurement source is commissioned.')
  if(metrics.activeReadOnlySourceCount<1)liveBlockers.push('No source has an ACTIVE_READ_ONLY certified adapter.')
  if(metrics.inboxObservationCount<1)liveBlockers.push('No live public opportunity observation is persisted.')
  if(metrics.healthySourceCount<1)liveBlockers.push('No source currently reports healthy ingestion state.')

  const missingSourceCoverage=Math.max(0,metrics.jurisdictionCount-metrics.jurisdictionsWithVerifiedSource)
  if(missingSourceCoverage>0)coverageDebt.push(`${missingSourceCoverage} jurisdiction(s) lack a verified procurement source.`)
  const missingCompliance=Math.max(0,51-metrics.verifiedCompliancePackCount)
  if(missingCompliance>0)coverageDebt.push(`${missingCompliance} state/DC compliance pack(s) are not yet verified-reference.`)
  if(metrics.pendingComplianceSourceJobCount>0)coverageDebt.push(`${metrics.pendingComplianceSourceJobCount} compliance source-discovery job(s) remain unresolved.`)
  if(metrics.degradedSourceCount>0)warnings.push(`${metrics.degradedSourceCount} public source(s) are degraded.`)
  if(metrics.blockedComplianceAssessmentCount>0)warnings.push(`${metrics.blockedComplianceAssessmentCount} work-package compliance assessment(s) are blocked.`)
  if(metrics.awardCount===0)warnings.push('No awarded-prime observations have been mined yet.')
  if(metrics.workPackageCount===0)warnings.push('No subcontract work packages have been compiled yet.')

  const runtimeStatus:'PASS'|'BLOCKED'=blockers.length?'BLOCKED':'PASS'
  const liveStatus:'PASS'|'BLOCKED'=runtimeStatus==='PASS'&&!liveBlockers.length?'PASS':'BLOCKED'
  const nationalStatus:'PASS'|'PARTIAL'=liveStatus==='PASS'&&!coverageDebt.length?'PASS':'PARTIAL'

  let certification:PublicOpportunityProductionCertification['certification']='BLOCKED'
  if(runtimeStatus==='PASS')certification='RUNTIME_CERTIFIED'
  if(liveStatus==='PASS')certification='LIVE_REFERENCE_CERTIFIED'
  if(liveStatus==='PASS'&&nationalStatus==='PASS')certification='NATIONAL_COVERAGE_CERTIFIED'

  return {
    runtimeIntegrity:runtimeStatus,
    liveReferenceIngestion:liveStatus,
    nationalCoverage:nationalStatus,
    certification,
    blockers,
    liveBlockers,
    coverageDebt,
    warnings,
    metrics,
    externalActionAuthorized:false,
  }
}
