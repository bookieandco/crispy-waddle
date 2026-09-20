import assert from 'node:assert/strict'
import { createContractExecutionPacket,recordExternallyExecutedContract,requestContractSignatureApproval } from './subcontract-lifecycle.js'
import type { ContractDraftPacket } from './contract-draft.js'
const draft:ContractDraftPacket={id:'o:contract:p',opportunityId:'o',providerId:'p',negotiationId:'n',version:2,clauses:[{id:'c',kind:'scope',title:'Scope',text:'Do work',sourceRefs:['r']}],redlines:[],readinessEvidenceRefs:['e'],unresolvedRedlineIds:[],draftingOnly:true,signatureAuthorized:false,executionAuthorized:false}
const packet=createContractExecutionPacket(draft)
const approved=requestContractSignatureApproval(packet,draft,{approvalRef:'approval:signature-review',approvedByRef:'human:1'})
assert.equal(approved.signatureAuthorized,false)
const changed={...draft,version:3}
assert.throws(()=>recordExternallyExecutedContract(approved,changed,{executedDocumentRef:'doc:1',recordedByRef:'human:1',executedAt:'2026-09-20T18:00:00Z'}),/changed|match/)
const executed=recordExternallyExecutedContract(approved,draft,{executedDocumentRef:'doc:1',recordedByRef:'human:1',executedAt:'2026-09-20T18:00:00Z'})
assert.equal(executed.status,'externally_executed');assert.equal(executed.paymentAuthorized,false);assert.equal(executed.executionAuthorized,false)
