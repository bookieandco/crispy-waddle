import {isSideHustleProfile} from './side-hustles.js'
import type {Opportunity} from './opportunity.js'

export type OwnedMediaPropertyType =
  | 'youtube_channel'
  | 'social_channel'
  | 'newsletter'
  | 'website'
  | 'podcast'

export type OwnedMediaPropertyStatus='active'|'paused'|'retired'

export type OwnedMediaProperty={
  id:string
  opportunityId:string
  family:'owned_media'
  propertyType:OwnedMediaPropertyType
  label:string
  providerRef?:string
  evidenceRefs:string[]
  status:OwnedMediaPropertyStatus
  createdAt:string
  updatedAt:string
  authority:'OWNED_MEDIA_REGISTRY_ONLY'
  externalActionAuthorized:false
  publishingAuthorized:false
  moneyMovementAuthorized:false
}

export type OwnedMediaCycleStatus=
  | 'planned'
  | 'produced'
  | 'approved'
  | 'published'
  | 'measured'
  | 'cancelled'

export type OwnedMediaCycle={
  id:string
  opportunityId:string
  family:'owned_media'
  propertyId:string
  title:string
  topicRef:string
  productionRef?:string
  approvalRef?:string
  publicationReceiptId?:string
  status:OwnedMediaCycleStatus
  evidenceRefs:string[]
  createdAt:string
  updatedAt:string
  authority:'OWNED_MEDIA_CYCLE_ONLY'
  externalActionAuthorized:false
  publishingAuthorized:false
  moneyMovementAuthorized:false
}

export type OwnedMediaPublicationReceipt={
  id:string
  opportunityId:string
  family:'owned_media'
  propertyId:string
  cycleId:string
  providerRef:string
  externalContentRef:string
  canonicalUrl?:string
  evidenceRefs:string[]
  publishedAt:string
  authority:'PUBLICATION_OBSERVATION_ONLY'
  externalActionAuthorized:false
  publishingAuthorized:false
}

export type OwnedMediaAnalyticsObservation={
  id:string
  opportunityId:string
  family:'owned_media'
  propertyId:string
  cycleId:string
  providerRef:string
  impressions?:number
  views?:number
  watchSeconds?:number
  clicks?:number
  leads?:number
  conversions?:number
  grossRevenue?:number
  currency?:string
  evidenceRefs:string[]
  observedAt:string
  authority:'ANALYTICS_OBSERVATION_ONLY'
  externalActionAuthorized:false
  moneyMovementAuthorized:false
}

export type OwnedMediaMonetizationKind=
  | 'advertising'
  | 'sponsorship'
  | 'affiliate'
  | 'subscription'
  | 'product'

export type OwnedMediaMonetizationObservation={
  id:string
  opportunityId:string
  family:'owned_media'
  propertyId:string
  cycleId?:string
  kind:OwnedMediaMonetizationKind
  amount:number
  currency:string
  transactionRef?:string
  providerRef?:string
  evidenceRefs:string[]
  observedAt:string
  authority:'MONETIZATION_OBSERVATION_ONLY'
  externalActionAuthorized:false
  paymentAuthorized:false
  moneyMovementAuthorized:false
}

export type OwnedMediaRecord=
  | OwnedMediaProperty
  | OwnedMediaCycle
  | OwnedMediaPublicationReceipt
  | OwnedMediaAnalyticsObservation
  | OwnedMediaMonetizationObservation

export type OwnedMediaRecordKind=
  | 'property'
  | 'cycle'
  | 'publication'
  | 'analytics'
  | 'monetization'

export function createOwnedMediaProperty(input:{
  opportunity:Opportunity
  id:string
  propertyType:OwnedMediaPropertyType
  label:string
  providerRef?:string
  evidenceRefs:string[]
  createdAt:string
}):OwnedMediaProperty{
  requireOwnedMediaOpportunity(input.opportunity)
  requireText(input.id,'property.id')
  requireText(input.label,'property.label')
  requireEvidence(input.evidenceRefs,'owned media property')
  requireDate(input.createdAt,'property.createdAt')
  return {
    id:input.id.trim(),
    opportunityId:input.opportunity.id,
    family:'owned_media',
    propertyType:input.propertyType,
    label:input.label.trim(),
    providerRef:input.providerRef?.trim()||undefined,
    evidenceRefs:unique(input.evidenceRefs),
    status:'active',
    createdAt:input.createdAt,
    updatedAt:input.createdAt,
    authority:'OWNED_MEDIA_REGISTRY_ONLY',
    externalActionAuthorized:false,
    publishingAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

export function setOwnedMediaPropertyStatus(input:{
  property:OwnedMediaProperty
  status:OwnedMediaPropertyStatus
  evidenceRefs:string[]
  observedAt:string
}):OwnedMediaProperty{
  if(input.property.status==='retired'&&input.status!=='retired')throw new Error('Retired owned-media property cannot reactivate')
  requireEvidence(input.evidenceRefs,'owned media property status')
  requireDate(input.observedAt,'property.updatedAt')
  return {
    ...input.property,
    evidenceRefs:unique([...input.property.evidenceRefs,...input.evidenceRefs]),
    status:input.status,
    updatedAt:input.observedAt,
  }
}

export function createOwnedMediaCycle(input:{
  property:OwnedMediaProperty
  id:string
  title:string
  topicRef:string
  evidenceRefs:string[]
  createdAt:string
}):OwnedMediaCycle{
  if(input.property.status!=='active')throw new Error('Owned-media cycle requires an active property')
  requireText(input.id,'cycle.id')
  requireText(input.title,'cycle.title')
  requireText(input.topicRef,'cycle.topicRef')
  requireEvidence(input.evidenceRefs,'owned media cycle')
  requireDate(input.createdAt,'cycle.createdAt')
  return {
    id:input.id.trim(),
    opportunityId:input.property.opportunityId,
    family:'owned_media',
    propertyId:input.property.id,
    title:input.title.trim(),
    topicRef:input.topicRef.trim(),
    status:'planned',
    evidenceRefs:unique(input.evidenceRefs),
    createdAt:input.createdAt,
    updatedAt:input.createdAt,
    authority:'OWNED_MEDIA_CYCLE_ONLY',
    externalActionAuthorized:false,
    publishingAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

export function transitionOwnedMediaCycle(input:{
  cycle:OwnedMediaCycle
  status:Exclude<OwnedMediaCycleStatus,'planned'>
  evidenceRefs:string[]
  observedAt:string
  productionRef?:string
  approvalRef?:string
  publicationReceiptId?:string
}):OwnedMediaCycle{
  const allowed:Record<OwnedMediaCycleStatus,OwnedMediaCycleStatus[]>={
    planned:['produced','cancelled'],
    produced:['approved','cancelled'],
    approved:['published','cancelled'],
    published:['measured'],
    measured:[],
    cancelled:[],
  }
  if(!allowed[input.cycle.status].includes(input.status)){
    throw new Error(`Invalid owned-media cycle transition: ${input.cycle.status} -> ${input.status}`)
  }
  requireEvidence(input.evidenceRefs,'owned media cycle transition')
  requireDate(input.observedAt,'cycle.updatedAt')
  if(input.status==='produced'&&!input.productionRef?.trim())throw new Error('Produced cycle requires productionRef')
  if(input.status==='approved'&&!input.approvalRef?.trim())throw new Error('Approved cycle requires approvalRef')
  if(input.status==='published'&&!input.publicationReceiptId?.trim())throw new Error('Published cycle requires publicationReceiptId')
  return {
    ...input.cycle,
    productionRef:input.productionRef?.trim()||input.cycle.productionRef,
    approvalRef:input.approvalRef?.trim()||input.cycle.approvalRef,
    publicationReceiptId:input.publicationReceiptId?.trim()||input.cycle.publicationReceiptId,
    evidenceRefs:unique([...input.cycle.evidenceRefs,...input.evidenceRefs]),
    status:input.status,
    updatedAt:input.observedAt,
  }
}

export function recordOwnedMediaPublication(input:{
  property:OwnedMediaProperty
  cycle:OwnedMediaCycle
  id:string
  providerRef:string
  externalContentRef:string
  canonicalUrl?:string
  evidenceRefs:string[]
  publishedAt:string
}):OwnedMediaPublicationReceipt{
  if(input.cycle.status!=='approved')throw new Error('Publication receipt requires approved owned-media cycle')
  if(input.cycle.propertyId!==input.property.id)throw new Error('Publication property does not match cycle')
  requireText(input.id,'publication.id')
  requireText(input.providerRef,'publication.providerRef')
  requireText(input.externalContentRef,'publication.externalContentRef')
  requireEvidence(input.evidenceRefs,'owned media publication')
  requireDate(input.publishedAt,'publication.publishedAt')
  return {
    id:input.id.trim(),
    opportunityId:input.property.opportunityId,
    family:'owned_media',
    propertyId:input.property.id,
    cycleId:input.cycle.id,
    providerRef:input.providerRef.trim(),
    externalContentRef:input.externalContentRef.trim(),
    canonicalUrl:input.canonicalUrl?.trim()||undefined,
    evidenceRefs:unique(input.evidenceRefs),
    publishedAt:input.publishedAt,
    authority:'PUBLICATION_OBSERVATION_ONLY',
    externalActionAuthorized:false,
    publishingAuthorized:false,
  }
}

export function observeOwnedMediaAnalytics(input:{
  property:OwnedMediaProperty
  cycle:OwnedMediaCycle
  id:string
  providerRef:string
  impressions?:number
  views?:number
  watchSeconds?:number
  clicks?:number
  leads?:number
  conversions?:number
  grossRevenue?:number
  currency?:string
  evidenceRefs:string[]
  observedAt:string
}):OwnedMediaAnalyticsObservation{
  if(!['published','measured'].includes(input.cycle.status))throw new Error('Analytics require a published owned-media cycle')
  if(input.cycle.propertyId!==input.property.id)throw new Error('Analytics property does not match cycle')
  requireText(input.id,'analytics.id')
  requireText(input.providerRef,'analytics.providerRef')
  requireEvidence(input.evidenceRefs,'owned media analytics')
  requireDate(input.observedAt,'analytics.observedAt')
  for(const [key,value] of Object.entries({
    impressions:input.impressions,views:input.views,watchSeconds:input.watchSeconds,
    clicks:input.clicks,leads:input.leads,conversions:input.conversions,grossRevenue:input.grossRevenue,
  })){
    if(value!==undefined&&(!Number.isFinite(value)||value<0))throw new Error(`analytics.${key} must be non-negative`)
  }
  if(input.grossRevenue!==undefined&&!input.currency?.trim())throw new Error('Analytics currency required with grossRevenue')
  return {
    id:input.id.trim(),
    opportunityId:input.property.opportunityId,
    family:'owned_media',
    propertyId:input.property.id,
    cycleId:input.cycle.id,
    providerRef:input.providerRef.trim(),
    impressions:input.impressions,views:input.views,watchSeconds:input.watchSeconds,
    clicks:input.clicks,leads:input.leads,conversions:input.conversions,
    grossRevenue:input.grossRevenue===undefined?undefined:roundMoney(input.grossRevenue),
    currency:input.currency?.trim().toUpperCase(),
    evidenceRefs:unique(input.evidenceRefs),
    observedAt:input.observedAt,
    authority:'ANALYTICS_OBSERVATION_ONLY',
    externalActionAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

export function observeOwnedMediaMonetization(input:{
  property:OwnedMediaProperty
  cycle?:OwnedMediaCycle
  id:string
  kind:OwnedMediaMonetizationKind
  amount:number
  currency:string
  transactionRef?:string
  providerRef?:string
  evidenceRefs:string[]
  observedAt:string
}):OwnedMediaMonetizationObservation{
  if(input.cycle&&input.cycle.propertyId!==input.property.id)throw new Error('Monetization property does not match cycle')
  requireText(input.id,'monetization.id')
  requireText(input.currency,'monetization.currency')
  requireEvidence(input.evidenceRefs,'owned media monetization')
  requireDate(input.observedAt,'monetization.observedAt')
  if(!Number.isFinite(input.amount)||input.amount<0)throw new Error('Monetization amount must be non-negative')
  return {
    id:input.id.trim(),
    opportunityId:input.property.opportunityId,
    family:'owned_media',
    propertyId:input.property.id,
    cycleId:input.cycle?.id,
    kind:input.kind,
    amount:roundMoney(input.amount),
    currency:input.currency.trim().toUpperCase(),
    transactionRef:input.transactionRef?.trim()||undefined,
    providerRef:input.providerRef?.trim()||undefined,
    evidenceRefs:unique(input.evidenceRefs),
    observedAt:input.observedAt,
    authority:'MONETIZATION_OBSERVATION_ONLY',
    externalActionAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

export function ownedMediaRecordKind(record:OwnedMediaRecord):OwnedMediaRecordKind{
  if('propertyType'in record)return'property'
  if('topicRef'in record)return'cycle'
  if('externalContentRef'in record)return'publication'
  if('impressions'in record||'views'in record||'watchSeconds'in record||'clicks'in record)return'analytics'
  return'monetization'
}

function requireOwnedMediaOpportunity(opportunity:Opportunity){
  const profile=opportunity.metadata?.sideHustleProfile
  if(!isSideHustleProfile(profile)||profile.family!=='owned_media')throw new Error('Owned-media runtime requires an owned_media Opportunity')
  if(!['ready','approved','pursuing'].includes(opportunity.status))throw new Error('Owned-media runtime requires a ready or active Opportunity')
}

function requireText(value:string,field:string){
  if(typeof value!=='string'||!value.trim())throw new Error(`${field} is required`)
  return value.trim()
}
function requireDate(value:string,field:string){
  if(!Number.isFinite(Date.parse(value)))throw new Error(`${field} must be a valid date`)
  return value
}
function requireEvidence(values:readonly string[],field:string){
  const out=unique(values);if(!out.length)throw new Error(`${field} evidence is required`);return out
}
function unique(values:readonly string[]){return[...new Set(values.map(v=>v.trim()).filter(Boolean))]}
function roundMoney(value:number){return Math.round(value*100)/100}
