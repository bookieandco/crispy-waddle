import assert from 'node:assert/strict'
import type { Opportunity } from './opportunity.js'
import { buildSideHustleProfile } from './side-hustles.js'
import {
  activateSideHustleCommerceOffer,
  createSideHustleCommerceOffer,
  createSideHustleDirectoryListing,
  endSideHustleEntitlement,
  grantSideHustleEntitlement,
  observeSideHustleSubscription,
  recordSideHustleAffiliateEvent,
  recordSideHustleDigitalDelivery,
  recordSideHustleRefundReversal,
  SIDE_HUSTLE_REVENUE_PRODUCT_FAMILIES,
  sideHustleCommerceRecordKind,
  transitionSideHustleDirectoryListing,
} from './side-hustle-commerce.js'

const now='2026-10-03T14:00:00.000Z'

function opportunity(family:Parameters<typeof buildSideHustleProfile>[0]['family']):Opportunity{
  return {
    id:`opportunity:commerce:${family}`,
    title:'Commerce fixture',
    family:'business',
    type:'commercial',
    sourceName:'Commerce test',
    sourceUrl:'https://example.test/commerce',
    claims:[],
    evidence:[],
    verificationStatus:'unverified',
    sourceConfidence:.9,
    riskFlags:[],
    metadata:{sideHustleProfile:buildSideHustleProfile({family})},
    status:'ready',
    createdAt:now,
    updatedAt:now,
  }
}

const modeByFamily={
  digital_products:'digital_file',
  software_apps:'software_access',
  communities:'community_access',
  directories_marketplaces:'directory_listing',
} as const

for(const family of SIDE_HUSTLE_REVENUE_PRODUCT_FAMILIES){
  const cadence=family==='communities'?'monthly':'one_time'
  const draft=createSideHustleCommerceOffer({
    opportunity:opportunity(family),
    id:`offer:${family}:1`,
    title:`${family} offer`,
    description:'Test offer',
    billing:{amount:25,currency:'usd',cadence},
    deliveryMode:modeByFamily[family],
    evidenceRefs:['evidence:offer'],
    createdAt:now,
  })
  assert.equal(draft.status,'draft')
  assert.equal(draft.externalActionAuthorized,false)
  assert.equal(draft.paymentAuthorized,false)
  assert.equal(sideHustleCommerceRecordKind(draft),'offer')

  const active=activateSideHustleCommerceOffer({
    offer:draft,
    evidenceRefs:['evidence:activate'],
    activatedAt:'2026-10-03T14:01:00.000Z',
  })
  assert.equal(active.status,'active')

  const entitlement=grantSideHustleEntitlement({
    offer:active,
    id:`entitlement:${family}:1`,
    customerRef:'relationship:customer:1',
    sourceTransactionRef:'transaction:1',
    evidenceRefs:['evidence:payment'],
    grantedAt:'2026-10-03T14:02:00.000Z',
  })
  assert.equal(entitlement.status,'active')
  assert.equal(entitlement.paymentAuthorized,false)
  assert.equal(sideHustleCommerceRecordKind(entitlement),'entitlement')

  const delivery=recordSideHustleDigitalDelivery({
    offer:active,
    entitlement,
    id:`delivery:${family}:1`,
    deliveryRef:'delivery:1',
    artifactRefs:['artifact:1'],
    evidenceRefs:['evidence:delivery'],
    deliveredAt:'2026-10-03T14:03:00.000Z',
  })
  assert.equal(delivery.externalActionAuthorized,false)
  assert.equal(sideHustleCommerceRecordKind(delivery),'delivery')

  const ended=endSideHustleEntitlement({
    entitlement,
    status:'revoked',
    reason:'Refunded',
    evidenceRefs:['evidence:revoke'],
    endedAt:'2026-10-03T14:04:00.000Z',
  })
  assert.equal(ended.status,'revoked')
}

const recurringOffer=activateSideHustleCommerceOffer({
  offer:createSideHustleCommerceOffer({
    opportunity:opportunity('software_apps'),
    id:'offer:software:monthly',
    title:'Software monthly',
    description:'Monthly software access',
    billing:{amount:49,currency:'USD',cadence:'monthly'},
    deliveryMode:'software_access',
    evidenceRefs:['evidence:offer'],
    createdAt:now,
  }),
  evidenceRefs:['evidence:activate'],
  activatedAt:'2026-10-03T14:01:00.000Z',
})
const subscription=observeSideHustleSubscription({
  offer:recurringOffer,
  id:'subscription:1',
  customerRef:'relationship:customer:1',
  providerRef:'stripe:sub_1',
  status:'active',
  periodStart:'2026-10-03T00:00:00.000Z',
  periodEnd:'2026-11-03T00:00:00.000Z',
  transactionRef:'stripe:invoice:1',
  evidenceRefs:['evidence:provider'],
  observedAt:'2026-10-03T14:05:00.000Z',
})
assert.equal(subscription.status,'active')
assert.equal(subscription.paymentAuthorized,false)
assert.equal(sideHustleCommerceRecordKind(subscription),'subscription_observation')

const listingOffer=activateSideHustleCommerceOffer({
  offer:createSideHustleCommerceOffer({
    opportunity:opportunity('directories_marketplaces'),
    id:'offer:directory:1',
    title:'Featured listing',
    description:'Directory listing',
    billing:{amount:20,currency:'USD',cadence:'monthly'},
    deliveryMode:'directory_listing',
    evidenceRefs:['evidence:offer'],
    createdAt:now,
  }),
  evidenceRefs:['evidence:activate'],
  activatedAt:'2026-10-03T14:01:00.000Z',
})
let listing=createSideHustleDirectoryListing({
  offer:listingOffer,
  id:'listing:1',
  ownerRef:'relationship:business:1',
  title:'Test business',
  summary:'Evidence-backed listing.',
  evidenceRefs:['evidence:listing'],
  createdAt:'2026-10-03T14:02:00.000Z',
})
listing=transitionSideHustleDirectoryListing({
  listing,status:'pending_review',evidenceRefs:['evidence:submitted'],observedAt:'2026-10-03T14:03:00.000Z',
})
listing=transitionSideHustleDirectoryListing({
  listing,status:'approved',evidenceRefs:['evidence:moderated'],observedAt:'2026-10-03T14:04:00.000Z',
})
listing=transitionSideHustleDirectoryListing({
  listing,status:'published',evidenceRefs:['evidence:published'],observedAt:'2026-10-03T14:05:00.000Z',
})
assert.equal(listing.status,'published')
assert.equal(listing.externalActionAuthorized,false)
assert.equal(sideHustleCommerceRecordKind(listing),'listing')

const refund=recordSideHustleRefundReversal({
  offer:recurringOffer,
  id:'refund:1',
  customerRef:'relationship:customer:1',
  transactionRef:'stripe:refund:1',
  amount:49,
  reason:'Customer refund',
  evidenceRefs:['evidence:refund'],
  observedAt:'2026-10-03T14:06:00.000Z',
})
assert.equal(refund.moneyMovementAuthorized,false)
assert.equal(sideHustleCommerceRecordKind(refund),'refund_reversal')

const affiliateOpportunity=opportunity('commerce_affiliate')
for(const kind of ['click','conversion','reversal','payout'] as const){
  const event=recordSideHustleAffiliateEvent({
    opportunity:affiliateOpportunity,
    id:`affiliate:${kind}:1`,
    programRef:'program:1',
    providerRef:'provider:affiliate:1',
    externalEventRef:`external:${kind}:1`,
    kind,
    amount:kind==='click'?undefined:10,
    currency:kind==='click'?undefined:'USD',
    evidenceRefs:['evidence:affiliate'],
    occurredAt:now,
  })
  assert.equal(event.externalActionAuthorized,false)
  assert.equal(event.moneyMovementAuthorized,false)
  assert.equal(sideHustleCommerceRecordKind(event),'affiliate_event')
}

assert.throws(()=>createSideHustleCommerceOffer({
  opportunity:opportunity('communities'),
  id:'offer:bad-community',
  title:'Bad community',
  description:'One-time membership is invalid',
  billing:{amount:20,currency:'USD',cadence:'one_time'},
  deliveryMode:'community_access',
  evidenceRefs:['evidence:bad'],
  createdAt:now,
}),/recurring billing/)

assert.throws(()=>recordSideHustleAffiliateEvent({
  opportunity:opportunity('digital_products'),
  id:'affiliate:bad',
  programRef:'program:1',
  providerRef:'provider:1',
  externalEventRef:'external:1',
  kind:'click',
  evidenceRefs:['evidence:bad'],
  occurredAt:now,
}),/commerce_affiliate/)

console.log('side hustle commerce tests passed')
