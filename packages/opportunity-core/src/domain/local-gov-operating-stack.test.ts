import assert from 'node:assert/strict'
import { assessContractPrecheck, assessRetainage, assessTerminationConvenience } from './contract-precheck.js'
import { assessFulfillmentIncident, assessProviderAuthority, assessProviderRedundancy } from './provider-network-governance.js'
import { assessPublicProcurementPath, assessSpecificationIntegrity, summarizeProcurementPathEconomics } from './public-procurement-path.js'

const retainage=assessRetainage({
  percentage:10,
  appliesTo:'progress_payments',
  releaseWithinDays:30,
  reductionMilestones:[],
  sourceRef:'subcontract:payment',
  releaseConditions:[
    {id:'closeout',label:'Closeout documents',control:'controlled',sourceRef:'subcontract:payment',requiredDocumentRefs:['final-waiver'],satisfied:false},
    {id:'owner-pay',label:'Prime receives owner final payment',control:'external',sourceRef:'subcontract:payment',requiredDocumentRefs:[],satisfied:'unknown'},
  ],
},10000)
assert.equal(retainage.status,'HIGH_UPSTREAM_DEPENDENCY')
assert.equal(retainage.externallyDependentAmount,10000)
assert.ok(retainage.cashReleaseControlScore<100)

const termination=assessTerminationConvenience({
  trigger:'prime_discretionary',
  payable:['performed_work'],
  excluded:['profit_on_unperformed_work','unabsorbed_overhead','consequential_damages'],
  settlementDeadlineDays:30,
  upstreamRecoveryCap:true,
  requiredRecordRefs:['job-cost-ledger'],
  sourceRef:'subcontract:termination',
})
assert.equal(termination.status,'HIGH_EXPOSURE')
assert.equal(termination.deadlineRisk,'SHORT')
assert.equal(termination.upstreamDependency,'PRESENT')

const precheck=assessContractPrecheck({
  opportunityId:'local:1',
  retainage:{
    percentage:10,
    appliesTo:'progress_payments',
    releaseWithinDays:30,
    reductionMilestones:[],
    sourceRef:'subcontract:payment',
    releaseConditions:[
      {id:'owner-pay',label:'Prime receives owner payment',control:'external',sourceRef:'subcontract:payment',requiredDocumentRefs:[],satisfied:'unknown'},
    ],
  },
  retainedAmount:10000,
  terminationForConvenience:{
    trigger:'government_flowdown_only',
    payable:['performed_work','materials','settlement_expense','profit_on_performed_work'],
    excluded:['profit_on_unperformed_work'],
    settlementDeadlineDays:90,
    upstreamRecoveryCap:'unknown',
    requiredRecordRefs:['cost-ledger'],
    sourceRef:'subcontract:termination',
  },
  referencedDocumentRefs:['exhibit-d','closeout-checklist'],
  suppliedDocumentRefs:['closeout-checklist'],
  sourceRefs:['subcontract'],
})
assert.equal(precheck.status,'HIGH_RISK')
assert.deepEqual(precheck.missingReferencedDocumentRefs,['exhibit-d'])
assert.equal(precheck.contractExecutionAuthorized,false)

const observations=Array.from({length:8},(_,index)=>({
  id:`obs:${index}`,
  providerId:'provider:a',
  opportunityId:`job:${index}`,
  completedAt:`2026-09-${String(index+1).padStart(2,'0')}T00:00:00Z`,
  technicalQuality:95,
  onTime:true,
  communicationScore:92,
  closeoutScore:91,
  reworkCost:0,
  contractValue:10000,
  customerComplaint:false,
  evidenceRefs:[`e:${index}`],
}))
const authority=assessProviderAuthority('provider:a',observations)
assert.equal(authority.grade,'A')
assert.equal(authority.authorityLevel,4)
assert.equal(authority.automaticCustomerCommunicationAuthorized,false)

const redundancy=assessProviderRedundancy({
  trade:'HVAC',
  state:'CA',
  county:'Los Angeles',
  asOf:'2026-09-30T00:00:00Z',
  slots:[
    {providerId:'a',trade:'HVAC',state:'CA',county:'Los Angeles',availableFrom:'2026-09-01T00:00:00Z',capacityStatus:'available',evidenceRefs:['a']},
    {providerId:'b',trade:'HVAC',state:'CA',county:'Los Angeles',availableFrom:'2026-09-01T00:00:00Z',capacityStatus:'available',evidenceRefs:['b']},
    {providerId:'c',trade:'HVAC',state:'CA',county:'Los Angeles',availableFrom:'2026-09-01T00:00:00Z',capacityStatus:'available',evidenceRefs:['c']},
  ],
})
assert.equal(redundancy.status,'RESILIENT')
assert.equal(redundancy.salesExpansionSafe,true)

const incident=assessFulfillmentIncident({
  id:'incident:1',
  providerId:'a',
  opportunityId:'job:1',
  cause:'provider_error',
  customerStabilized:true,
  repairCost:500,
  responsibility:'provider',
  evidenceRefs:['incident:evidence'],
  regressionRuleCreated:true,
})
assert.equal(incident.closeoutStatus,'READY_TO_CLOSE')
assert.equal(incident.paymentAuthority,false)

const coop=assessPublicProcurementPath({
  id:'vehicle:1',
  path:'cooperative_contract',
  buyerEntityRef:'buyer:1',
  vehicleRef:'coop:1',
  authorityRef:'authority:1',
  scopeMatch:true,
  buyerEligible:true,
  supplierStatus:'authorized_dealer',
  active:true,
  evidenceRefs:['vehicle:evidence'],
})
assert.equal(coop.status,'ELIGIBLE')
assert.equal(coop.directAwardGuaranteed,false)

const noVehicle=assessPublicProcurementPath({
  id:'vehicle:2',
  path:'cooperative_contract',
  buyerEntityRef:'buyer:1',
  authorityRef:'authority:1',
  scopeMatch:true,
  buyerEligible:true,
  supplierStatus:'not_on_vehicle',
  active:true,
  evidenceRefs:['vehicle:evidence'],
})
assert.equal(noVehicle.status,'REVIEW_REQUIRED')

const blockedSpec=assessSpecificationIntegrity({
  id:'spec:1',
  opportunityId:'opp:1',
  kind:'brand_or_proprietary',
  statement:'Require only our preferred brand.',
  evidenceRefs:['tech:evidence'],
  equivalentCompetitionPreserved:false,
})
assert.equal(blockedSpec.status,'BLOCK')
assert.equal(blockedSpec.procurementInfluenceAuthorized,false)

const summary=summarizeProcurementPathEconomics('open_bid',[
  {id:'econ:1',opportunityId:'opp:1',path:'open_bid',competedBidderCount:8,estimatingCost:5000,acquisitionCost:1000,contractRevenue:100000,deliveryCost:85000,changeOrderCost:0,recognizedGrossProfit:15000,evidenceRefs:['econ:e1']},
  {id:'econ:2',opportunityId:'opp:2',path:'open_bid',competedBidderCount:10,estimatingCost:3000,acquisitionCost:800,contractRevenue:200000,deliveryCost:170000,changeOrderCost:0,recognizedGrossProfit:30000,evidenceRefs:['econ:e2']},
])
assert.equal(summary.observations,2)
assert.equal(summary.averageGrossMarginPercent,15)
assert.equal(summary.intelligenceOnly,true)

console.log('local government operating stack tests passed')
