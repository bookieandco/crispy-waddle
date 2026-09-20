import type { CareerPassportSnapshot } from '@staffing/core/domain'
import type { OpportunityRequirementSet } from './opportunity-requirement.js'

export type WorkforceFulfillmentCandidate = {
  workerId: string
  matchedRequirementIds: string[]
  unmetRequirementIds: string[]
  score: number
  consentEligible: boolean
  reasons: string[]
}

function tokens(values:string[]):Set<string>{
  return new Set(values.flatMap(v=>v.toLowerCase().split(/[^a-z0-9]+/)).filter(Boolean))
}

export function matchStaffingSnapshotToRequirements(
  snapshot:CareerPassportSnapshot,
  set:OpportunityRequirementSet,
  requiredConsentScope='opportunity_fulfillment',
):WorkforceFulfillmentCandidate{
  const workerTokens=tokens([...snapshot.skills,...snapshot.verifiedCredentials,...snapshot.workHistory])
  const required=set.requirements.filter(r=>r.severity==='required' && ['capability','credential','security','schedule','geography'].includes(r.kind))
  const matchedRequirementIds:string[]=[]
  const unmetRequirementIds:string[]=[]
  for(const req of required){
    const reqTokens=tokens([req.label,...req.keywords])
    const overlap=[...reqTokens].filter(t=>workerTokens.has(t))
    if(req.kind==='schedule'){
      if(snapshot.availability.trim()) matchedRequirementIds.push(req.id); else unmetRequirementIds.push(req.id)
    }else if(overlap.length>0) matchedRequirementIds.push(req.id)
    else unmetRequirementIds.push(req.id)
  }
  const consentEligible=snapshot.consentScopes.includes(requiredConsentScope)
  const coverage=required.length?matchedRequirementIds.length/required.length:1
  const score=Math.round(coverage*100)
  const reasons=[
    `Matched ${matchedRequirementIds.length} of ${required.length} workforce-addressable required requirements.`,
    ...(consentEligible?[]:[`Missing Staffing Core consent scope: ${requiredConsentScope}`]),
  ]
  return {workerId:snapshot.workerId,matchedRequirementIds,unmetRequirementIds,score,consentEligible,reasons}
}

export function rankStaffingFulfillmentCandidates(
  snapshots:CareerPassportSnapshot[],
  set:OpportunityRequirementSet,
  requiredConsentScope='opportunity_fulfillment',
):WorkforceFulfillmentCandidate[]{
  return snapshots
    .map(s=>matchStaffingSnapshotToRequirements(s,set,requiredConsentScope))
    .filter(c=>c.consentEligible)
    .sort((a,b)=>b.score-a.score||a.workerId.localeCompare(b.workerId))
}

export type WorkforceFulfillmentPlan = {
  opportunityId:string
  workerIds:string[]
  coveredRequirementIds:string[]
  uncoveredRequirementIds:string[]
  source:'staffing_core'
  placementAuthorized:false
}

export function buildWorkforceFulfillmentPlan(
  set:OpportunityRequirementSet,
  candidates:WorkforceFulfillmentCandidate[],
):WorkforceFulfillmentPlan{
  const requiredIds=set.requirements.filter(r=>r.severity==='required'&&['capability','credential','security','schedule','geography'].includes(r.kind)).map(r=>r.id)
  const uncovered=new Set(requiredIds),workerIds:string[]=[]
  while(uncovered.size){
    const best=candidates
      .filter(c=>c.consentEligible&&!workerIds.includes(c.workerId))
      .map(c=>({c,cover:c.matchedRequirementIds.filter(id=>uncovered.has(id))}))
      .filter(x=>x.cover.length)
      .sort((a,b)=>b.cover.length-a.cover.length||b.c.score-a.c.score||a.c.workerId.localeCompare(b.c.workerId))[0]
    if(!best)break
    workerIds.push(best.c.workerId);best.cover.forEach(id=>uncovered.delete(id))
  }
  return {opportunityId:set.opportunityId,workerIds,coveredRequirementIds:requiredIds.filter(id=>!uncovered.has(id)),uncoveredRequirementIds:[...uncovered],source:'staffing_core',placementAuthorized:false}
}
