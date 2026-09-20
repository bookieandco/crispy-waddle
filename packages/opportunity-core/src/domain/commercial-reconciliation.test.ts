import assert from 'node:assert/strict'
import type { FulfillmentPlan } from './fulfillment-plan.js'
import { evaluateCommercialDeal } from './commercial-deal-gate.js'
import type { ProviderNegotiationState } from './provider-negotiation.js'
import { reconcileNegotiatedCommercialTerms } from './commercial-reconciliation.js'
const plan:FulfillmentPlan={opportunityId:'o',structure:'prime_with_subcontractor',assignments:[{providerId:'p',role:'subcontractor',requirementIds:['r'],evidenceRefs:['e'],score:90}],coveredRequirementIds:['r'],uncoveredRequirementIds:[],blockers:[],rationale:[],requiresHumanApproval:true,engagementAuthorized:false}
const assumptions={contractValue:100000,providerCosts:{p:40000},directCost:5000,overhead:5000,contingency:5000}
const previous=evaluateCommercialDeal(plan,assumptions)
const n:ProviderNegotiationState={id:'n',opportunityId:'o',providerId:'p',packetId:'pk',status:'provisional_terms',baseline:{role:'subcontractor',requirementIds:['r'],modeledProviderCost:40000,commercialStructure:'subcontract_margin',modeledMarginPercent:45,draftApprovalRef:'a0'},claims:[],counteroffers:[],blockers:[],openQuestions:[],provisionalTerms:{counterofferId:'co',providerCost:48000,requirementIds:['r'],commercialTerms:[],approvalRef:'a1',approvedByRef:'h',approvedAt:'x',contractAuthority:false,signatureAuthority:false},contractExecutionAuthorized:false,signatureAuthorized:false,createdAt:'x',updatedAt:'x'}
const r=reconcileNegotiatedCommercialTerms(plan,previous,[n],assumptions);assert.equal(r.negotiatedProviderCosts.p,48000);assert.equal(r.deltas.providerCost,8000);assert.equal(r.status,'requires_reapproval');assert.equal(r.reapprovalRequired,true)
console.log('commercial-reconciliation tests passed')
