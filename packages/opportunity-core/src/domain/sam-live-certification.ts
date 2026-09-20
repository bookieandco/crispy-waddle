export type SamLiveCertificationObservation = {
  checkedAt:string
  configured:boolean
  requestSucceeded:boolean
  resultCount:number
  canonicalizedCount:number
  uniqueOpportunityIds:number
  duplicateCount:number
  malformedCount:number
  paginationObserved:boolean
  error?:string
}

export type SamLiveCertificationReport = {
  status:'pass'|'fail'|'environment_blocked'
  observations:SamLiveCertificationObservation[]
  blockers:string[]
  bidSubmissionAuthorized:false
  outreachAuthorized:false
}

export function evaluateSamLiveCertification(observations:SamLiveCertificationObservation[]):SamLiveCertificationReport{
  const blockers:string[]=[]
  if(!observations.length)blockers.push('No live SAM observations were supplied.')
  for(const o of observations){
    if(!o.configured)blockers.push(`${o.checkedAt}: SAM_GOV_API_KEY is not configured in the tested environment.`)
    else if(!o.requestSucceeded)blockers.push(`${o.checkedAt}: live SAM request failed${o.error?`: ${o.error}`:''}.`)
    if(o.requestSucceeded&&o.canonicalizedCount+o.malformedCount<o.resultCount)blockers.push(`${o.checkedAt}: not every returned SAM row was accounted for.`)
    if(o.duplicateCount!==Math.max(0,o.canonicalizedCount-o.uniqueOpportunityIds))blockers.push(`${o.checkedAt}: duplicate accounting is inconsistent.`)
  }
  const environmentBlocked=observations.length>0&&observations.every(o=>!o.configured)
  return {status:environmentBlocked?'environment_blocked':blockers.length?'fail':'pass',observations,blockers,bidSubmissionAuthorized:false,outreachAuthorized:false}
}
