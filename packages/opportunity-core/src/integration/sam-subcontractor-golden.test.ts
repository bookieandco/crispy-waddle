import assert from 'node:assert/strict'
import { advanceFulfillmentProviderStage, createFulfillmentProvider, type FulfillmentProvider } from '../domain/fulfillment-provider.js'
import type { OpportunityRequirement, OpportunityRequirementSet } from '../domain/opportunity-requirement.js'
import { buildFulfillmentPlan } from '../domain/fulfillment-plan.js'
import { evaluateCommercialDeal } from '../domain/commercial-deal-gate.js'
import { evaluateProviderFreshness } from '../domain/provider-freshness.js'
import { reconcileNegotiatedCommercialTerms } from '../domain/commercial-reconciliation.js'
import type { ProviderNegotiationState } from '../domain/provider-negotiation.js'

function req(id:string,kind:OpportunityRequirement['kind'],label:string,keywords:string[],severity:OpportunityRequirement['severity']='required'):OpportunityRequirement{
  return {id,opportunityId:'sam:gold',kind,label,severity,evidenceStatus:'explicit',sourceClaimIds:[],sourceEvidenceIds:['sam:e'],naicsCodes:[],pscCodes:[],keywords,attributes:{},confidence:1,blockers:[]}
}
function set(requirements:OpportunityRequirement[]):OpportunityRequirementSet{return {opportunityId:'sam:gold',requirements,unresolved:[],generatedAt:'2026-09-20T00:00:00Z'}}
function provider(id:string,name:string,cap:string,opts:{credential?:string;expiresAt?:string;capacityAt?:string}={}):FulfillmentProvider{
  const evidence=[
    {id:id+':id',kind:'sam_registration' as const,relationship:'supports_identity' as const,sourceId:'sam',capturedAt:'2026-09-19T00:00:00Z',confidence:1},
    {id:id+':cap',kind:'capability_record' as const,relationship:'supports_capability' as const,sourceId:'cap',capturedAt:'2026-09-19T00:00:00Z',confidence:1},
    {id:id+':geo',kind:'official_source' as const,relationship:'supports_geography' as const,sourceId:'sam',capturedAt:'2026-09-19T00:00:00Z',confidence:1},
    {id:id+':capacity',kind:'capacity_record' as const,relationship:'supports_capacity' as const,sourceId:'att',capturedAt:opts.capacityAt??'2026-09-19T00:00:00Z',confidence:1},
    ...(opts.credential?[{id:id+':cred',kind:'certification_record' as const,relationship:'supports_credential' as const,sourceId:'sam',capturedAt:'2026-09-19T00:00:00Z',confidence:1}]:[]),
  ]
  let p=createFulfillmentProvider({id,legalName:name,identifiers:[{type:'uei',value:id+'uei',verified:true,evidenceRefs:[id+':id']}],serviceAreas:[{country:'US',state:'California',evidenceRefs:[id+':geo']}],capabilities:[{id:id+':c',name:cap,naicsCodes:[],pscCodes:[],keywords:cap.toLowerCase().split(' '),confidence:1,verified:true,evidenceRefs:[id+':cap']}],credentials:opts.credential?[{id:id+':credential',kind:'certification',name:opts.credential,expiresAt:opts.expiresAt,verified:true,evidenceRefs:[id+':cred']}]:[],pastPerformance:[],capacity:{status:'available',evidenceRefs:[id+':capacity']},evidence,sourceIds:['sam'],riskFlags:[]},'2026-09-19T00:00:00Z')
  p=advanceFulfillmentProviderStage(p,'evidence_collected');p=advanceFulfillmentProviderStage(p,'identity_verified');p=advanceFulfillmentProviderStage(p,'capability_verified');return advanceFulfillmentProviderStage(p,'verified')
}

// 1. one provider can directly fulfill all required capabilities
const both=provider('p:both','Both LLC','cloud security')
const direct=buildFulfillmentPlan(set([req('cloud','capability','Cloud',['cloud']),req('security','capability','Security',['security'])]),[both])
assert.equal(direct.structure,'direct_fulfillment');assert.equal(direct.uncoveredRequirementIds.length,0)

// 2. complementary verified providers produce a prime/sub plan
const cloud=provider('p:cloud','Cloud LLC','cloud')
const security=provider('p:security','Security LLC','security')
const team=buildFulfillmentPlan(set([req('cloud','capability','Cloud',['cloud']),req('security','capability','Security',['security'])]),[cloud,security])
assert.equal(team.structure,'prime_with_subcontractor');assert.equal(team.assignments.length,2)

// 3. socioeconomic/set-aside requirement cannot be satisfied by unrelated capability evidence
const setAside=buildFulfillmentPlan(set([req('sb','socioeconomic','Small Business',['small','business'])]),[both])
assert.notEqual(setAside.structure,'direct_fulfillment');assert.ok(setAside.uncoveredRequirementIds.includes('sb'))

// 4. clearance/security requirement fails without a verified matching credential
const clearance=buildFulfillmentPlan(set([req('clearance','security','Secret clearance',['secret','clearance'])]),[security])
assert.ok(clearance.uncoveredRequirementIds.includes('clearance'))

// 5. stale capacity / expired credential blocks freshness
const aging=provider('p:aging','Aging LLC','cloud',{credential:'Cloud certification',expiresAt:'2026-09-01T00:00:00Z',capacityAt:'2026-08-01T00:00:00Z'})
const freshness=evaluateProviderFreshness(aging,'2026-09-20T00:00:00Z')
assert.equal(freshness.status,'blocked');assert.ok(freshness.expiredCredentialIds.length===1)

// 6. provider counteroffer is reconciled and can destroy margin
const commercial=evaluateCommercialDeal(direct,{contractValue:100000,providerCosts:{'p:both':40000},directCost:10000,overhead:10000,contingency:5000})
const negotiation:ProviderNegotiationState={id:'n',opportunityId:'sam:gold',providerId:'p:both',packetId:'pk',status:'provisional_terms',baseline:{role:'lead',requirementIds:direct.assignments[0].requirementIds,modeledProviderCost:40000,commercialStructure:'direct_fulfillment',modeledMarginPercent:35,draftApprovalRef:'a'},claims:[],counteroffers:[],blockers:[],openQuestions:[],provisionalTerms:{counterofferId:'co',providerCost:90000,requirementIds:direct.assignments[0].requirementIds,commercialTerms:[],approvalRef:'ap',approvedByRef:'h',approvedAt:'x',contractAuthority:false,signatureAuthority:false},contractExecutionAuthorized:false,signatureAuthorized:false,createdAt:'x',updatedAt:'x'}
const reconciled=reconcileNegotiatedCommercialTerms(direct,commercial,[negotiation],{contractValue:100000,providerCosts:{'p:both':40000},directCost:10000,overhead:10000,contingency:5000})
assert.equal(reconciled.status,'blocked')

// 7. no viable provider remains unresolved
const none=buildFulfillmentPlan(set([req('medical','capability','Clinical laboratory',['clinical','laboratory'])]),[cloud,security])
assert.equal(none.structure,'unresolved');assert.ok(none.uncoveredRequirementIds.includes('medical'))

console.log('SAM-SUB.22 golden cases passed')
