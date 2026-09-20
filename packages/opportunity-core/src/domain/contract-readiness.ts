import type { ProviderNegotiationState } from './provider-negotiation.js'

export type ContractReadinessCheckKind =
  | 'scope'
  | 'pricing'
  | 'workshare'
  | 'insurance'
  | 'bonding'
  | 'licenses'
  | 'certifications'
  | 'representations'
  | 'flow_downs'
  | 'confidentiality'
  | 'ip_data_rights'
  | 'termination'
  | 'performance_obligations'
  | 'subcontracting_limitations'
  | 'signature_roles'
  | 'other'

export type ContractReadinessCheck = {
  id: string
  kind: ContractReadinessCheckKind
  required: boolean
  status: 'pending' | 'satisfied' | 'failed' | 'not_applicable'
  evidenceRefs: string[]
  notes: string[]
}

export type ContractReadinessPacket = {
  opportunityId: string
  providerId: string
  negotiationId: string
  status: 'blocked' | 'review_required' | 'ready_for_drafting'
  checks: ContractReadinessCheck[]
  blockers: string[]
  unresolved: ContractReadinessCheckKind[]
  provisionalTermsRef: string
  contractDraftingAllowed: boolean
  contractExecutionAuthorized: false
  signatureAuthorized: false
}

const requiredKinds: ContractReadinessCheckKind[] = [
  'scope','pricing','workshare','representations','flow_downs','confidentiality',
  'ip_data_rights','termination','performance_obligations','subcontracting_limitations','signature_roles',
]
const uniq=(v:string[])=>[...new Set(v.map(x=>x.trim()).filter(Boolean))]

export function evaluateContractReadiness(
  negotiation: ProviderNegotiationState,
  checks: ContractReadinessCheck[],
): ContractReadinessPacket {
  if (negotiation.status !== 'provisional_terms' || !negotiation.provisionalTerms) {
    throw new Error('Provisional negotiated terms are required for contract readiness')
  }
  const blockers=[...negotiation.blockers]
  const byKind=new Map<ContractReadinessCheckKind,ContractReadinessCheck[]>()
  for(const check of checks){
    const arr=byKind.get(check.kind)??[]; arr.push(check); byKind.set(check.kind,arr)
    if(check.status==='failed') blockers.push(`Contract readiness check failed: ${check.kind}`)
    if(check.required && check.status==='satisfied' && check.evidenceRefs.length===0){
      blockers.push(`Satisfied required contract check lacks evidence: ${check.kind}`)
    }
  }
  const unresolved=requiredKinds.filter(kind=>{
    const arr=byKind.get(kind)??[]
    return !arr.some(c=>c.status==='satisfied' && c.evidenceRefs.length>0)
  })
  let status:ContractReadinessPacket['status']='review_required'
  if(blockers.length) status='blocked'
  else if(unresolved.length===0) status='ready_for_drafting'
  return {
    opportunityId:negotiation.opportunityId,
    providerId:negotiation.providerId,
    negotiationId:negotiation.id,
    status,checks,
    blockers:uniq(blockers),
    unresolved,
    provisionalTermsRef:negotiation.provisionalTerms.approvalRef,
    contractDraftingAllowed:status==='ready_for_drafting',
    contractExecutionAuthorized:false,
    signatureAuthorized:false,
  }
}
