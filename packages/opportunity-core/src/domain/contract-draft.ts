import type { ContractReadinessPacket } from './contract-readiness.js'
import type { ProviderNegotiationState } from './provider-negotiation.js'

export type ContractClauseKind =
  | 'scope' | 'price_payment' | 'workshare' | 'flow_down' | 'confidentiality'
  | 'ip_data_rights' | 'insurance_bonding' | 'representations' | 'termination'
  | 'performance' | 'disputes' | 'signature' | 'other'

export type ContractClause = {
  id: string
  kind: ContractClauseKind
  title: string
  text: string
  sourceRefs: string[]
}

export type ContractRedline = {
  id: string
  clauseId: string
  proposedText: string
  reason: string
  proposedByRef: string
  status: 'open' | 'accepted' | 'rejected' | 'superseded'
  reviewRef?: string
  reviewedByRef?: string
  reviewedAt?: string
}

export type ContractDraftPacket = {
  id: string
  opportunityId: string
  providerId: string
  negotiationId: string
  version: number
  clauses: ContractClause[]
  redlines: ContractRedline[]
  readinessEvidenceRefs: string[]
  unresolvedRedlineIds: string[]
  draftingOnly: true
  signatureAuthorized: false
  executionAuthorized: false
}

const uniq=(v:string[])=>[...new Set(v.map(x=>x.trim()).filter(Boolean))]

export function createContractDraftPacket(
  readiness: ContractReadinessPacket,
  negotiation: ProviderNegotiationState,
  clauses: ContractClause[],
): ContractDraftPacket {
  if(readiness.status!=='ready_for_drafting' || !readiness.contractDraftingAllowed) throw new Error('Contract readiness must permit drafting')
  if(negotiation.id!==readiness.negotiationId || !negotiation.provisionalTerms) throw new Error('Negotiation does not match contract readiness packet')
  if(clauses.length===0) throw new Error('Contract draft requires clauses')
  const ids=new Set<string>()
  for(const clause of clauses){
    if(!clause.id.trim()||!clause.title.trim()||!clause.text.trim()) throw new Error('Contract clause id, title, and text are required')
    if(ids.has(clause.id)) throw new Error(`Duplicate contract clause: ${clause.id}`)
    ids.add(clause.id)
  }
  return {
    id:`${readiness.opportunityId}:contract:${readiness.providerId}`,
    opportunityId:readiness.opportunityId,
    providerId:readiness.providerId,
    negotiationId:negotiation.id,
    version:1,
    clauses:clauses.map(c=>({...c,sourceRefs:uniq(c.sourceRefs)})),
    redlines:[],
    readinessEvidenceRefs:uniq(readiness.checks.flatMap(c=>c.evidenceRefs)),
    unresolvedRedlineIds:[],
    draftingOnly:true,
    signatureAuthorized:false,
    executionAuthorized:false,
  }
}

export function addContractRedline(
  packet: ContractDraftPacket,
  redline: Omit<ContractRedline,'status'>,
): ContractDraftPacket {
  if(!packet.clauses.some(c=>c.id===redline.clauseId)) throw new Error('Redline clause does not exist')
  if(packet.redlines.some(r=>r.id===redline.id)) throw new Error('Duplicate contract redline id')
  if(!redline.proposedText.trim()||!redline.proposedByRef.trim()) throw new Error('Redline proposed text and proposer are required')
  const next:{status:'open'}&Omit<ContractRedline,'status'>={...redline,status:'open'}
  return {...packet,version:packet.version+1,redlines:[...packet.redlines,next],unresolvedRedlineIds:uniq([...packet.unresolvedRedlineIds,redline.id])}
}

export function reviewContractRedline(
  packet: ContractDraftPacket,
  redlineId: string,
  input:{decision:'accepted'|'rejected';reviewRef:string;reviewedByRef:string},
  now=new Date().toISOString(),
): ContractDraftPacket {
  if(!input.reviewRef.trim()||!input.reviewedByRef.trim()) throw new Error('Redline review references are required')
  let found=false
  const redlines=packet.redlines.map(r=>{
    if(r.id!==redlineId)return r
    found=true
    if(r.status!=='open') throw new Error('Only open redlines can be reviewed')
    return {...r,status:input.decision,reviewRef:input.reviewRef.trim(),reviewedByRef:input.reviewedByRef.trim(),reviewedAt:now}
  })
  if(!found) throw new Error('Unknown contract redline')
  return {...packet,version:packet.version+1,redlines,unresolvedRedlineIds:packet.unresolvedRedlineIds.filter(id=>id!==redlineId)}
}

export function isContractDraftReviewComplete(packet:ContractDraftPacket):boolean{
  return packet.unresolvedRedlineIds.length===0 && packet.redlines.every(r=>r.status!=='open')
}
