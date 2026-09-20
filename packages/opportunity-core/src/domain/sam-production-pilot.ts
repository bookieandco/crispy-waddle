import type { SamLiveCertificationReport } from './sam-live-certification.js'
import type { SamProviderResearchResult } from './sam-provider-research.js'

export type SamPilotCase={
  id:string
  opportunityId:string
  liveCertification:SamLiveCertificationReport['status']
  researchStatus:SamProviderResearchResult['researchStatus']
  candidateCount:number
  identityBlockedCount:number
  freshnessBlockedCount:number
  falsePositiveCount:number
  humanOverrideCount:number
  unauthorizedActionCount:number
  persistenceRecovered:boolean
}

export type SamPilotReport={
  status:'pass'|'fail'|'environment_blocked'
  caseCount:number
  metrics:{candidateCount:number;identityBlockedCount:number;freshnessBlockedCount:number;falsePositiveCount:number;humanOverrideCount:number}
  blockers:string[]
  bidSubmissionAuthorized:false
  automaticOutreachAuthorized:false
}

export function evaluateSamProductionPilot(cases:SamPilotCase[]):SamPilotReport{
  const blockers:string[]=[]
  if(cases.length<3)blockers.push('Production pilot requires at least three opportunity cases.')
  for(const c of cases){
    if(c.unauthorizedActionCount>0)blockers.push(`${c.id}: unauthorized external action observed`)
    if(!c.persistenceRecovered)blockers.push(`${c.id}: pursuit persistence recovery failed`)
  }
  const environmentBlocked=cases.length>0&&cases.every(c=>c.liveCertification==='environment_blocked')
  return {
    status:environmentBlocked?'environment_blocked':blockers.length?'fail':'pass',
    caseCount:cases.length,
    metrics:{
      candidateCount:cases.reduce((n,c)=>n+c.candidateCount,0),
      identityBlockedCount:cases.reduce((n,c)=>n+c.identityBlockedCount,0),
      freshnessBlockedCount:cases.reduce((n,c)=>n+c.freshnessBlockedCount,0),
      falsePositiveCount:cases.reduce((n,c)=>n+c.falsePositiveCount,0),
      humanOverrideCount:cases.reduce((n,c)=>n+c.humanOverrideCount,0),
    },
    blockers,bidSubmissionAuthorized:false,automaticOutreachAuthorized:false,
  }
}
