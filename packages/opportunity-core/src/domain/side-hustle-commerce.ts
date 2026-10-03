import { isSideHustleProfile, type SideHustleFamily } from './side-hustles.js'
import type { Opportunity } from './opportunity.js'

export const SIDE_HUSTLE_REVENUE_PRODUCT_FAMILIES = [
  'digital_products',
  'software_apps',
  'communities',
  'directories_marketplaces',
] as const satisfies readonly SideHustleFamily[]

export type SideHustleRevenueProductFamily =
  (typeof SIDE_HUSTLE_REVENUE_PRODUCT_FAMILIES)[number]

export type SideHustleOfferStatus = 'draft' | 'active' | 'retired'
export type SideHustleBillingCadence = 'one_time' | 'monthly' | 'annual' | 'usage'
export type SideHustleDeliveryMode =
  | 'digital_file'
  | 'software_access'
  | 'community_access'
  | 'directory_listing'

export type SideHustleCommerceOffer = {
  id: string
  opportunityId: string
  family: SideHustleRevenueProductFamily
  title: string
  description: string
  billing: {
    amount: number
    currency: string
    cadence: SideHustleBillingCadence
  }
  deliveryMode: SideHustleDeliveryMode
  providerRef?: string
  evidenceRefs: string[]
  status: SideHustleOfferStatus
  activatedAt?: string
  retiredAt?: string
  createdAt: string
  updatedAt: string
  authority: 'CATALOG_ONLY'
  externalActionAuthorized: false
  paymentAuthorized: false
}

export type SideHustleEntitlementStatus = 'active' | 'expired' | 'revoked'

export type SideHustleEntitlement = {
  id: string
  opportunityId: string
  offerId: string
  family: SideHustleRevenueProductFamily
  customerRef: string
  sourceTransactionRef: string
  status: SideHustleEntitlementStatus
  evidenceRefs: string[]
  grantedAt: string
  expiresAt?: string
  endedAt?: string
  endReason?: string
  authority: 'ENTITLEMENT_EVIDENCE_ONLY'
  externalActionAuthorized: false
  paymentAuthorized: false
}

export type SideHustleSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'

export type SideHustleSubscriptionObservation = {
  id: string
  opportunityId: string
  offerId: string
  family: SideHustleRevenueProductFamily
  customerRef: string
  providerRef: string
  status: SideHustleSubscriptionStatus
  periodStart?: string
  periodEnd?: string
  transactionRef?: string
  evidenceRefs: string[]
  observedAt: string
  authority: 'PROVIDER_OBSERVATION_ONLY'
  externalActionAuthorized: false
  paymentAuthorized: false
}

export type SideHustleDigitalDeliveryReceipt = {
  id: string
  opportunityId: string
  offerId: string
  entitlementId: string
  family: SideHustleRevenueProductFamily
  customerRef: string
  deliveryRef: string
  artifactRefs: string[]
  evidenceRefs: string[]
  deliveredAt: string
  authority: 'DELIVERY_OBSERVATION_ONLY'
  externalActionAuthorized: false
}

export type SideHustleDirectoryListingStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'retired'

export type SideHustleDirectoryListing = {
  id: string
  opportunityId: string
  offerId: string
  family: 'directories_marketplaces'
  ownerRef: string
  title: string
  summary: string
  evidenceRefs: string[]
  status: SideHustleDirectoryListingStatus
  moderationNote?: string
  createdAt: string
  updatedAt: string
  authority: 'LISTING_STATE_ONLY'
  externalActionAuthorized: false
  paymentAuthorized: false
}

export type SideHustleRefundReversalReceipt = {
  id: string
  opportunityId: string
  offerId: string
  family: SideHustleRevenueProductFamily
  customerRef: string
  transactionRef: string
  amount: number
  currency: string
  reason: string
  evidenceRefs: string[]
  observedAt: string
  authority: 'FINANCIAL_OBSERVATION_ONLY'
  externalActionAuthorized: false
  paymentAuthorized: false
  moneyMovementAuthorized: false
}

export type SideHustleAffiliateEventKind =
  | 'click'
  | 'conversion'
  | 'reversal'
  | 'payout'

export type SideHustleAffiliateEvent = {
  id: string
  opportunityId: string
  family: 'commerce_affiliate'
  programRef: string
  providerRef: string
  externalEventRef: string
  kind: SideHustleAffiliateEventKind
  customerOrSessionRef?: string
  amount?: number
  currency?: string
  evidenceRefs: string[]
  occurredAt: string
  authority: 'AFFILIATE_OBSERVATION_ONLY'
  externalActionAuthorized: false
  paymentAuthorized: false
  moneyMovementAuthorized: false
}

export type SideHustleCommerceRecord =
  | SideHustleCommerceOffer
  | SideHustleEntitlement
  | SideHustleSubscriptionObservation
  | SideHustleDigitalDeliveryReceipt
  | SideHustleDirectoryListing
  | SideHustleRefundReversalReceipt
  | SideHustleAffiliateEvent

export type SideHustleCommerceRecordKind =
  | 'offer'
  | 'entitlement'
  | 'subscription_observation'
  | 'delivery'
  | 'listing'
  | 'refund_reversal'
  | 'affiliate_event'

export function isSideHustleRevenueProductFamily(
  family: SideHustleFamily,
): family is SideHustleRevenueProductFamily {
  return (SIDE_HUSTLE_REVENUE_PRODUCT_FAMILIES as readonly SideHustleFamily[]).includes(family)
}

export function createSideHustleCommerceOffer(input: {
  opportunity: Opportunity
  id: string
  title: string
  description: string
  billing: {
    amount: number
    currency: string
    cadence: SideHustleBillingCadence
  }
  deliveryMode: SideHustleDeliveryMode
  providerRef?: string
  evidenceRefs: string[]
  createdAt: string
}): SideHustleCommerceOffer {
  const profile = requireProductProfile(input.opportunity)
  requireText(input.id, 'offer.id')
  requireText(input.title, 'offer.title')
  requireText(input.description, 'offer.description')
  requireDate(input.createdAt, 'offer.createdAt')
  requireEvidence(input.evidenceRefs, 'offer')
  validateMoney(input.billing.amount, input.billing.currency)
  validateOfferShape(profile.family, input.billing.cadence, input.deliveryMode)

  return {
    id: input.id.trim(),
    opportunityId: input.opportunity.id,
    family: profile.family,
    title: input.title.trim(),
    description: input.description.trim(),
    billing: {
      amount: roundMoney(input.billing.amount),
      currency: input.billing.currency.trim().toUpperCase(),
      cadence: input.billing.cadence,
    },
    deliveryMode: input.deliveryMode,
    providerRef: input.providerRef?.trim() || undefined,
    evidenceRefs: unique(input.evidenceRefs),
    status: 'draft',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    authority: 'CATALOG_ONLY',
    externalActionAuthorized: false,
    paymentAuthorized: false,
  }
}

export function activateSideHustleCommerceOffer(input: {
  offer: SideHustleCommerceOffer
  evidenceRefs: string[]
  activatedAt: string
}): SideHustleCommerceOffer {
  if (input.offer.status !== 'draft') throw new Error('Only draft Side Hustle offers may activate')
  requireEvidence(input.evidenceRefs, 'offer activation')
  requireDate(input.activatedAt, 'offer.activatedAt')
  return {
    ...cloneOffer(input.offer),
    evidenceRefs: unique([...input.offer.evidenceRefs, ...input.evidenceRefs]),
    status: 'active',
    activatedAt: input.activatedAt,
    updatedAt: input.activatedAt,
  }
}

export function retireSideHustleCommerceOffer(input: {
  offer: SideHustleCommerceOffer
  evidenceRefs: string[]
  retiredAt: string
}): SideHustleCommerceOffer {
  if (input.offer.status === 'retired') return cloneOffer(input.offer)
  requireEvidence(input.evidenceRefs, 'offer retirement')
  requireDate(input.retiredAt, 'offer.retiredAt')
  return {
    ...cloneOffer(input.offer),
    evidenceRefs: unique([...input.offer.evidenceRefs, ...input.evidenceRefs]),
    status: 'retired',
    retiredAt: input.retiredAt,
    updatedAt: input.retiredAt,
  }
}

export function grantSideHustleEntitlement(input: {
  offer: SideHustleCommerceOffer
  id: string
  customerRef: string
  sourceTransactionRef: string
  evidenceRefs: string[]
  grantedAt: string
  expiresAt?: string
}): SideHustleEntitlement {
  if (input.offer.status !== 'active') throw new Error('Entitlement requires an active Side Hustle offer')
  requireText(input.id, 'entitlement.id')
  requireText(input.customerRef, 'entitlement.customerRef')
  requireText(input.sourceTransactionRef, 'entitlement.sourceTransactionRef')
  requireEvidence(input.evidenceRefs, 'entitlement')
  requireDate(input.grantedAt, 'entitlement.grantedAt')
  if (input.expiresAt) {
    requireDate(input.expiresAt, 'entitlement.expiresAt')
    if (Date.parse(input.expiresAt) <= Date.parse(input.grantedAt)) {
      throw new Error('Entitlement expiry must follow grant time')
    }
  }

  return {
    id: input.id.trim(),
    opportunityId: input.offer.opportunityId,
    offerId: input.offer.id,
    family: input.offer.family,
    customerRef: input.customerRef.trim(),
    sourceTransactionRef: input.sourceTransactionRef.trim(),
    status: 'active',
    evidenceRefs: unique([...input.offer.evidenceRefs, ...input.evidenceRefs]),
    grantedAt: input.grantedAt,
    expiresAt: input.expiresAt,
    authority: 'ENTITLEMENT_EVIDENCE_ONLY',
    externalActionAuthorized: false,
    paymentAuthorized: false,
  }
}

export function endSideHustleEntitlement(input: {
  entitlement: SideHustleEntitlement
  status: 'expired' | 'revoked'
  reason: string
  evidenceRefs: string[]
  endedAt: string
}): SideHustleEntitlement {
  if (input.entitlement.status !== 'active') throw new Error('Only active entitlements may end')
  requireText(input.reason, 'entitlement.endReason')
  requireEvidence(input.evidenceRefs, 'entitlement end')
  requireDate(input.endedAt, 'entitlement.endedAt')
  if (Date.parse(input.endedAt) < Date.parse(input.entitlement.grantedAt)) {
    throw new Error('Entitlement end cannot predate grant')
  }
  return {
    ...input.entitlement,
    evidenceRefs: unique([...input.entitlement.evidenceRefs, ...input.evidenceRefs]),
    status: input.status,
    endedAt: input.endedAt,
    endReason: input.reason.trim(),
  }
}

export function observeSideHustleSubscription(input: {
  offer: SideHustleCommerceOffer
  id: string
  customerRef: string
  providerRef: string
  status: SideHustleSubscriptionStatus
  periodStart?: string
  periodEnd?: string
  transactionRef?: string
  evidenceRefs: string[]
  observedAt: string
}): SideHustleSubscriptionObservation {
  if (!['monthly', 'annual', 'usage'].includes(input.offer.billing.cadence)) {
    throw new Error('Subscription observation requires a recurring Side Hustle offer')
  }
  requireText(input.id, 'subscription.id')
  requireText(input.customerRef, 'subscription.customerRef')
  requireText(input.providerRef, 'subscription.providerRef')
  requireEvidence(input.evidenceRefs, 'subscription observation')
  requireDate(input.observedAt, 'subscription.observedAt')
  if (input.periodStart) requireDate(input.periodStart, 'subscription.periodStart')
  if (input.periodEnd) requireDate(input.periodEnd, 'subscription.periodEnd')
  if (input.periodStart && input.periodEnd && Date.parse(input.periodEnd) < Date.parse(input.periodStart)) {
    throw new Error('Subscription periodEnd cannot predate periodStart')
  }

  return {
    id: input.id.trim(),
    opportunityId: input.offer.opportunityId,
    offerId: input.offer.id,
    family: input.offer.family,
    customerRef: input.customerRef.trim(),
    providerRef: input.providerRef.trim(),
    status: input.status,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    transactionRef: input.transactionRef?.trim() || undefined,
    evidenceRefs: unique(input.evidenceRefs),
    observedAt: input.observedAt,
    authority: 'PROVIDER_OBSERVATION_ONLY',
    externalActionAuthorized: false,
    paymentAuthorized: false,
  }
}

export function recordSideHustleDigitalDelivery(input: {
  offer: SideHustleCommerceOffer
  entitlement: SideHustleEntitlement
  id: string
  deliveryRef: string
  artifactRefs: string[]
  evidenceRefs: string[]
  deliveredAt: string
}): SideHustleDigitalDeliveryReceipt {
  if (input.entitlement.status !== 'active') throw new Error('Delivery requires an active entitlement')
  if (input.entitlement.offerId !== input.offer.id) throw new Error('Delivery entitlement does not match offer')
  requireText(input.id, 'delivery.id')
  requireText(input.deliveryRef, 'delivery.deliveryRef')
  requireEvidence(input.artifactRefs, 'delivery artifacts')
  requireEvidence(input.evidenceRefs, 'delivery evidence')
  requireDate(input.deliveredAt, 'delivery.deliveredAt')

  return {
    id: input.id.trim(),
    opportunityId: input.offer.opportunityId,
    offerId: input.offer.id,
    entitlementId: input.entitlement.id,
    family: input.offer.family,
    customerRef: input.entitlement.customerRef,
    deliveryRef: input.deliveryRef.trim(),
    artifactRefs: unique(input.artifactRefs),
    evidenceRefs: unique(input.evidenceRefs),
    deliveredAt: input.deliveredAt,
    authority: 'DELIVERY_OBSERVATION_ONLY',
    externalActionAuthorized: false,
  }
}

export function createSideHustleDirectoryListing(input: {
  offer: SideHustleCommerceOffer
  id: string
  ownerRef: string
  title: string
  summary: string
  evidenceRefs: string[]
  createdAt: string
}): SideHustleDirectoryListing {
  if (input.offer.family !== 'directories_marketplaces' || input.offer.deliveryMode !== 'directory_listing') {
    throw new Error('Directory listing requires a directories_marketplaces offer')
  }
  requireText(input.id, 'listing.id')
  requireText(input.ownerRef, 'listing.ownerRef')
  requireText(input.title, 'listing.title')
  requireText(input.summary, 'listing.summary')
  requireEvidence(input.evidenceRefs, 'listing')
  requireDate(input.createdAt, 'listing.createdAt')
  return {
    id: input.id.trim(),
    opportunityId: input.offer.opportunityId,
    offerId: input.offer.id,
    family: 'directories_marketplaces',
    ownerRef: input.ownerRef.trim(),
    title: input.title.trim(),
    summary: input.summary.trim(),
    evidenceRefs: unique(input.evidenceRefs),
    status: 'draft',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    authority: 'LISTING_STATE_ONLY',
    externalActionAuthorized: false,
    paymentAuthorized: false,
  }
}

export function transitionSideHustleDirectoryListing(input: {
  listing: SideHustleDirectoryListing
  status: Exclude<SideHustleDirectoryListingStatus, 'draft'>
  evidenceRefs: string[]
  observedAt: string
  moderationNote?: string
}): SideHustleDirectoryListing {
  const allowed: Record<SideHustleDirectoryListingStatus, SideHustleDirectoryListingStatus[]> = {
    draft: ['pending_review', 'retired'],
    pending_review: ['approved', 'rejected', 'retired'],
    approved: ['published', 'retired'],
    rejected: ['pending_review', 'retired'],
    published: ['retired'],
    retired: [],
  }
  if (!allowed[input.listing.status].includes(input.status)) {
    throw new Error(`Invalid directory listing transition: ${input.listing.status} -> ${input.status}`)
  }
  requireEvidence(input.evidenceRefs, 'listing transition')
  requireDate(input.observedAt, 'listing.updatedAt')
  return {
    ...input.listing,
    evidenceRefs: unique([...input.listing.evidenceRefs, ...input.evidenceRefs]),
    status: input.status,
    moderationNote: input.moderationNote?.trim() || input.listing.moderationNote,
    updatedAt: input.observedAt,
  }
}

export function recordSideHustleRefundReversal(input: {
  offer: SideHustleCommerceOffer
  id: string
  customerRef: string
  transactionRef: string
  amount: number
  currency?: string
  reason: string
  evidenceRefs: string[]
  observedAt: string
}): SideHustleRefundReversalReceipt {
  requireText(input.id, 'refund.id')
  requireText(input.customerRef, 'refund.customerRef')
  requireText(input.transactionRef, 'refund.transactionRef')
  requireText(input.reason, 'refund.reason')
  requireEvidence(input.evidenceRefs, 'refund')
  requireDate(input.observedAt, 'refund.observedAt')
  validateMoney(input.amount, input.currency ?? input.offer.billing.currency)

  return {
    id: input.id.trim(),
    opportunityId: input.offer.opportunityId,
    offerId: input.offer.id,
    family: input.offer.family,
    customerRef: input.customerRef.trim(),
    transactionRef: input.transactionRef.trim(),
    amount: roundMoney(input.amount),
    currency: (input.currency ?? input.offer.billing.currency).trim().toUpperCase(),
    reason: input.reason.trim(),
    evidenceRefs: unique(input.evidenceRefs),
    observedAt: input.observedAt,
    authority: 'FINANCIAL_OBSERVATION_ONLY',
    externalActionAuthorized: false,
    paymentAuthorized: false,
    moneyMovementAuthorized: false,
  }
}

export function recordSideHustleAffiliateEvent(input: {
  opportunity: Opportunity
  id: string
  programRef: string
  providerRef: string
  externalEventRef: string
  kind: SideHustleAffiliateEventKind
  customerOrSessionRef?: string
  amount?: number
  currency?: string
  evidenceRefs: string[]
  occurredAt: string
}): SideHustleAffiliateEvent {
  const profile = input.opportunity.metadata?.sideHustleProfile
  if (!isSideHustleProfile(profile) || profile.family !== 'commerce_affiliate') {
    throw new Error('Affiliate event requires a commerce_affiliate Opportunity')
  }
  requireText(input.id, 'affiliateEvent.id')
  requireText(input.programRef, 'affiliateEvent.programRef')
  requireText(input.providerRef, 'affiliateEvent.providerRef')
  requireText(input.externalEventRef, 'affiliateEvent.externalEventRef')
  requireEvidence(input.evidenceRefs, 'affiliate event')
  requireDate(input.occurredAt, 'affiliateEvent.occurredAt')
  if (input.amount !== undefined) {
    if (!input.currency) throw new Error('Affiliate event currency is required when amount is present')
    validateMoney(input.amount, input.currency)
  }
  if (['conversion', 'reversal', 'payout'].includes(input.kind) && input.amount === undefined) {
    throw new Error(`Affiliate ${input.kind} event requires an amount`)
  }

  return {
    id: input.id.trim(),
    opportunityId: input.opportunity.id,
    family: 'commerce_affiliate',
    programRef: input.programRef.trim(),
    providerRef: input.providerRef.trim(),
    externalEventRef: input.externalEventRef.trim(),
    kind: input.kind,
    customerOrSessionRef: input.customerOrSessionRef?.trim() || undefined,
    amount: input.amount === undefined ? undefined : roundMoney(input.amount),
    currency: input.currency?.trim().toUpperCase(),
    evidenceRefs: unique(input.evidenceRefs),
    occurredAt: input.occurredAt,
    authority: 'AFFILIATE_OBSERVATION_ONLY',
    externalActionAuthorized: false,
    paymentAuthorized: false,
    moneyMovementAuthorized: false,
  }
}

export function sideHustleCommerceRecordKind(record: SideHustleCommerceRecord): SideHustleCommerceRecordKind {
  if ('billing' in record) return 'offer'
  if ('sourceTransactionRef' in record) return 'entitlement'
  if ('providerRef' in record && 'periodStart' in record) return 'subscription_observation'
  if ('artifactRefs' in record) return 'delivery'
  if ('ownerRef' in record) return 'listing'
  if ('transactionRef' in record && 'reason' in record && 'moneyMovementAuthorized' in record) return 'refund_reversal'
  return 'affiliate_event'
}

function requireProductProfile(opportunity: Opportunity): {
  family: SideHustleRevenueProductFamily
} {
  const profile = opportunity.metadata?.sideHustleProfile
  if (!isSideHustleProfile(profile) || !isSideHustleRevenueProductFamily(profile.family)) {
    throw new Error('Revenue-product runtime requires a supported Side Hustle product family')
  }
  if (!['ready', 'approved', 'pursuing'].includes(opportunity.status)) {
    throw new Error(`Revenue-product runtime requires a ready or active Opportunity, got ${opportunity.status}`)
  }
  return { family: profile.family }
}

function validateOfferShape(
  family: SideHustleRevenueProductFamily,
  cadence: SideHustleBillingCadence,
  deliveryMode: SideHustleDeliveryMode,
): void {
  const expected: Record<SideHustleRevenueProductFamily, SideHustleDeliveryMode> = {
    digital_products: 'digital_file',
    software_apps: 'software_access',
    communities: 'community_access',
    directories_marketplaces: 'directory_listing',
  }
  if (expected[family] !== deliveryMode) {
    throw new Error(`Side Hustle ${family} requires delivery mode ${expected[family]}`)
  }
  if (family === 'communities' && cadence === 'one_time') {
    throw new Error('Community offers require recurring billing')
  }
}

function cloneOffer(offer: SideHustleCommerceOffer): SideHustleCommerceOffer {
  return {
    ...offer,
    billing: { ...offer.billing },
    evidenceRefs: [...offer.evidenceRefs],
  }
}

function validateMoney(amount: number, currency: string): void {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Amount must be finite and non-negative')
  requireText(currency, 'currency')
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function requireText(value: string, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`)
  return value.trim()
}

function requireDate(value: string, field: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${field} must be a valid date`)
  return value
}

function requireEvidence(values: readonly string[], field: string): string[] {
  const normalized = unique(values)
  if (!normalized.length) throw new Error(`${field} evidence is required`)
  return normalized
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
