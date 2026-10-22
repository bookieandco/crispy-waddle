import type { Opportunity } from '@jhadina/opportunity-core'

/** A public listing is not an employer offer or verified authorization to work.
 * This is a conservative research triage, not a job application scorer. */
export type DiscoveredJobReview = {
  id:string
  title:string
  sourceUrl:string
  sourceName:string
  locationLabel:string
  remoteMentioned:boolean
  eligibilityVerified:false
  aiPerformanceAuthorized:false
  applicationAuthorized:false
  nextReview:string[]
}

export function makeDiscoveredJobReview(job:Opportunity):DiscoveredJobReview {
  if(job.family!=='employment'||job.type!=='job')throw Error('Job review requires canonical employment job')
  if(job.metadata?.applicationAuthority!=='NONE'||job.metadata?.discoveryOnly!==true) {
    throw Error('Untrusted application state on source listing')
  }
  return {
    id:job.id,title:job.title,sourceUrl:job.sourceUrl,sourceName:job.sourceName,
    locationLabel:job.description?.match(/Location: ([^.]*)/)?.[1]??'Location not independently verified',
    remoteMentioned:job.eligibility?.remote===true,
    eligibilityVerified:false,aiPerformanceAuthorized:false,applicationAuthorized:false,
    nextReview:[
      'Verify employment eligibility for current residence and work authorization',
      'Verify whether remote work from the desired jurisdiction is allowed',
      'Verify posting freshness, compensation, experience and required credentials',
      'Verify employer policy on AI-assisted work and applications',
    ],
  }
}

export function verifyCanonicalImportReadback(input:{
  expectedId:string
  expectedOwnerId:string
  persisted?:{userId:string;opportunity:Opportunity}
}):boolean{
  return Boolean(input.persisted &&
    input.persisted.userId===input.expectedOwnerId &&
    input.persisted.opportunity.id===input.expectedId &&
    input.persisted.opportunity.metadata?.applicationAuthority==='NONE' &&
    input.persisted.opportunity.status==='discovered'
  )
}
