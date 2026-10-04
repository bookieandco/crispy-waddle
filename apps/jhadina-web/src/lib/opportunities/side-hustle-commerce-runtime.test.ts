import {describe,expect,it} from 'vitest'
import {
  buildSideHustleProfile,
  type Opportunity,
  type SideHustleCommerceRecord,
  type SideHustleCommerceRecordKind,
} from '@jhadina/opportunity-core'
import type {StoredCanonicalOpportunity} from './canonical'
import type {StoredSideHustleCommerceRecord} from './supabase-opportunity-repository'
import {
  activateSideHustleCommerceOfferRuntime,
  createSideHustleCommerceOfferRuntime,
  createSideHustleDirectoryListingRuntime,
  grantSideHustleEntitlementRuntime,
  observeSideHustleSubscriptionRuntime,
  recordSideHustleAffiliateEventRuntime,
  recordSideHustleDigitalDeliveryRuntime,
  recordSideHustleRefundReversalRuntime,
  summarizeSideHustleCommerceRuntime,
  transitionSideHustleDirectoryListingRuntime,
  type SideHustleCommercePersistence,
} from './side-hustle-commerce-runtime'

const now='2026-10-03T14:30:00.000Z'

function makeOpportunity(id:string,family:Parameters<typeof buildSideHustleProfile>[0]['family']):Opportunity{
  return {
    id,title:id,family:'business',type:'commercial',
    sourceName:'commerce runtime test',sourceUrl:'https://example.test/runtime',
    claims:[],evidence:[],verificationStatus:'unverified',sourceConfidence:.9,riskFlags:[],
    metadata:{sideHustleProfile:buildSideHustleProfile({family})},
    status:'ready',createdAt:now,updatedAt:now,
  }
}

function recordedAt(kind:SideHustleCommerceRecordKind,record:any):string{
  if(kind==='offer'||kind==='listing')return record.updatedAt
  if(kind==='entitlement')return record.endedAt??record.grantedAt
  if(kind==='subscription_observation'||kind==='refund_reversal')return record.observedAt
  if(kind==='delivery')return record.deliveredAt
  return record.occurredAt
}

function fixture(){
  const product=makeOpportunity('opportunity:software','software_apps')
  const directory=makeOpportunity('opportunity:directory','directories_marketplaces')
  const affiliate=makeOpportunity('opportunity:affiliate','commerce_affiliate')
  const opportunities=new Map<string,StoredCanonicalOpportunity>([
    [product.id,{userId:'owner:test',opportunity:product,triageState:'saved'}],
    [directory.id,{userId:'owner:test',opportunity:directory,triageState:'saved'}],
    [affiliate.id,{userId:'owner:test',opportunity:affiliate,triageState:'saved'}],
  ])
  const records=new Map<string,StoredSideHustleCommerceRecord>()
  const repository:SideHustleCommercePersistence={
    async get(id){return opportunities.get(id)},
    async getSideHustleCommerceRecord(id){return records.get(id)},
    async listSideHustleCommerceRecords(input={}){
      return [...records.values()].filter(row=>
        (!input.opportunityId||row.opportunityId===input.opportunityId)&&
        (!input.family||row.family===input.family)&&
        (!input.kind||row.kind===input.kind)
      )
    },
    async saveSideHustleCommerceRecord(kind,record){
      const existing=records.get(record.id)
      if(existing&&existing.kind!==kind)throw new Error('kind mismatch')
      records.set(record.id,{
        id:record.id,
        opportunityId:record.opportunityId,
        family:record.family,
        kind,
        status:'status' in record?String(record.status):undefined,
        payload:structuredClone(record) as SideHustleCommerceRecord,
        recordedAt:recordedAt(kind,record),
      })
      return record
    },
  }
  return {repository,records}
}

describe('Side Hustle commerce runtime',()=>{
  it('persists a complete software entitlement and delivery lifecycle',async()=>{
    const f=fixture()
    let offer=await createSideHustleCommerceOfferRuntime({
      opportunityId:'opportunity:software',
      id:'offer:software:1',
      title:'Software access',
      description:'Monthly access',
      billing:{amount:49,currency:'USD',cadence:'monthly'},
      deliveryMode:'software_access',
      evidenceRefs:['evidence:offer'],
      createdAt:now,
    },f.repository)
    expect(offer.status).toBe('draft')

    offer=await activateSideHustleCommerceOfferRuntime({
      offerId:offer.id,evidenceRefs:['evidence:activate'],activatedAt:'2026-10-03T14:31:00.000Z',
    },f.repository)
    expect(offer.status).toBe('active')

    const entitlement=await grantSideHustleEntitlementRuntime({
      offerId:offer.id,
      id:'entitlement:software:1',
      customerRef:'relationship:customer:1',
      sourceTransactionRef:'transaction:1',
      evidenceRefs:['evidence:payment'],
      grantedAt:'2026-10-03T14:32:00.000Z',
    },f.repository)
    expect(entitlement.paymentAuthorized).toBe(false)

    const subscription=await observeSideHustleSubscriptionRuntime({
      offerId:offer.id,
      id:'subscription:software:1',
      customerRef:'relationship:customer:1',
      providerRef:'stripe:sub_1',
      status:'active',
      transactionRef:'stripe:invoice:1',
      evidenceRefs:['evidence:stripe'],
      observedAt:'2026-10-03T14:33:00.000Z',
    },f.repository)
    expect(subscription.externalActionAuthorized).toBe(false)

    const delivery=await recordSideHustleDigitalDeliveryRuntime({
      offerId:offer.id,
      entitlementId:entitlement.id,
      id:'delivery:software:1',
      deliveryRef:'access:workspace:1',
      artifactRefs:['workspace:1'],
      evidenceRefs:['evidence:access'],
      deliveredAt:'2026-10-03T14:34:00.000Z',
    },f.repository)
    expect(delivery.customerRef).toBe('relationship:customer:1')

    const refund=await recordSideHustleRefundReversalRuntime({
      offerId:offer.id,
      id:'refund:software:1',
      customerRef:'relationship:customer:1',
      transactionRef:'stripe:refund:1',
      amount:49,
      reason:'Customer refund',
      evidenceRefs:['evidence:refund'],
      observedAt:'2026-10-03T14:35:00.000Z',
    },f.repository)
    expect(refund.moneyMovementAuthorized).toBe(false)

    const summary=await summarizeSideHustleCommerceRuntime({opportunityId:'opportunity:software'},f.repository)
    expect(summary).toMatchObject({
      offers:1,activeEntitlements:1,subscriptionObservations:1,deliveries:1,refundReversals:1,
      externalActionAuthorized:false,moneyMovementAuthorized:false,
    })
  })

  it('runs directory listing moderation as durable lifecycle state',async()=>{
    const f=fixture()
    let offer=await createSideHustleCommerceOfferRuntime({
      opportunityId:'opportunity:directory',
      id:'offer:directory:1',
      title:'Featured listing',
      description:'Monthly listing',
      billing:{amount:20,currency:'USD',cadence:'monthly'},
      deliveryMode:'directory_listing',
      evidenceRefs:['evidence:offer'],
      createdAt:now,
    },f.repository)
    offer=await activateSideHustleCommerceOfferRuntime({
      offerId:offer.id,evidenceRefs:['evidence:activate'],activatedAt:'2026-10-03T14:31:00.000Z',
    },f.repository)
    let listing=await createSideHustleDirectoryListingRuntime({
      offerId:offer.id,id:'listing:1',ownerRef:'relationship:business:1',
      title:'Business One',summary:'Verified business listing.',
      evidenceRefs:['evidence:listing'],createdAt:'2026-10-03T14:32:00.000Z',
    },f.repository)
    listing=await transitionSideHustleDirectoryListingRuntime({
      listingId:listing.id,status:'pending_review',evidenceRefs:['evidence:submit'],
      observedAt:'2026-10-03T14:33:00.000Z',
    },f.repository)
    listing=await transitionSideHustleDirectoryListingRuntime({
      listingId:listing.id,status:'approved',evidenceRefs:['evidence:moderation'],
      observedAt:'2026-10-03T14:34:00.000Z',moderationNote:'Evidence verified.',
    },f.repository)
    listing=await transitionSideHustleDirectoryListingRuntime({
      listingId:listing.id,status:'published',evidenceRefs:['evidence:publish'],
      observedAt:'2026-10-03T14:35:00.000Z',
    },f.repository)
    expect(listing.status).toBe('published')
    expect(listing.externalActionAuthorized).toBe(false)
  })

  it('ingests affiliate clicks, conversions, reversals and payouts as observations only',async()=>{
    const f=fixture()
    for(const kind of ['click','conversion','reversal','payout'] as const){
      const event=await recordSideHustleAffiliateEventRuntime({
        opportunityId:'opportunity:affiliate',
        id:`affiliate:${kind}:1`,
        programRef:'program:1',providerRef:'provider:1',externalEventRef:`external:${kind}:1`,
        kind,
        providerStatus:kind==='conversion'?'pending':undefined,
        economicState:kind==='conversion'?'pending':kind==='payout'?'paid':'unknown',
        amount:kind==='click'?undefined:12,currency:kind==='click'?undefined:'USD',
        evidenceRefs:['evidence:affiliate'],occurredAt:now,
      },f.repository)
      expect(event.paymentAuthorized).toBe(false)
      expect(event.moneyMovementAuthorized).toBe(false)
      if(kind==='conversion')expect(event.economicState).toBe('pending')
    }
    const summary=await summarizeSideHustleCommerceRuntime({opportunityId:'opportunity:affiliate'},f.repository)
    expect(summary.affiliateEvents).toBe(4)
  })
})
