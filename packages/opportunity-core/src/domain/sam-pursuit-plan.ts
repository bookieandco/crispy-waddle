import type { CommercialDealGate } from './commercial-deal-gate.js'
import type { CommercialReconciliation } from './commercial-reconciliation.js'
import type { ContractDraftPacket } from './contract-draft.js'
import type { ContractReadinessPacket } from './contract-readiness.js'
import type { EngagementReadinessGate } from './engagement-readiness.js'
import type { FulfillmentPlan } from './fulfillment-plan.js'
import type { OpportunityRequirementSet } from './opportunity-requirement.js'
import type { ProviderFreshnessResult } from './provider-freshness.js'
import type { ProviderNegotiationState } from './provider-negotiation.js'

export type SamPursuitStage =
  | 'requirements' | 'provider_fulfillment' | 'commercial' | 'provider_freshness'
  | 'engagement_readiness' | 'negotiation' | 'contract_readiness' | 'contract_draft'

export type SamPursuitStageStatus = 'done' | 'pending' | 'blocked' | 'expired' | 'awaiting_human_approval'

export type SamPursuitStageState = {
  stage: SamPursuitStage
  status: SamPursuitStageStatus
  blockers: string[]
  evidenceRefs: string[]
  refs: string[]
}

export type SamGovernedPursuitPlan = {
  opportunityId: string
  status: 'blocked' | 'in_progress' | 'ready_for_contract_review'
  stages: SamPursuitStageState[]
  nextStage?: SamPursuitStage
  blockers: string[]
  humanGatesRemaining: string[]
  executionAuthorized: false
}

const uniq=(v:string[])=>[...new Set(v.map(x=>x.trim()).filter(Boolean))]

export function buildSamGovernedPursuitPlan(input:{
  requirements:OpportunityRequirementSet
  fulfillment?:FulfillmentPlan
  commercial?:CommercialDealGate
  reconciliation?:CommercialReconciliation
  freshness?:ProviderFreshnessResult[]
  engagement?:EngagementReadinessGate
  negotiations?:ProviderNegotiationState[]
  contractReadiness?:ContractReadinessPacket[]
  contractDrafts?:ContractDraftPacket[]
}):SamGovernedPursuitPlan{
  const opportunityId=input.requirements.opportunityId
  const stages:SamPursuitStageState[]=[]
  stages.push({
    stage:'requirements',
    status:input.requirements.unresolved.length?'blocked':'done',
    blockers:[...input.requirements.unresolved],
    evidenceRefs:uniq(input.requirements.requirements.flatMap(r=>r.sourceEvidenceIds)),
    refs:input.requirements.requirements.map(r=>r.id),
  })

  const f=input.fulfillment
  stages.push({
    stage:'provider_fulfillment',
    status:!f?'pending':f.blockers.length||f.uncoveredRequirementIds.length?'blocked':'done',
    blockers:f?[...f.blockers,...f.uncoveredRequirementIds.map(id=>`Uncovered requirement: ${id}`)]:[],
    evidenceRefs:f?uniq(f.assignments.flatMap(a=>a.evidenceRefs)):[],
    refs:f?f.assignments.map(a=>a.providerId):[],
  })

  const effectiveCommercial=input.reconciliation?.reconciled??input.commercial
  let commercialStatus:SamPursuitStageStatus='pending'
  if(effectiveCommercial){
    commercialStatus=effectiveCommercial.status==='blocked'?'blocked':
      input.reconciliation?.reapprovalRequired?'awaiting_human_approval':
      effectiveCommercial.status==='commercially_viable'?'done':'awaiting_human_approval'
  }
  stages.push({stage:'commercial',status:commercialStatus,blockers:effectiveCommercial?.blockers??[],evidenceRefs:[],refs:effectiveCommercial?[effectiveCommercial.structure]:[]})

  const freshness=input.freshness??[]
  const stale=freshness.filter(x=>x.status!=='fresh')
  stages.push({
    stage:'provider_freshness',
    status:!f?'pending':!freshness.length?'pending':stale.some(x=>x.status==='blocked')?'expired':stale.length?'expired':'done',
    blockers:stale.flatMap(x=>x.issues.filter(i=>i.blocking).map(i=>`${x.providerId}: ${i.message}`)),
    evidenceRefs:[],refs:freshness.map(x=>x.providerId),
  })

  const e=input.engagement
  stages.push({
    stage:'engagement_readiness',
    status:!e?'pending':e.status==='blocked'?'blocked':e.status==='human_approved'?'done':'awaiting_human_approval',
    blockers:e?.blockers??[],evidenceRefs:e?uniq(e.checks.flatMap(c=>c.evidenceRefs)):[],refs:e?.approvalRef?[e.approvalRef]:[],
  })

  const negotiations=input.negotiations??[]
  stages.push({
    stage:'negotiation',
    status:!f?'pending':negotiations.length<f.assignments.length?'pending':negotiations.some(n=>n.status==='declined')?'blocked':negotiations.every(n=>n.status==='provisional_terms')?'done':'pending',
    blockers:negotiations.flatMap(n=>n.blockers),evidenceRefs:uniq(negotiations.flatMap(n=>n.claims.flatMap(c=>c.evidenceRefs))),refs:negotiations.map(n=>n.id),
  })

  const cr=input.contractReadiness??[]
  stages.push({
    stage:'contract_readiness',
    status:!negotiations.length?'pending':cr.length<negotiations.length?'pending':cr.some(x=>x.status==='blocked')?'blocked':cr.every(x=>x.status==='ready_for_drafting')?'done':'awaiting_human_approval',
    blockers:cr.flatMap(x=>x.blockers),evidenceRefs:uniq(cr.flatMap(x=>x.checks.flatMap(c=>c.evidenceRefs))),refs:cr.map(x=>x.negotiationId),
  })

  const drafts=input.contractDrafts??[]
  stages.push({
    stage:'contract_draft',
    status:!cr.length?'pending':drafts.length<cr.length?'pending':drafts.some(d=>d.unresolvedRedlineIds.length)?'awaiting_human_approval':'done',
    blockers:drafts.flatMap(d=>d.unresolvedRedlineIds.map(id=>`Open redline: ${id}`)),
    evidenceRefs:uniq(drafts.flatMap(d=>d.readinessEvidenceRefs)),refs:drafts.map(d=>d.id),
  })

  const blockers=uniq(stages.flatMap(s=>['blocked','expired'].includes(s.status)?s.blockers:[]))
  const firstPending=stages.find(s=>s.status!=='done')
  const humanGatesRemaining=stages.filter(s=>s.status==='awaiting_human_approval').map(s=>s.stage)
  const status:SamGovernedPursuitPlan['status']=stages.some(s=>['blocked','expired'].includes(s.status))?'blocked':stages.every(s=>s.status==='done')?'ready_for_contract_review':'in_progress'
  return {opportunityId,status,stages,nextStage:firstPending?.stage,blockers,humanGatesRemaining,executionAuthorized:false}
}
