import assert from 'node:assert/strict'
import type { ContractReadinessPacket } from './contract-readiness.js'
import type { ProviderNegotiationState } from './provider-negotiation.js'
import { addContractRedline, createContractDraftPacket, isContractDraftReviewComplete, reviewContractRedline } from './contract-draft.js'
const readiness:ContractReadinessPacket={opportunityId:'o',providerId:'p',negotiationId:'n',status:'ready_for_drafting',checks:[{id:'c',kind:'scope',required:true,status:'satisfied',evidenceRefs:['e'],notes:[]}],blockers:[],unresolved:[],provisionalTermsRef:'a',contractDraftingAllowed:true,contractExecutionAuthorized:false,signatureAuthorized:false}
const n:ProviderNegotiationState={id:'n',opportunityId:'o',providerId:'p',packetId:'pk',status:'provisional_terms',baseline:{role:'subcontractor',requirementIds:['r'],commercialStructure:'subcontract_margin',modeledMarginPercent:20,draftApprovalRef:'a0'},claims:[],counteroffers:[],blockers:[],openQuestions:[],provisionalTerms:{counterofferId:'co',requirementIds:['r'],commercialTerms:[],approvalRef:'a',approvedByRef:'h',approvedAt:'2026-09-20T00:00:00Z',contractAuthority:false,signatureAuthority:false},contractExecutionAuthorized:false,signatureAuthorized:false,createdAt:'x',updatedAt:'x'}
let p=createContractDraftPacket(readiness,n,[{id:'scope',kind:'scope',title:'Scope',text:'Perform r',sourceRefs:['e']}]);assert.equal(p.signatureAuthorized,false)
p=addContractRedline(p,{id:'r1',clauseId:'scope',proposedText:'Perform r by date',reason:'clarify',proposedByRef:'provider:p'});assert.equal(isContractDraftReviewComplete(p),false)
p=reviewContractRedline(p,'r1',{decision:'accepted',reviewRef:'review:1',reviewedByRef:'human:1'});assert.equal(isContractDraftReviewComplete(p),true);assert.equal(p.executionAuthorized,false)
console.log('contract-draft tests passed')
