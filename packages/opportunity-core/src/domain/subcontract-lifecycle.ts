import { createHash } from 'node:crypto'
import type { ContractDraftPacket } from './contract-draft.js'

export type ContractExecutionStatus='draft_review'|'signature_approval_requested'|'externally_executed'

export type ContractExecutionPacket={
  id:string
  opportunityId:string
  providerId:string
  contractDraftId:string
  contractVersion:number
  documentDigest:string
  status:ContractExecutionStatus
  signatureApprovalRef?:string
  approvedByRef?:string
  executedDocumentRef?:string
  executedAt?:string
  executionRecordedByRef?:string
  signatureAuthorized:false
  executionAuthorized:false
  paymentAuthorized:false
}

function digest(draft:ContractDraftPacket){
  return createHash('sha256').update(JSON.stringify({id:draft.id,version:draft.version,clauses:draft.clauses,redlines:draft.redlines})).digest('hex')
}

export function createContractExecutionPacket(draft:ContractDraftPacket):ContractExecutionPacket{
  if(draft.unresolvedRedlineIds.length)throw new Error('Contract redlines must be resolved before signature approval')
  return {id:`${draft.id}:execution`,opportunityId:draft.opportunityId,providerId:draft.providerId,contractDraftId:draft.id,contractVersion:draft.version,documentDigest:digest(draft),status:'draft_review',signatureAuthorized:false,executionAuthorized:false,paymentAuthorized:false}
}

export function requestContractSignatureApproval(packet:ContractExecutionPacket,draft:ContractDraftPacket,input:{approvalRef:string;approvedByRef:string}):ContractExecutionPacket{
  if(packet.contractDraftId!==draft.id||packet.contractVersion!==draft.version||packet.documentDigest!==digest(draft))throw new Error('Contract document changed; create a new execution packet')
  if(!input.approvalRef.trim()||!input.approvedByRef.trim())throw new Error('Signature approval references are required')
  return {...packet,status:'signature_approval_requested',signatureApprovalRef:input.approvalRef.trim(),approvedByRef:input.approvedByRef.trim(),signatureAuthorized:false,executionAuthorized:false,paymentAuthorized:false}
}

export function recordExternallyExecutedContract(packet:ContractExecutionPacket,draft:ContractDraftPacket,input:{executedDocumentRef:string;recordedByRef:string;executedAt:string}):ContractExecutionPacket{
  if(packet.status!=='signature_approval_requested'||!packet.signatureApprovalRef)throw new Error('Signature approval must be recorded before execution receipt')
  if(packet.contractDraftId!==draft.id||packet.contractVersion!==draft.version||packet.documentDigest!==digest(draft))throw new Error('Executed contract must match the approved document version and digest')
  if(!input.executedDocumentRef.trim()||!input.recordedByRef.trim()||!input.executedAt.trim())throw new Error('Execution receipt fields are required')
  return {...packet,status:'externally_executed',executedDocumentRef:input.executedDocumentRef.trim(),executionRecordedByRef:input.recordedByRef.trim(),executedAt:input.executedAt,signatureAuthorized:false,executionAuthorized:false,paymentAuthorized:false}
}
