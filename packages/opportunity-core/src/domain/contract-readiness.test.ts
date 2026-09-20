import assert from 'node:assert/strict'
import type { ProviderNegotiationState } from './provider-negotiation.js'
import { evaluateContractReadiness, type ContractReadinessCheck, type ContractReadinessCheckKind } from './contract-readiness.js'
const n:ProviderNegotiationState={id:'n1',opportunityId:'o1',providerId:'p1',packetId:'pk',status:'provisional_terms',baseline:{role:'subcontractor',requirementIds:['r1'],commercialStructure:'subcontract_margin',modeledMarginPercent:20,draftApprovalRef:'a0'},claims:[],counteroffers:[],blockers:[],openQuestions:[],provisionalTerms:{counterofferId:'c1',providerCost:50,requirementIds:['r1'],commercialTerms:[],approvalRef:'a1',approvedByRef:'h1',approvedAt:'2026-09-20T00:00:00Z',contractAuthority:false,signatureAuthority:false},contractExecutionAuthorized:false,signatureAuthorized:false,createdAt:'2026-09-20T00:00:00Z',updatedAt:'2026-09-20T00:00:00Z'}
const kinds:ContractReadinessCheckKind[]=['scope','pricing','workshare','representations','flow_downs','confidentiality','ip_data_rights','termination','performance_obligations','subcontracting_limitations','signature_roles']
const checks:ContractReadinessCheck[]=kinds.map((kind,i)=>({id:'c'+i,kind,required:true,status:'satisfied',evidenceRefs:['e'+i],notes:[]}))
const ready=evaluateContractReadiness(n,checks);assert.equal(ready.status,'ready_for_drafting');assert.equal(ready.signatureAuthorized,false)
const bad=evaluateContractReadiness(n,checks.map(x=>x.kind==='pricing'?{...x,evidenceRefs:[]}:x));assert.equal(bad.status,'blocked')
console.log('contract-readiness tests passed')
