import type { SamLiveCertificationReport } from './sam-live-certification.js'
import type { SamProviderResearchResult } from './sam-provider-research.js'
import type { TeamCandidate } from './provider-qualification-team.js'

export type SamLivePilotReceipt={
 id:string;opportunityId:string;noticeRef:string;canonicalOpportunityRef:string
 certification:SamLiveCertificationReport['status'];researchStatus:SamProviderResearchResult['researchStatus']
 providerCandidateCount:number;qualificationBlockedCount:number;teamStructure:TeamCandidate['plan']['structure']
 uncoveredRequirementCount:number;persistenceRecovered:boolean;capturedAt:string
 outreachAuthorized:false;bidSubmissionAuthorized:false
}

export function createSamLivePilotReceipt(input:Omit<SamLivePilotReceipt,'outreachAuthorized'|'bidSubmissionAuthorized'>):SamLivePilotReceipt{
 if(!input.id.trim()||!input.opportunityId.trim()||!input.noticeRef.trim()||!input.canonicalOpportunityRef.trim())throw new Error('Pilot source and canonical opportunity references are required')
 if(input.providerCandidateCount<0||input.qualificationBlockedCount<0||input.uncoveredRequirementCount<0)throw new Error('Pilot counts cannot be negative')
 return {...input,outreachAuthorized:false,bidSubmissionAuthorized:false}
}
