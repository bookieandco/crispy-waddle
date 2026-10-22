import {US_STATE_AND_DC_CODES,type UsStateOrDcCode,type PublicJurisdictionLevel} from './public-opportunity-grid.js'

export type NationalCoverageRow={
 state_code:UsStateOrDcCode
 level:PublicJurisdictionLevel
 jurisdictions:number
 source_bearing:number
 verified_source_jurisdictions:number
 certified_read_only_jurisdictions:number
 total_source_records:number
 blocked_jobs:number
 no_provider_jobs:number
 recovery_ready_jobs:number
}
export type NationalCoverageState={
 state:UsStateOrDcCode
 jurisdictions:number
 sourceBearing:number
 verifiedSourceJurisdictions:number
 certifiedReadOnlyJurisdictions:number
 totalSourceRecords:number
 blockedJobs:number
 noProviderJobs:number
 recoveryReadyJobs:number
 byLevel:NationalCoverageRow[]
}
export type NationalCoverageReport={
 scope:'us_50_states_plus_dc'
 registryJurisdictions:number
 stateCount:51
 representedStates:number
 sourceBearingJurisdictions:number
 officiallyVerifiedJurisdictions:number
 certifiedReadOnlyJurisdictions:number
 blockedDiscoveryJobs:number
 noProviderJobs:number
 sources:number
 states:NationalCoverageState[]
 missingJurisdictionFamilies:readonly ['tribal','territories','township_and_dependent_local_systems','federal_agencies']
 externalContactAuthorized:false
 biddingAuthorized:false
 spendingAuthorized:false
 coverageComplete:false
}

export function summarizeNationalProcurementCoverage(rows:NationalCoverageRow[]):NationalCoverageReport{
 const states=US_STATE_AND_DC_CODES.map(state=>{
  const byLevel=rows.filter(row=>row.state_code===state)
  const sum=(key:keyof Pick<NationalCoverageRow,'jurisdictions'|'source_bearing'|'verified_source_jurisdictions'|'certified_read_only_jurisdictions'|'total_source_records'|'blocked_jobs'|'no_provider_jobs'|'recovery_ready_jobs'>)=>
   byLevel.reduce((total,row)=>total+Number(row[key]??0),0)
  return {state,jurisdictions:sum('jurisdictions'),sourceBearing:sum('source_bearing'),
   verifiedSourceJurisdictions:sum('verified_source_jurisdictions'),
   certifiedReadOnlyJurisdictions:sum('certified_read_only_jurisdictions'),
   totalSourceRecords:sum('total_source_records'),blockedJobs:sum('blocked_jobs'),
   noProviderJobs:sum('no_provider_jobs'),recoveryReadyJobs:sum('recovery_ready_jobs'),
   byLevel}
 })
 const total=(k:keyof Omit<NationalCoverageState,'state'|'byLevel'>)=>
  states.reduce((sum,row)=>sum+row[k],0)
 return {
  scope:'us_50_states_plus_dc',registryJurisdictions:total('jurisdictions'),
  stateCount:51,representedStates:states.filter(row=>row.jurisdictions>0).length,
  sourceBearingJurisdictions:total('sourceBearing'),officiallyVerifiedJurisdictions:total('verifiedSourceJurisdictions'),
  certifiedReadOnlyJurisdictions:total('certifiedReadOnlyJurisdictions'),
  blockedDiscoveryJobs:total('blockedJobs'),noProviderJobs:total('noProviderJobs'),
  sources:total('totalSourceRecords'),states,
  missingJurisdictionFamilies:['tribal','territories','township_and_dependent_local_systems','federal_agencies'],
  externalContactAuthorized:false,biddingAuthorized:false,spendingAuthorized:false,coverageComplete:false,
 }
}

export type NationwideRecoveryCandidate={
 jobId:string;jurisdictionId:string;state:UsStateOrDcCode;level:PublicJurisdictionLevel
 status:'blocked'|'pending'|'discovered'|'deferred'|'adapter_required'
 lastError:string|null;sourceReferences:string[]
 officialDomains:string[];attemptCount:number
}
export type NationwideRecoveryDecision={
 jobId:string;jurisdictionId:string;state:UsStateOrDcCode
 action:'requeue_official_only'|'manual_review'|'preserve_existing'
 reason:string;searchQueryAuthorized:false;externalContactAuthorized:false
}
export function planNationwideDiscoveryRecovery(
 candidates:NationwideRecoveryCandidate[],limit=20,
):NationwideRecoveryDecision[]{
 if(!Number.isInteger(limit)||limit<1||limit>20)throw Error('National recovery must be bounded to 1–20 exact jobs.')
 const seen=new Set<string>()
 return candidates.slice(0,limit).map(row=>{
  if(seen.has(row.jobId))throw Error('Duplicate national discovery job IDs.')
  seen.add(row.jobId)
  let action:NationwideRecoveryDecision['action']='manual_review'
  let reason='No independently corroborated official domain; do not retry or scrape.'
  if(row.status!=='blocked'){
   action='preserve_existing'
   reason='An existing nonblocked discovery job is not eligible for reset.'
  }else if(row.sourceReferences.length>0){
   reason='Previously sourced job; reconcile current verified sources before any reset.'
  }else if(row.lastError==='PUBLIC_SOURCE_NO_OFFICIAL_DOMAIN_AND_SEARCH_NOT_CONFIGURED'&&
    row.officialDomains.length>0&&row.officialDomains.every(domain=>/^[a-z0-9.-]+$/i.test(domain))){
   action='requeue_official_only'
   reason='New independently matched official government domain; bounded official-only discovery is permitted.'
  }else if(row.lastError?.includes('RETRY_EXHAUSTED')||row.lastError?.includes('RETRY_BUDGET_EXHAUSTED')){
   reason='Retry budget exhausted; manual inspection and provider remediation required.'
  }
  return {jobId:row.jobId,jurisdictionId:row.jurisdictionId,state:row.state,action,reason,
   searchQueryAuthorized:false,externalContactAuthorized:false}
 })
}
