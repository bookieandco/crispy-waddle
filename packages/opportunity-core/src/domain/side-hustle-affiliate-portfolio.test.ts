import assert from 'node:assert/strict'
import type { SideHustleAffiliateEvent } from './side-hustle-commerce.js'
import {
  latestSideHustleAffiliateStates,
  summarizeSideHustleAffiliatePortfolio,
} from './side-hustle-affiliate-portfolio.js'

const opportunityId='opportunity:affiliate:truth'
const providerRef='provider:cj-affiliate'
const programRef='cj:advertiser:200'

function event(input:Partial<SideHustleAffiliateEvent> & Pick<SideHustleAffiliateEvent,'id'|'externalEventRef'|'kind'>):SideHustleAffiliateEvent{
  return {
    opportunityId,
    family:'commerce_affiliate',
    programRef,
    providerRef,
    evidenceRefs:[`evidence:${input.id}`],
    occurredAt:'2026-10-03T12:00:00.000Z',
    authority:'AFFILIATE_OBSERVATION_ONLY',
    externalActionAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
    ...input,
  }
}

const events:SideHustleAffiliateEvent[]=[
  event({id:'click:1',externalEventRef:'click:1',kind:'click'}),
  event({id:'click:2',externalEventRef:'click:2',kind:'click'}),
  event({
    id:'conversion:pending',
    externalEventRef:'commission:1',
    kind:'conversion',
    providerStatus:'NEW:PENDING',
    economicState:'pending',
    amount:20,
    currency:'USD',
  }),
  event({
    id:'conversion:approved',
    externalEventRef:'commission:1',
    kind:'conversion',
    providerStatus:'LOCKED:ACCEPTED',
    economicState:'approved',
    amount:20,
    currency:'USD',
  }),
  event({
    id:'conversion:rejected',
    externalEventRef:'commission:2',
    kind:'conversion',
    providerStatus:'DECLINED',
    economicState:'rejected',
    amount:10,
    currency:'USD',
  }),
  event({
    id:'reversal:1',
    externalEventRef:'correction:1',
    kind:'reversal',
    economicState:'rejected',
    amount:5,
    currency:'USD',
  }),
]

const summary=summarizeSideHustleAffiliatePortfolio(events)
assert.equal(summary.rawEventCount,6)
assert.equal(summary.canonicalEventCount,5)
assert.equal(summary.programs.length,1)

const program=summary.programs[0]
assert.equal(program.clickCount,2)
assert.equal(program.conversionCount,2)
assert.equal(program.pendingConversionCount,0)
assert.equal(program.approvedConversionCount,1)
assert.equal(program.rejectedConversionCount,1)
assert.equal(program.approvalRate,.5)
assert.equal(program.rejectionRate,.5)
assert.equal(program.conversionRate,1)
assert.equal(program.hasRealizedPayoutEvidence,false)

const usd=program.currencies[0]
assert.equal(usd.approvedCommissionAmount,20)
assert.equal(usd.rejectedCommissionAmount,10)
assert.equal(usd.reversalAmount,5)
assert.equal(usd.netApprovedAfterReversals,15)
assert.equal(usd.approvedEpc,7.5)
assert.equal(usd.realizedRevenueAmount,0)
assert.equal(usd.realizedPayoutEpc,0)
assert.equal(summary.warning,'APPROVED_COMMISSION_IS_NOT_REALIZED_REVENUE')

const paidStateOnly=summarizeSideHustleAffiliatePortfolio([
  event({id:'click:3',externalEventRef:'click:3',kind:'click'}),
  event({
    id:'commission:paid-state',
    externalEventRef:'commission:paid-state',
    kind:'conversion',
    economicState:'paid',
    amount:50,
    currency:'USD',
  }),
])
assert.equal(paidStateOnly.programs[0].currencies[0].paidStateCommissionAmount,50)
assert.equal(paidStateOnly.programs[0].currencies[0].realizedRevenueAmount,0)
assert.equal(paidStateOnly.programs[0].hasRealizedPayoutEvidence,false)

const withPayout=summarizeSideHustleAffiliatePortfolio([
  ...events,
  event({
    id:'payout:1',
    externalEventRef:'payout:1',
    kind:'payout',
    economicState:'paid',
    amount:15,
    currency:'USD',
    occurredAt:'2026-10-04T12:00:00.000Z',
  }),
])
assert.equal(withPayout.programs[0].payoutCount,1)
assert.equal(withPayout.programs[0].currencies[0].realizedRevenueAmount,15)
assert.equal(withPayout.programs[0].currencies[0].realizedPayoutEpc,7.5)
assert.equal(withPayout.programs[0].hasRealizedPayoutEvidence,true)

// Same provider transaction timestamp, conflicting states: fail financially
// conservative so stale approval cannot beat a rejection.
const sameTime=latestSideHustleAffiliateStates([
  event({
    id:'same:approved',
    externalEventRef:'commission:same',
    kind:'conversion',
    economicState:'approved',
    amount:30,
    currency:'USD',
  }),
  event({
    id:'same:rejected',
    externalEventRef:'commission:same',
    kind:'conversion',
    economicState:'rejected',
    amount:30,
    currency:'USD',
  }),
])
assert.equal(sameTime.length,1)
assert.equal(sameTime[0].economicState,'rejected')

assert.throws(
  ()=>summarizeSideHustleAffiliatePortfolio([
    event({id:'one',externalEventRef:'one',kind:'click'}),
    {...event({id:'two',externalEventRef:'two',kind:'click'}),opportunityId:'opportunity:other'},
  ]),
  /multiple opportunities/,
)

console.log('side hustle affiliate portfolio truth tests passed')
