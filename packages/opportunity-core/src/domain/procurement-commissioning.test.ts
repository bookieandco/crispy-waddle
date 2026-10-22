import assert from 'node:assert/strict'
import {
 planProcurementSourceRecovery,reconcileProcurementNotice,verifyProcurementProviders,
 reviewProcurementCommercial,prepareProcurementBidPacket,
 type ProcurementDocument,type ProcurementCostEvidence,
} from './procurement-commissioning.js'
import type { FulfillmentProvider } from './fulfillment-provider.js'
import type { FulfillmentPlan } from './fulfillment-plan.js'
import type { OpportunityRequirementSet } from './opportunity-requirement.js'
import type { ProviderQuote } from './provider-quote.js'

const now='2026-10-22T17:00:00Z'
const sources=planProcurementSourceRecovery([
 {id:'b',name:'School',sourceUrl:'https://school.example.gov/bids',stateCode:'CA',jurisdictionLevel:'school_district',verificationStatus:'official_owner_verified',adapterStatus:'degraded',accessReviewStatus:'approved_public_official',sourceKinds:['bids'],lastSeenAt:now},
 {id:'c',name:'School mirror',sourceUrl:'https://school.example.gov/bids?sortn=Close',stateCode:'CA',jurisdictionLevel:'school_district',verificationStatus:'official_owner_verified',adapterStatus:'degraded',accessReviewStatus:'approved_public_official',sourceKinds:['bids']},
 {id:'d',name:'Unverified',sourceUrl:'https://vendor.example/bids',stateCode:'CA',jurisdictionLevel:'school_district',verificationStatus:'candidate',adapterStatus:'degraded',accessReviewStatus:'pending',sourceKinds:['bids']},
 {id:'a',name:'County',sourceUrl:'https://county.example.gov/solicitations',stateCode:'CA',jurisdictionLevel:'county',verificationStatus:'official_owner_verified',adapterStatus:'active',accessReviewStatus:'approved_public_official',sourceKinds:['bids']}
],now)
assert.equal(sources.find(s=>s.sourceId==='b')?.action,'retrial')
assert.equal(sources.find(s=>s.sourceId==='c')?.action,'manual_review')
assert.equal(sources.find(s=>s.sourceId==='d')?.action,'manual_review')
assert.equal(sources.find(s=>s.sourceId==='a')?.action,'monitor')
assert.ok(sources.every(s=>s.externalFetchAuthorized===false))

const documents:ProcurementDocument[]=[
 {id:'original',kind:'solicitation',version:'1',publishedAt:'2026-10-01T16:00:00Z',sourceUrl:'https://school.example.gov/bids/123',official:true,evidenceRef:'official-v1',
 deadlineAt:'2026-10-27T11:00:00-07:00',scopeRefs:['scope-v1'],requiredForms:['Bid Form'],
 buyerContacts:[{name:'Procurement Office',email:'bids@school.example.gov',phone:'951-555-0111'}]},
 {id:'amendment',kind:'addendum',version:'2',publishedAt:'2026-10-20T16:00:00Z',sourceUrl:'https://school.example.gov/bids/123/addendum',official:true,evidenceRef:'official-v2',deadlineAt:'2026-11-03T11:00:00-08:00'},
 {id:'directory',kind:'secondary',version:'3',publishedAt:'2026-10-21T17:00:00Z',sourceUrl:'https://secondary.example/bids/123',official:false,evidenceRef:'secondary-v3',deadlineAt:'2026-11-04T11:00:00-08:00'}
]
const notice=reconcileProcurementNotice('school-123',documents,now)
assert.equal(notice.status,'source_verified')
assert.equal(notice.selectedDeadline,'2026-11-03T11:00:00-08:00')
assert.equal(notice.buyerContacts.length,1)
assert.equal(notice.documents.length,2)
assert.equal(notice.bidSubmissionAuthorized,false)
const unknown=reconcileProcurementNotice('school-123',[documents[2]!],now)
assert.equal(unknown.status,'review_required')
assert.ok(unknown.blockers.some(s=>s.includes('official')))

const evidence=[
 {id:'identity-e',kind:'entity_record',relationship:'supports_identity',sourceId:'licensing-registry',capturedAt:now,confidence:1},
 {id:'capability-e',kind:'capability_record',relationship:'supports_capability',sourceId:'past-work',capturedAt:now,confidence:1},
 {id:'capacity-e',kind:'capacity_record',relationship:'supports_capacity',sourceId:'staffing-document',capturedAt:now,confidence:1},
 {id:'geo-e',kind:'official_source',relationship:'supports_geography',sourceId:'service-record',capturedAt:now,confidence:1},
 {id:'dir-e',kind:'license_record',relationship:'supports_credential',sourceId:'dir-registry',capturedAt:now,confidence:1},
 {id:'insurance-e',kind:'insurance_record',relationship:'supports_credential',sourceId:'insurer',capturedAt:now,confidence:1},
 {id:'bond-e',kind:'bond_record',relationship:'supports_credential',sourceId:'surety',capturedAt:now,confidence:1},
] as FulfillmentProvider['evidence']
const provider:FulfillmentProvider={
 id:'roofer',legalName:'Verified Roofer',dbaName:undefined,
 verificationStatus:'verified',stage:'verified',createdAt:now,updatedAt:now,
 identifiers:[{type:'license_number',value:'1234',verified:true,evidenceRefs:['identity-e']}],
 serviceAreas:[{state:'CA',evidenceRefs:['geo-e']}],
 capabilities:[{id:'roof',name:'Roof Restoration',naicsCodes:['238160'],pscCodes:[],keywords:['roof'],confidence:1,verified:true,evidenceRefs:['capability-e']}],
 credentials:[
 {id:'dir',kind:'registration',name:'DIR Public Works',verified:true,evidenceRefs:['dir-e'],expiresAt:'2027-01-01T00:00:00Z'},
 {id:'insurance',kind:'insurance',name:'insurance',verified:true,evidenceRefs:['insurance-e'],expiresAt:'2027-01-01T00:00:00Z'},
 {id:'bond',kind:'bond',name:'bond',verified:true,evidenceRefs:['bond-e'],expiresAt:'2027-01-01T00:00:00Z'}],
 pastPerformance:[],capacity:{status:'available',evidenceRefs:['capacity-e']},
 evidence,sourceIds:['licensing-registry','past-work'],riskFlags:[]
}
const set:OpportunityRequirementSet={opportunityId:'school-123',requirements:[],unresolved:[],generatedAt:now}
const providerReview=verifyProcurementProviders(set,[provider],{stateCode:'CA',primeProviderId:'roofer',requireDirRegistration:true,requireVerifiedInsurance:true,requireVerifiedBond:true},now)
assert.equal(providerReview[0]?.status,'qualified_candidate')
assert.equal(providerReview[0]?.outreachAuthorized,false)
const expired:FulfillmentProvider={...provider,credentials:provider.credentials.map(c=>c.kind==='bond'?{...c,expiresAt:'2026-01-01T00:00:00Z'}:c)}
const expiredReview=verifyProcurementProviders(set,[expired],{requireVerifiedBond:true,stateCode:'CA'},now)
assert.notEqual(expiredReview[0]?.status,'qualified_candidate')
assert.ok(expiredReview[0]?.blockers.some(s=>s.includes('bond')))
const setAside=verifyProcurementProviders(set,[provider],{primeProviderId:'roofer',requireSetAsideCredential:'8(a)'},now)
assert.ok(setAside[0]?.blockers.some(s=>s.includes('set-aside')))

const plan:FulfillmentPlan={
 opportunityId:'school-123',structure:'direct_fulfillment',
 assignments:[{providerId:'roofer',role:'lead',requirementIds:['roof'],score:100,evidenceRefs:['capability-e']}],
 coveredRequirementIds:['roof'],uncoveredRequirementIds:[],blockers:[],rationale:[],requiresHumanApproval:true,engagementAuthorized:false
}
const quote:ProviderQuote={
 id:'q1',opportunityId:'school-123',providerId:'roofer',requirementIds:['roof'],currency:'USD',status:'accepted_for_model',
 requestPacketId:'pkt1',quotedAmount:300000,quoteEvidenceRef:'written-firm-quote',validUntil:'2026-11-09T00:00:00Z',
 pricingModelAuthorized:false,paymentAuthorized:false
}
const costEvidence:ProcurementCostEvidence[]=[
 {name:'directCost',amount:10000,evidenceRef:'cost-direct'},
 {name:'overhead',amount:10000,evidenceRef:'cost-overhead'},
 {name:'contingency',amount:12000,evidenceRef:'cost-contingency'},
 {name:'acquisitionCost',amount:0,evidenceRef:'cost-acquisition-zero'},
 {name:'financingCost',amount:0,evidenceRef:'cost-financing-zero'}
]
const noQuote=reviewProcurementCommercial({plan,providers:providerReview,quotes:[],priceToBuyer:450000,buyerPriceEvidenceRef:'draft-price',costEvidence,now})
assert.equal(noQuote.status,'blocked')
assert.equal(noQuote.disclosedEconomics,undefined)
const economics=reviewProcurementCommercial({plan,providers:providerReview,quotes:[quote],priceToBuyer:450000,buyerPriceEvidenceRef:'draft-price',costEvidence,now})
assert.equal(economics.blockers.length,0)
assert.equal(economics.disclosedEconomics?.estimatedGrossProfit,118000)
assert.equal(economics.pricingAuthorized,false)
const expiredQuote=reviewProcurementCommercial({plan,providers:providerReview,quotes:[{...quote,validUntil:'2026-10-01T00:00:00Z'}],priceToBuyer:450000,buyerPriceEvidenceRef:'draft-price',costEvidence,now})
assert.equal(expiredQuote.disclosedEconomics,undefined)
const noForm=prepareProcurementBidPacket({notice,plan,providers:providerReview,commercial:economics,formAttachments:{},now})
assert.equal(noForm.status,'blocked')
assert.ok(noForm.blockers.some(s=>s.includes('Bid Form')))
const packet=prepareProcurementBidPacket({notice,plan,providers:providerReview,commercial:economics,formAttachments:{'Bid Form':'signed-form-review-ref'},now})
assert.equal(packet.status,'operator_review_ready')
assert.equal(packet.totalBidPrice,450000)
assert.deepEqual([packet.outreachAuthorized,packet.bidSubmissionAuthorized,packet.signatureAuthorized,packet.paymentAuthorized],[false,false,false,false])
console.log('PROCURE.01–.05 deterministic source, contact, qualification, commercial and packet tests PASS')
