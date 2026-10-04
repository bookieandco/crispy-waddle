import assert from 'node:assert/strict'
import {
  buildAffiliateContributionProof,
} from './side-hustle-affiliate-contribution.js'
import {
  buildSideHustleProfile,
} from './side-hustles.js'
import type {Opportunity} from './opportunity.js'
import type {
  SideHustleAffiliateEvent,
} from './side-hustle-commerce.js'
import type {
  SideHustleExperiment,
  SideHustleExperimentEvaluation,
} from './side-hustle-experiment.js'

const opportunity:Opportunity={
  id:'opportunity:affiliate:contribution',
  title:'Affiliate contribution fixture',
  family:'business',
  type:'commercial',
  sourceName:'fixture',
  sourceUrl:'https://example.test/affiliate',
  claims:[],
  evidence:[],
  verificationStatus:'unverified',
  sourceConfidence:.9,
  riskFlags:[],
  metadata:{sideHustleProfile:buildSideHustleProfile({family:'commerce_affiliate'})},
  status:'ready',
  createdAt:'2026-10-01T00:00:00Z',
  updatedAt:'2026-10-01T00:00:00Z',
}

const experiment:SideHustleExperiment={
  id:'side-hustle-experiment:affiliate:1',
  opportunityId:opportunity.id,
  profile:buildSideHustleProfile({family:'commerce_affiliate'}),
  hypothesis:'Paid affiliate conversions can exceed bounded production spend.',
  targetCustomer:'Qualified buyers',
  channel:'Owned content',
  offer:'Affiliate recommendation',
  maxSpend:50,
  currency:'USD',
  maxHours:6,
  maxDurationDays:14,
  minimumObservations:1,
  successCriteria:[{
    id:'conversion',
    metric:'attributed_conversions',
    operator:'gte',
    threshold:1,
    aggregation:'sum',
    unit:'conversions',
  }],
  killCriteria:[],
  evidenceRefs:['experiment:plan'],
  requiresApproval:true,
  status:'completed',
  createdAt:'2026-10-01T00:00:00Z',
  startedAt:'2026-10-01T01:00:00Z',
  completedAt:'2026-10-03T01:00:00Z',
}

function evaluation(
  spend:number,
  decision:SideHustleExperimentEvaluation['decision']='promote',
):SideHustleExperimentEvaluation{
  return{
    experimentId:experiment.id,
    opportunityId:opportunity.id,
    decision,
    observationCount:2,
    totalSpend:spend,
    totalHours:2,
    successCriteriaMet:decision==='promote'?['conversion']:[],
    successCriteriaMissed:decision==='promote'?[]:['conversion'],
    killCriteriaMet:[],
    evidenceRefs:['experiment:plan','experiment:observation'],
    reasons:[decision==='promote'?'all success criteria met within experiment bounds':'criterion missed'],
    evaluatedAt:'2026-10-03T01:00:00Z',
  }
}

function affiliateEvent(
  input:Partial<SideHustleAffiliateEvent>&
    Pick<SideHustleAffiliateEvent,'id'|'externalEventRef'|'kind'>,
):SideHustleAffiliateEvent{
  return{
    opportunityId:opportunity.id,
    family:'commerce_affiliate',
    programRef:'partnerize:campaign:campaign-7',
    providerRef:'provider:partnerize',
    economicState:'paid',
    evidenceRefs:[`evidence:${input.id}`],
    occurredAt:'2026-10-04T12:00:00Z',
    authority:'AFFILIATE_OBSERVATION_ONLY',
    externalActionAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
    ...input,
  }
}

const conversion=affiliateEvent({
  id:'conversion:1',
  externalEventRef:'partnerize:conversion:conversion-1',
  kind:'conversion',
  economicState:'approved',
  amount:60,
  currency:'USD',
  occurredAt:'2026-10-02T12:00:00Z',
})

const payout=affiliateEvent({
  id:'payout:1',
  externalEventRef:'partnerize:selfbill:selfbill-3:item:item-9',
  kind:'payout',
  economicState:'paid',
  amount:60,
  currency:'USD',
  occurredAt:'2026-10-04T12:00:00Z',
  metadata:{
    conversion_id:'conversion-1',
    conversion_at:'2026-10-02T12:00:00Z',
    selfbill_id:'selfbill-3',
    selfbill_payment_at:'2026-10-04T12:00:00Z',
    settlement_basis:'paid_selfbill_item_no_fx_no_tax',
  },
})

const positive=buildAffiliateContributionProof({
  opportunity,
  experiment,
  evaluation:evaluation(30),
  affiliateEvents:[conversion,payout],
  currency:'USD',
  evaluatedAt:'2026-10-05T00:00:00Z',
})
assert.equal(positive.status,'passed')
assert.equal(positive.calculation.grossRevenue,60)
assert.equal(positive.calculation.directCosts,30)
assert.equal(positive.calculation.profit,30)
assert.equal(positive.calculation.margin,.5)
assert.equal(positive.calculation.dollarsPerHour,15)
assert.deepEqual(positive.payoutEventIds,['payout:1'])
assert.equal(positive.canonicalOutcomePersisted,false)

const reversal=affiliateEvent({
  id:'reversal:1',
  externalEventRef:'partnerize:reversal:1',
  kind:'reversal',
  economicState:'rejected',
  amount:20,
  currency:'USD',
  occurredAt:'2026-10-04T18:00:00Z',
})
const reversalAdjusted=buildAffiliateContributionProof({
  opportunity,
  experiment,
  evaluation:evaluation(30),
  affiliateEvents:[conversion,payout,reversal],
  currency:'USD',
  evaluatedAt:'2026-10-05T00:00:00Z',
})
assert.equal(reversalAdjusted.calculation.refunds,20)
assert.equal(reversalAdjusted.calculation.profit,10)
assert.equal(reversalAdjusted.status,'passed')

const unprofitable=buildAffiliateContributionProof({
  opportunity,
  experiment,
  evaluation:evaluation(80),
  affiliateEvents:[conversion,payout],
  currency:'USD',
  evaluatedAt:'2026-10-05T00:00:00Z',
})
assert.equal(unprofitable.status,'blocked')
assert.equal(unprofitable.calculation.profit,-20)
assert.ok(unprofitable.blockers.some(value=>value.includes('non-positive contribution')))

const notPromoted=buildAffiliateContributionProof({
  opportunity,
  experiment,
  evaluation:evaluation(10,'iterate'),
  affiliateEvents:[conversion,payout],
  currency:'USD',
  evaluatedAt:'2026-10-05T00:00:00Z',
})
assert.equal(notPromoted.status,'blocked')
assert.ok(notPromoted.blockers.some(value=>value.includes('not promote')))

const rejectedConversion=buildAffiliateContributionProof({
  opportunity,
  experiment,
  evaluation:evaluation(10),
  affiliateEvents:[
    {...conversion,economicState:'rejected'},
    payout,
  ],
  currency:'USD',
  evaluatedAt:'2026-10-05T00:00:00Z',
})
assert.equal(rejectedConversion.status,'blocked')
assert.equal(rejectedConversion.calculation.grossRevenue,0)
assert.ok(rejectedConversion.blockers.some(value=>value.includes('conversion state is rejected')))

const outsideWindow=buildAffiliateContributionProof({
  opportunity,
  experiment,
  evaluation:evaluation(10),
  affiliateEvents:[
    conversion,
    {
      ...payout,
      id:'payout:outside',
      externalEventRef:'partnerize:selfbill:selfbill-4:item:item-10',
      metadata:{
        ...payout.metadata!,
        conversion_id:'conversion-outside',
        conversion_at:'2026-09-20T12:00:00Z',
      },
    },
  ],
  currency:'USD',
  evaluatedAt:'2026-10-05T00:00:00Z',
})
assert.equal(outsideWindow.status,'blocked')
assert.equal(outsideWindow.calculation.grossRevenue,0)

assert.throws(()=>buildAffiliateContributionProof({
  opportunity,
  experiment,
  evaluation:evaluation(10),
  affiliateEvents:[conversion,payout],
  currency:'EUR',
  evaluatedAt:'2026-10-05T00:00:00Z',
}),/FX inference is not allowed/)


const tiktokConversion:SideHustleAffiliateEvent={
  ...conversion,
  id:'tiktok-conversion:1',
  programRef:'tiktok:collaboration:1',
  providerRef:'provider:tiktok-shop-affiliate',
  externalEventRef:'tiktok:affiliate-order:order-1',
}
const tiktokPayout:SideHustleAffiliateEvent={
  ...payout,
  id:'tiktok-payout:1',
  programRef:'tiktok:collaboration:1',
  providerRef:'provider:tiktok-shop-affiliate',
  externalEventRef:'tiktok:affiliate-payout:payout-1',
  metadata:{
    conversion_id:'order-1',
    conversion_external_ref:'tiktok:affiliate-order:order-1',
    conversion_at:'2026-10-02T12:00:00Z',
    settlement_basis:'tiktok_creator_paid_payout_no_fx',
    source_kind:'affiliate_settlement_report',
  },
}
const tiktokPositive=buildAffiliateContributionProof({
  opportunity,
  experiment,
  evaluation:evaluation(20),
  affiliateEvents:[tiktokConversion,tiktokPayout],
  currency:'USD',
  evaluatedAt:'2026-10-05T00:00:00Z',
})
assert.equal(tiktokPositive.status,'passed')
assert.equal(tiktokPositive.calculation.grossRevenue,60)
assert.deepEqual(tiktokPositive.payoutEventIds,['tiktok-payout:1'])

console.log('side hustle affiliate contribution proof tests passed')
