import type { SamProductionCandidate } from './sam-production-pipeline'

export type SamOperatorAction =
  | 'refresh_evidence'
  | 'review_provider'
  | 'review_commercial'
  | 'review_compliance'
  | 'prepare_outreach'
  | 'review_contract'

export type SamOperatorView = {
  opportunityId:string
  title:string
  status:SamProductionCandidate['status']
  structure:SamProductionCandidate['fulfillment']['structure']
  providers:{providerId:string;role:string;score:number;requirementIds:string[]}[]
  blockers:string[]
  evidenceRefs:string[]
  allowedActions:SamOperatorAction[]
  bidSubmissionAuthorized:false
  outboundSendAuthorized:false
  contractExecutionAuthorized:false
}

export function buildSamOperatorView(candidate:SamProductionCandidate):SamOperatorView{
  const evidenceRefs=[...new Set(candidate.fulfillment.assignments.flatMap(a=>a.evidenceRefs))]
  const allowedActions:SamOperatorAction[]=['review_provider']
  if(candidate.freshness.some(x=>x.status!=='fresh'))allowedActions.push('refresh_evidence')
  if(candidate.fulfillment.structure!=='unresolved')allowedActions.push('review_commercial','review_compliance')
  if(candidate.status==='ready_for_human_review')allowedActions.push('prepare_outreach')
  return {
    opportunityId:candidate.opportunity.id,
    title:candidate.opportunity.title,
    status:candidate.status,
    structure:candidate.fulfillment.structure,
    providers:candidate.fulfillment.assignments.map(a=>({providerId:a.providerId,role:a.role,score:a.score,requirementIds:a.requirementIds})),
    blockers:candidate.blockers,
    evidenceRefs,
    allowedActions:[...new Set(allowedActions)],
    bidSubmissionAuthorized:false,
    outboundSendAuthorized:false,
    contractExecutionAuthorized:false,
  }
}
