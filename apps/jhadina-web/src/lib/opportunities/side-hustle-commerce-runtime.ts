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
  retireSideHustleCommerceOffer,
  sideHustleCommerceRecordKind,
  transitionSideHustleDirectoryListing,
  type SideHustleAffiliateEconomicState,
  type SideHustleAffiliateEvent,
  type SideHustleAffiliateEventKind,
  type SideHustleBillingCadence,
  type SideHustleCommerceOffer,
  type SideHustleCommerceRecord,
  type SideHustleCommerceRecordKind,
  type SideHustleDeliveryMode,
  type SideHustleDirectoryListing,
  type SideHustleDirectoryListingStatus,
  type SideHustleDigitalDeliveryReceipt,
  type SideHustleEntitlement,
  type SideHustleSubscriptionObservation,
  type SideHustleSubscriptionStatus,
} from '@jhadina/opportunity-core'
import type { StoredCanonicalOpportunity } from './canonical'
import type { StoredSideHustleCommerceRecord } from './supabase-opportunity-repository'

export type SideHustleCommercePersistence = {
  get(id:string):Promise<StoredCanonicalOpportunity|undefined>
  getSideHustleCommerceRecord(id:string):Promise<StoredSideHustleCommerceRecord|undefined>
  listSideHustleCommerceRecords(input?:{
    opportunityId?:string
    family?:StoredSideHustleCommerceRecord['family']
    kind?:SideHustleCommerceRecordKind
  }):Promise<StoredSideHustleCommerceRecord[]>
  saveSideHustleCommerceRecord(
    kind:SideHustleCommerceRecordKind,
    record:SideHustleCommerceRecord,
  ):Promise<SideHustleCommerceRecord>
}

export async function createSideHustleCommerceOfferRuntime(input:{
  opportunityId:string
  id:string
  title:string
  description:string
  billing:{amount:number;currency:string;cadence:SideHustleBillingCadence}
  deliveryMode:SideHustleDeliveryMode
  providerRef?:string
  evidenceRefs:string[]
  createdAt?:string
},repository:SideHustleCommercePersistence):Promise<SideHustleCommerceOffer>{
  const stored=await requireOpportunity(input.opportunityId,repository)
  const offer=createSideHustleCommerceOffer({
    opportunity:stored.opportunity,
    id:input.id,
    title:input.title,
    description:input.description,
    billing:input.billing,
    deliveryMode:input.deliveryMode,
    providerRef:input.providerRef,
    evidenceRefs:input.evidenceRefs,
    createdAt:input.createdAt??new Date().toISOString(),
  })
  return saveTyped('offer',offer,repository)
}

export async function activateSideHustleCommerceOfferRuntime(input:{
  offerId:string
  evidenceRefs:string[]
  activatedAt?:string
},repository:SideHustleCommercePersistence):Promise<SideHustleCommerceOffer>{
  const offer=await requirePayload<SideHustleCommerceOffer>(input.offerId,'offer',repository)
  return saveTyped('offer',activateSideHustleCommerceOffer({
    offer,
    evidenceRefs:input.evidenceRefs,
    activatedAt:input.activatedAt??new Date().toISOString(),
  }),repository)
}

export async function retireSideHustleCommerceOfferRuntime(input:{
  offerId:string
  evidenceRefs:string[]
  retiredAt?:string
},repository:SideHustleCommercePersistence):Promise<SideHustleCommerceOffer>{
  const offer=await requirePayload<SideHustleCommerceOffer>(input.offerId,'offer',repository)
  return saveTyped('offer',retireSideHustleCommerceOffer({
    offer,
    evidenceRefs:input.evidenceRefs,
    retiredAt:input.retiredAt??new Date().toISOString(),
  }),repository)
}

export async function grantSideHustleEntitlementRuntime(input:{
  offerId:string
  id:string
  customerRef:string
  sourceTransactionRef:string
  evidenceRefs:string[]
  grantedAt?:string
  expiresAt?:string
},repository:SideHustleCommercePersistence):Promise<SideHustleEntitlement>{
  const offer=await requirePayload<SideHustleCommerceOffer>(input.offerId,'offer',repository)
  return saveTyped('entitlement',grantSideHustleEntitlement({
    offer,
    id:input.id,
    customerRef:input.customerRef,
    sourceTransactionRef:input.sourceTransactionRef,
    evidenceRefs:input.evidenceRefs,
    grantedAt:input.grantedAt??new Date().toISOString(),
    expiresAt:input.expiresAt,
  }),repository)
}

export async function endSideHustleEntitlementRuntime(input:{
  entitlementId:string
  status:'expired'|'revoked'
  reason:string
  evidenceRefs:string[]
  endedAt?:string
},repository:SideHustleCommercePersistence):Promise<SideHustleEntitlement>{
  const entitlement=await requirePayload<SideHustleEntitlement>(input.entitlementId,'entitlement',repository)
  return saveTyped('entitlement',endSideHustleEntitlement({
    entitlement,
    status:input.status,
    reason:input.reason,
    evidenceRefs:input.evidenceRefs,
    endedAt:input.endedAt??new Date().toISOString(),
  }),repository)
}

export async function observeSideHustleSubscriptionRuntime(input:{
  offerId:string
  id:string
  customerRef:string
  providerRef:string
  status:SideHustleSubscriptionStatus
  periodStart?:string
  periodEnd?:string
  transactionRef?:string
  evidenceRefs:string[]
  observedAt?:string
},repository:SideHustleCommercePersistence):Promise<SideHustleSubscriptionObservation>{
  const offer=await requirePayload<SideHustleCommerceOffer>(input.offerId,'offer',repository)
  return saveTyped('subscription_observation',observeSideHustleSubscription({
    offer,
    id:input.id,
    customerRef:input.customerRef,
    providerRef:input.providerRef,
    status:input.status,
    periodStart:input.periodStart,
    periodEnd:input.periodEnd,
    transactionRef:input.transactionRef,
    evidenceRefs:input.evidenceRefs,
    observedAt:input.observedAt??new Date().toISOString(),
  }),repository)
}

export async function recordSideHustleDigitalDeliveryRuntime(input:{
  offerId:string
  entitlementId:string
  id:string
  deliveryRef:string
  artifactRefs:string[]
  evidenceRefs:string[]
  deliveredAt?:string
},repository:SideHustleCommercePersistence):Promise<SideHustleDigitalDeliveryReceipt>{
  const [offer,entitlement]=await Promise.all([
    requirePayload<SideHustleCommerceOffer>(input.offerId,'offer',repository),
    requirePayload<SideHustleEntitlement>(input.entitlementId,'entitlement',repository),
  ])
  return saveTyped('delivery',recordSideHustleDigitalDelivery({
    offer,
    entitlement,
    id:input.id,
    deliveryRef:input.deliveryRef,
    artifactRefs:input.artifactRefs,
    evidenceRefs:input.evidenceRefs,
    deliveredAt:input.deliveredAt??new Date().toISOString(),
  }),repository)
}

export async function createSideHustleDirectoryListingRuntime(input:{
  offerId:string
  id:string
  ownerRef:string
  title:string
  summary:string
  evidenceRefs:string[]
  createdAt?:string
},repository:SideHustleCommercePersistence):Promise<SideHustleDirectoryListing>{
  const offer=await requirePayload<SideHustleCommerceOffer>(input.offerId,'offer',repository)
  return saveTyped('listing',createSideHustleDirectoryListing({
    offer,
    id:input.id,
    ownerRef:input.ownerRef,
    title:input.title,
    summary:input.summary,
    evidenceRefs:input.evidenceRefs,
    createdAt:input.createdAt??new Date().toISOString(),
  }),repository)
}

export async function transitionSideHustleDirectoryListingRuntime(input:{
  listingId:string
  status:Exclude<SideHustleDirectoryListingStatus,'draft'>
  evidenceRefs:string[]
  observedAt?:string
  moderationNote?:string
},repository:SideHustleCommercePersistence):Promise<SideHustleDirectoryListing>{
  const listing=await requirePayload<SideHustleDirectoryListing>(input.listingId,'listing',repository)
  return saveTyped('listing',transitionSideHustleDirectoryListing({
    listing,
    status:input.status,
    evidenceRefs:input.evidenceRefs,
    observedAt:input.observedAt??new Date().toISOString(),
    moderationNote:input.moderationNote,
  }),repository)
}

export async function recordSideHustleRefundReversalRuntime(input:{
  offerId:string
  id:string
  customerRef:string
  transactionRef:string
  amount:number
  currency?:string
  reason:string
  evidenceRefs:string[]
  observedAt?:string
},repository:SideHustleCommercePersistence){
  const offer=await requirePayload<SideHustleCommerceOffer>(input.offerId,'offer',repository)
  const record=recordSideHustleRefundReversal({
    offer,
    id:input.id,
    customerRef:input.customerRef,
    transactionRef:input.transactionRef,
    amount:input.amount,
    currency:input.currency,
    reason:input.reason,
    evidenceRefs:input.evidenceRefs,
    observedAt:input.observedAt??new Date().toISOString(),
  })
  return saveTyped('refund_reversal',record,repository)
}

export async function recordSideHustleAffiliateEventRuntime(input:{
  opportunityId:string
  id:string
  programRef:string
  providerRef:string
  externalEventRef:string
  kind:SideHustleAffiliateEventKind
  providerStatus?:string
  economicState?:SideHustleAffiliateEconomicState
  customerOrSessionRef?:string
  amount?:number
  currency?:string
  evidenceRefs:string[]
  occurredAt?:string
},repository:SideHustleCommercePersistence):Promise<SideHustleAffiliateEvent>{
  const stored=await requireOpportunity(input.opportunityId,repository)
  return saveTyped('affiliate_event',recordSideHustleAffiliateEvent({
    opportunity:stored.opportunity,
    id:input.id,
    programRef:input.programRef,
    providerRef:input.providerRef,
    externalEventRef:input.externalEventRef,
    kind:input.kind,
    providerStatus:input.providerStatus,
    economicState:input.economicState,
    customerOrSessionRef:input.customerOrSessionRef,
    amount:input.amount,
    currency:input.currency,
    evidenceRefs:input.evidenceRefs,
    occurredAt:input.occurredAt??new Date().toISOString(),
  }),repository)
}

export async function summarizeSideHustleCommerceRuntime(input:{
  opportunityId:string
},repository:SideHustleCommercePersistence){
  const records=await repository.listSideHustleCommerceRecords({opportunityId:requireText(input.opportunityId,'opportunityId')})
  return {
    opportunityId:input.opportunityId,
    offers:records.filter(row=>row.kind==='offer').length,
    activeEntitlements:records.filter(row=>row.kind==='entitlement'&&row.status==='active').length,
    subscriptionObservations:records.filter(row=>row.kind==='subscription_observation').length,
    deliveries:records.filter(row=>row.kind==='delivery').length,
    publishedListings:records.filter(row=>row.kind==='listing'&&row.status==='published').length,
    refundReversals:records.filter(row=>row.kind==='refund_reversal').length,
    affiliateEvents:records.filter(row=>row.kind==='affiliate_event').length,
    externalActionAuthorized:false as const,
    moneyMovementAuthorized:false as const,
  }
}

async function requireOpportunity(id:string,repository:SideHustleCommercePersistence){
  const stored=await repository.get(requireText(id,'opportunityId'))
  if(!stored)throw new Error('SIDE_HUSTLE_COMMERCE_OPPORTUNITY_NOT_FOUND')
  return stored
}

async function requirePayload<T extends SideHustleCommerceRecord>(
  id:string,
  kind:SideHustleCommerceRecordKind,
  repository:SideHustleCommercePersistence,
):Promise<T>{
  const stored=await repository.getSideHustleCommerceRecord(requireText(id,'recordId'))
  if(!stored)throw new Error('SIDE_HUSTLE_COMMERCE_RECORD_NOT_FOUND')
  if(stored.kind!==kind)throw new Error('SIDE_HUSTLE_COMMERCE_RECORD_KIND_MISMATCH')
  return stored.payload as T
}

async function saveTyped<T extends SideHustleCommerceRecord>(
  expectedKind:SideHustleCommerceRecordKind,
  record:T,
  repository:SideHustleCommercePersistence,
):Promise<T>{
  const inferred=sideHustleCommerceRecordKind(record)
  if(inferred!==expectedKind)throw new Error('SIDE_HUSTLE_COMMERCE_RECORD_KIND_INVALID')
  return await repository.saveSideHustleCommerceRecord(expectedKind,record) as T
}

function requireText(value:string,field:string){
  if(typeof value!=='string'||!value.trim())throw new Error(`${field} is required`)
  return value.trim()
}
