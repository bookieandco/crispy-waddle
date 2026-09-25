import assert from 'node:assert/strict'
import {
  assessProviderBench,
  assessProviderReady,
  assessPrimeSubcontractOpportunity,
  assessQuoteCoverage,
  assessSamCapture,
  assessSamFunding,
  assessSamProposalReadiness,
  buildSamPricingScenario,
  certifySamOperatingReadiness,
  type ProviderOnboardingPacket,
  type SamPriceEvidence,
} from './sam-operating-system.js'
import {
  assessProviderContinuity,
  discoveryChannelRequiresCorroboration,
  summarizePrimeAccount,
} from './sam-operating-context.js'

const capture=assessSamCapture({opportunityId:'sam:1',stage:'sources_sought',buyingOfficeKnown:true,responseRequested:true})
assert.equal(capture.captureValue,'high')
assert.equal(capture.awardReadiness,'developing')
assert.equal(capture.bidSubmissionAuthorized,false)

const candidates=Array.from({length:3},(_,i)=>({
  providerId:'p'+i,
  requirementIds:['r1'],
  discoveryChannels:['sam_award','web_search'] as const,
  evidenceRefs:['e'+i],
  qualified:true,
}))
const constrained=assessProviderBench(candidates,{targetCandidateCount:5,marketConstrained:true})
assert.equal(constrained.status,'MARKET_CONSTRAINED')
assert.equal(constrained.targetCandidateCount,5)

const modelOnly:SamPriceEvidence[]=[{id:'m',kind:'MODEL_ONLY_ESTIMATE',amount:100,currency:'USD',scopeRef:'r1',evidenceRef:'model:1',assumptions:['planning only']}]
assert.equal(assessQuoteCoverage(modelOnly).confidence,'LOW')
assert(assessQuoteCoverage(modelOnly).blockers.some(x=>x.includes('Model-only')))

const quoted:SamPriceEvidence[]=[
  {id:'q',kind:'FIRM_VENDOR_QUOTE',amount:74000,currency:'USD',scopeRef:'r1',evidenceRef:'quote:1',providerId:'p1',assumptions:[]},
  {id:'h',kind:'HISTORICAL_AWARD_COMPARABLE',amount:72000,currency:'USD',scopeRef:'r1',evidenceRef:'award:1',assumptions:[]},
]
const coverage=assessQuoteCoverage(quoted)
assert.equal(coverage.confidence,'HIGH')
assert.equal(coverage.blockers.length,0)

const pricing=buildSamPricingScenario({
  scenarioId:'price:1',
  strategy:'PRIME_WITH_SUB',
  basis:'monthly',
  evaluationMethod:'lpta',
  periods:[
    {id:'base',label:'Base',quantity:12,unit:'month',unitPrice:8500,evidenceRefs:['sol:price']},
    {id:'oy1',label:'Option 1',quantity:12,unit:'month',unitPrice:8755,escalationBasis:'planning assumption',evidenceRefs:['sol:price']},
  ],
  providerCost:140000,
  overhead:10000,
  contingency:5000,
  financingCost:3000,
})
assert.equal(pricing.totalEvaluatedPrice,207060)
assert.equal(pricing.totalCost,158000)
assert(pricing.estimatedProfit>0)

const fundingBlocked=assessSamFunding({
  events:[
    {id:'deposit',date:'2026-10-01',amount:30000,direction:'OUTFLOW',kind:'provider',certainty:'verified',evidenceRef:'quote:deposit'},
    {id:'balance',date:'2026-10-20',amount:44000,direction:'OUTFLOW',kind:'provider',certainty:'verified',evidenceRef:'quote:balance'},
    {id:'gov',date:'2026-11-20',amount:100000,direction:'INFLOW',kind:'government_receipt',certainty:'estimated',evidenceRef:'award:terms'},
  ],
  availableBusinessCash:25000,
  protectedReserve:0,
  facilities:[{id:'loc',type:'line_of_credit',maximumAvailable:40000,availableFromStage:'AWARD_RECEIVED',estimatedFinanceCost:2500,verified:true,evidenceRefs:['loc:offer']}],
})
assert.equal(fundingBlocked.peakCashRequirement,74000)
assert.equal(fundingBlocked.fundingGap,9000)
assert.equal(fundingBlocked.status,'BLOCKED')

const fundingReady=assessSamFunding({
  events:[
    {id:'deposit',date:'2026-10-01',amount:30000,direction:'OUTFLOW',kind:'provider',certainty:'verified',evidenceRef:'quote:deposit'},
    {id:'balance',date:'2026-10-20',amount:44000,direction:'OUTFLOW',kind:'provider',certainty:'verified',evidenceRef:'quote:balance'},
    {id:'gov',date:'2026-11-20',amount:100000,direction:'INFLOW',kind:'government_receipt',certainty:'verified',evidenceRef:'award:terms'},
  ],
  availableBusinessCash:25000,
  protectedReserve:5000,
  facilities:[{id:'loc',type:'line_of_credit',maximumAvailable:60000,availableFromStage:'AWARD_RECEIVED',estimatedFinanceCost:3000,verified:true,evidenceRefs:['loc:offer']}],
})
assert.equal(fundingReady.usableExecutionCapital,20000)
assert.equal(fundingReady.status,'FUNDED')

const conflict={id:'c1',conflictType:'pricing' as const,sourceRefs:['sol:1','pws:1'],statementA:'monthly',statementB:'itemized',materiality:'high' as const,clarificationRequired:true}
const trace:ProposalTrace={requirementId:'r1',sourceRef:'sol:1',mandatory:true,responseSectionRef:'technical:1',evidenceRefs:['e1'],claimKinds:['PRIME_VERIFIED_FACT']}
const proposalBlocked=assessSamProposalReadiness([trace],[conflict])
assert.equal(proposalBlocked.status,'REVIEW_REQUIRED')
const proposalReady=assessSamProposalReadiness([trace],[{...conflict,resolvedByRef:'amendment:1'}])
assert.equal(proposalReady.status,'READY_FOR_HUMAN_REVIEW')
assert.equal(proposalReady.bidSubmissionAuthorized,false)

const primeSub=assessPrimeSubcontractOpportunity({id:'sub:1',primeId:'prime:1',requirementIds:['network-engineer'],revenue:100000,deliveryCost:70000,financingCost:2500,evidenceRefs:['rfq:1']})
assert.equal(primeSub.status,'review_required')
assert(primeSub.blockers.some(x=>x.includes('payment terms')))

const onboarding:ProviderOnboardingPacket={
  providerId:'p1',
  opportunityId:'sam:1',
  executedSubcontractRef:'subcontract:1',
  confidentialityStatus:'not_required',
  taxDocumentationStatus:'complete',
  paymentTermsRef:'terms:1',
  purchaseOrderRef:'po:1',
  scopeExpectationRefs:['scope:1'],
  qualityCriteriaRefs:['qa:1'],
  siteAccessStatus:'complete',
  acceptanceCriteriaRefs:['accept:1'],
  backupProviderIds:['p2'],
  complianceEvidenceRefs:['compliance:1'],
}
const providerReady=assessProviderReady(onboarding)
assert.equal(providerReady.status,'PROVIDER_READY_FOR_PERFORMANCE')

const preAward=certifySamOperatingReadiness({opportunityId:'sam:1',proposal:proposalReady,pricing,quoteCoverage:coverage,funding:fundingReady})
assert.equal(preAward.status,'READY_FOR_HUMAN_SUBMISSION_REVIEW')
assert.equal(preAward.bidSubmissionAuthorized,false)
assert.equal(preAward.paymentAuthorized,false)

const postAward=certifySamOperatingReadiness({opportunityId:'sam:1',proposal:proposalReady,pricing,quoteCoverage:coverage,funding:fundingReady,provider:providerReady,awardRecorded:true})
assert.equal(postAward.status,'PROVIDER_READY_FOR_PERFORMANCE')
assert.equal(postAward.contractExecutionAuthorized,false)

assert.equal(discoveryChannelRequiresCorroboration('public_social_business_page'),true)
assert.equal(discoveryChannelRequiresCorroboration('sam_award'),false)

const continuity=assessProviderContinuity({providerId:'p1',opportunityId:'sam:1',quoteStillValid:true,primaryContactCurrent:false,capacityReconfirmed:true})
assert.equal(continuity.status,'RECONFIRM_PROVIDER')
assert.equal(continuity.replacementContactRequired,true)

const primePerformance=summarizePrimeAccount('prime:1',[
  {id:'a',primeId:'prime:1',opportunityId:'o1',kind:'rfq_received',occurredAt:'2026-01-01',evidenceRefs:['e1']},
  {id:'b',primeId:'prime:1',opportunityId:'o1',kind:'subcontract_signed',occurredAt:'2026-01-02',evidenceRefs:['e2']},
  {id:'c',primeId:'prime:1',opportunityId:'o1',kind:'payment_received',occurredAt:'2026-02-02',evidenceRefs:['e3'],amount:40000,currency:'USD'},
])
assert.equal(primePerformance.pursuitCount,1)
assert.equal(primePerformance.winCount,1)
assert.equal(primePerformance.recognizedRevenue,40000)
assert.equal(primePerformance.intelligenceOnly,true)

console.log('sam-operating-system tests passed')
