import {
  checkoutSideHustlePhysicalAssetBooking,
  createOwnedMediaCycle,
  createOwnedMediaProperty,
  createSideHustlePhysicalAsset,
  createSideHustlePhysicalAssetBooking,
  observeOwnedMediaAnalytics,
  observeOwnedMediaMonetization,
  recordOwnedMediaPublication,
  recordSideHustlePhysicalAssetMaintenance,
  reserveSideHustlePhysicalAssetBooking,
  returnSideHustlePhysicalAssetBooking,
  setOwnedMediaPropertyStatus,
  sideHustleSpecializedRecordKind,
  transitionOwnedMediaCycle,
  transitionSideHustlePhysicalAsset,
  cancelSideHustlePhysicalAssetBooking,
  type OwnedMediaAnalyticsObservation,
  type OwnedMediaCycle,
  type OwnedMediaCycleStatus,
  type OwnedMediaMonetizationKind,
  type OwnedMediaMonetizationObservation,
  type OwnedMediaProperty,
  type OwnedMediaPropertyStatus,
  type OwnedMediaPropertyType,
  type OwnedMediaPublicationReceipt,
  type PhysicalAssetStatus,
  type SideHustlePhysicalAsset,
  type SideHustlePhysicalAssetBooking,
  type SideHustlePhysicalAssetCustodyReceipt,
  type SideHustlePhysicalAssetMaintenanceReceipt,
  type SideHustleSpecializedRecord,
  type SideHustleSpecializedRecordKind,
} from '@jhadina/opportunity-core'
import type {StoredCanonicalOpportunity} from './canonical'
import type {StoredSideHustleSpecializedRecord} from './supabase-opportunity-repository'

export type SideHustleSpecializedPersistence={
  get(id:string):Promise<StoredCanonicalOpportunity|undefined>
  getSideHustleSpecializedRecord(id:string):Promise<StoredSideHustleSpecializedRecord|undefined>
  listSideHustleSpecializedRecords(input?:{
    opportunityId?:string
    family?:StoredSideHustleSpecializedRecord['family']
    kind?:SideHustleSpecializedRecordKind
  }):Promise<StoredSideHustleSpecializedRecord[]>
  saveSideHustleSpecializedRecord(
    kind:SideHustleSpecializedRecordKind,
    record:SideHustleSpecializedRecord,
  ):Promise<SideHustleSpecializedRecord>
  saveSideHustleSpecializedBatch(
    records:Array<{kind:SideHustleSpecializedRecordKind;record:SideHustleSpecializedRecord}>,
  ):Promise<SideHustleSpecializedRecord[]>
}

export async function createOwnedMediaPropertyRuntime(input:{
  opportunityId:string
  id:string
  propertyType:OwnedMediaPropertyType
  label:string
  providerRef?:string
  evidenceRefs:string[]
  createdAt?:string
},repository:SideHustleSpecializedPersistence):Promise<OwnedMediaProperty>{
  const stored=await requireOpportunity(input.opportunityId,repository)
  return saveTyped(createOwnedMediaProperty({
    opportunity:stored.opportunity,id:input.id,propertyType:input.propertyType,label:input.label,
    providerRef:input.providerRef,evidenceRefs:input.evidenceRefs,
    createdAt:input.createdAt??new Date().toISOString(),
  }),repository)
}

export async function setOwnedMediaPropertyStatusRuntime(input:{
  propertyId:string
  status:OwnedMediaPropertyStatus
  evidenceRefs:string[]
  observedAt?:string
},repository:SideHustleSpecializedPersistence):Promise<OwnedMediaProperty>{
  const property=await requirePayload<OwnedMediaProperty>(input.propertyId,'owned_media_property',repository)
  return saveTyped(setOwnedMediaPropertyStatus({
    property,status:input.status,evidenceRefs:input.evidenceRefs,
    observedAt:input.observedAt??new Date().toISOString(),
  }),repository)
}

export async function createOwnedMediaCycleRuntime(input:{
  propertyId:string
  id:string
  title:string
  topicRef:string
  evidenceRefs:string[]
  createdAt?:string
},repository:SideHustleSpecializedPersistence):Promise<OwnedMediaCycle>{
  const property=await requirePayload<OwnedMediaProperty>(input.propertyId,'owned_media_property',repository)
  return saveTyped(createOwnedMediaCycle({
    property,id:input.id,title:input.title,topicRef:input.topicRef,evidenceRefs:input.evidenceRefs,
    createdAt:input.createdAt??new Date().toISOString(),
  }),repository)
}

export async function transitionOwnedMediaCycleRuntime(input:{
  cycleId:string
  status:Exclude<OwnedMediaCycleStatus,'planned'|'published'|'measured'>
  evidenceRefs:string[]
  observedAt?:string
  productionRef?:string
  approvalRef?:string
},repository:SideHustleSpecializedPersistence):Promise<OwnedMediaCycle>{
  const cycle=await requirePayload<OwnedMediaCycle>(input.cycleId,'owned_media_cycle',repository)
  return saveTyped(transitionOwnedMediaCycle({
    cycle,status:input.status,evidenceRefs:input.evidenceRefs,
    observedAt:input.observedAt??new Date().toISOString(),
    productionRef:input.productionRef,approvalRef:input.approvalRef,
  }),repository)
}

export async function recordOwnedMediaPublicationRuntime(input:{
  propertyId:string
  cycleId:string
  id:string
  providerRef:string
  externalContentRef:string
  canonicalUrl?:string
  evidenceRefs:string[]
  publishedAt?:string
},repository:SideHustleSpecializedPersistence):Promise<{
  publication:OwnedMediaPublicationReceipt
  cycle:OwnedMediaCycle
}>{
  const [property,cycle]=await Promise.all([
    requirePayload<OwnedMediaProperty>(input.propertyId,'owned_media_property',repository),
    requirePayload<OwnedMediaCycle>(input.cycleId,'owned_media_cycle',repository),
  ])
  const publishedAt=input.publishedAt??new Date().toISOString()
  const publication=recordOwnedMediaPublication({
    property,cycle,id:input.id,providerRef:input.providerRef,externalContentRef:input.externalContentRef,
    canonicalUrl:input.canonicalUrl,evidenceRefs:input.evidenceRefs,publishedAt,
  })
  const nextCycle=transitionOwnedMediaCycle({
    cycle,status:'published',publicationReceiptId:publication.id,
    evidenceRefs:input.evidenceRefs,observedAt:publishedAt,
  })
  await saveBatch([publication,nextCycle],repository)
  return{publication,cycle:nextCycle}
}

export async function observeOwnedMediaAnalyticsRuntime(input:{
  propertyId:string
  cycleId:string
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
  observedAt?:string
  markMeasured?:boolean
},repository:SideHustleSpecializedPersistence):Promise<{
  analytics:OwnedMediaAnalyticsObservation
  cycle:OwnedMediaCycle
}>{
  const [property,cycle]=await Promise.all([
    requirePayload<OwnedMediaProperty>(input.propertyId,'owned_media_property',repository),
    requirePayload<OwnedMediaCycle>(input.cycleId,'owned_media_cycle',repository),
  ])
  const observedAt=input.observedAt??new Date().toISOString()
  const analytics=observeOwnedMediaAnalytics({
    property,cycle,id:input.id,providerRef:input.providerRef,
    impressions:input.impressions,views:input.views,watchSeconds:input.watchSeconds,
    clicks:input.clicks,leads:input.leads,conversions:input.conversions,
    grossRevenue:input.grossRevenue,currency:input.currency,
    evidenceRefs:input.evidenceRefs,observedAt,
  })
  const shouldMeasure=(input.markMeasured??true)&&cycle.status==='published'
  const nextCycle=shouldMeasure?transitionOwnedMediaCycle({
    cycle,status:'measured',evidenceRefs:input.evidenceRefs,observedAt,
  }):cycle
  if(shouldMeasure)await saveBatch([analytics,nextCycle],repository)
  else await saveTyped(analytics,repository)
  return{analytics,cycle:nextCycle}
}

export async function observeOwnedMediaMonetizationRuntime(input:{
  propertyId:string
  cycleId?:string
  id:string
  kind:OwnedMediaMonetizationKind
  amount:number
  currency:string
  transactionRef?:string
  providerRef?:string
  evidenceRefs:string[]
  observedAt?:string
},repository:SideHustleSpecializedPersistence):Promise<OwnedMediaMonetizationObservation>{
  const property=await requirePayload<OwnedMediaProperty>(input.propertyId,'owned_media_property',repository)
  const cycle=input.cycleId
    ?await requirePayload<OwnedMediaCycle>(input.cycleId,'owned_media_cycle',repository)
    :undefined
  return saveTyped(observeOwnedMediaMonetization({
    property,cycle,id:input.id,kind:input.kind,amount:input.amount,currency:input.currency,
    transactionRef:input.transactionRef,providerRef:input.providerRef,evidenceRefs:input.evidenceRefs,
    observedAt:input.observedAt??new Date().toISOString(),
  }),repository)
}

export async function createPhysicalAssetRuntime(input:{
  opportunityId:string
  id:string
  assetType:string
  label:string
  serialRef?:string
  locationRef?:string
  acquisitionCost?:number
  currency?:string
  evidenceRefs:string[]
  createdAt?:string
},repository:SideHustleSpecializedPersistence):Promise<SideHustlePhysicalAsset>{
  const stored=await requireOpportunity(input.opportunityId,repository)
  return saveTyped(createSideHustlePhysicalAsset({
    opportunity:stored.opportunity,id:input.id,assetType:input.assetType,label:input.label,
    serialRef:input.serialRef,locationRef:input.locationRef,acquisitionCost:input.acquisitionCost,
    currency:input.currency,evidenceRefs:input.evidenceRefs,createdAt:input.createdAt??new Date().toISOString(),
  }),repository)
}

export async function transitionPhysicalAssetRuntime(input:{
  assetId:string
  status:PhysicalAssetStatus
  evidenceRefs:string[]
  observedAt?:string
  locationRef?:string
},repository:SideHustleSpecializedPersistence):Promise<SideHustlePhysicalAsset>{
  const asset=await requirePayload<SideHustlePhysicalAsset>(input.assetId,'physical_asset',repository)
  return saveTyped(transitionSideHustlePhysicalAsset({
    asset,status:input.status,evidenceRefs:input.evidenceRefs,
    observedAt:input.observedAt??new Date().toISOString(),locationRef:input.locationRef,
  }),repository)
}

export async function createPhysicalAssetBookingRuntime(input:{
  assetId:string
  id:string
  customerRef:string
  startsAt:string
  endsAt:string
  price:{amount:number;currency:string}
  depositTransactionRef?:string
  paymentTransactionRef?:string
  evidenceRefs:string[]
  createdAt?:string
},repository:SideHustleSpecializedPersistence):Promise<SideHustlePhysicalAssetBooking>{
  const asset=await requirePayload<SideHustlePhysicalAsset>(input.assetId,'physical_asset',repository)
  return saveTyped(createSideHustlePhysicalAssetBooking({
    asset,id:input.id,customerRef:input.customerRef,startsAt:input.startsAt,endsAt:input.endsAt,
    price:input.price,depositTransactionRef:input.depositTransactionRef,
    paymentTransactionRef:input.paymentTransactionRef,evidenceRefs:input.evidenceRefs,
    createdAt:input.createdAt??new Date().toISOString(),
  }),repository)
}

export async function reservePhysicalAssetBookingRuntime(input:{
  assetId:string
  bookingId:string
  evidenceRefs:string[]
  reservedAt?:string
},repository:SideHustleSpecializedPersistence){
  const [asset,booking]=await requireAssetAndBooking(input.assetId,input.bookingId,repository)
  const result=reserveSideHustlePhysicalAssetBooking({
    asset,booking,evidenceRefs:input.evidenceRefs,reservedAt:input.reservedAt??new Date().toISOString(),
  })
  await saveBatch([result.asset,result.booking],repository)
  return result
}

export async function checkoutPhysicalAssetBookingRuntime(input:{
  assetId:string
  bookingId:string
  custodyReceiptId:string
  fromRef?:string
  toRef?:string
  conditionNote?:string
  evidenceRefs:string[]
  checkedOutAt?:string
},repository:SideHustleSpecializedPersistence):Promise<{
  asset:SideHustlePhysicalAsset
  booking:SideHustlePhysicalAssetBooking
  custody:SideHustlePhysicalAssetCustodyReceipt
}>{
  const [asset,booking]=await requireAssetAndBooking(input.assetId,input.bookingId,repository)
  const result=checkoutSideHustlePhysicalAssetBooking({
    asset,booking,custodyReceiptId:input.custodyReceiptId,fromRef:input.fromRef,toRef:input.toRef,
    conditionNote:input.conditionNote,evidenceRefs:input.evidenceRefs,
    checkedOutAt:input.checkedOutAt??new Date().toISOString(),
  })
  await saveBatch([result.asset,result.booking,result.custody],repository)
  return result
}

export async function returnPhysicalAssetBookingRuntime(input:{
  assetId:string
  bookingId:string
  custodyReceiptId:string
  fromRef?:string
  toRef?:string
  conditionNote?:string
  evidenceRefs:string[]
  returnedAt?:string
  requiresMaintenance?:boolean
},repository:SideHustleSpecializedPersistence):Promise<{
  asset:SideHustlePhysicalAsset
  booking:SideHustlePhysicalAssetBooking
  custody:SideHustlePhysicalAssetCustodyReceipt
}>{
  const [asset,booking]=await requireAssetAndBooking(input.assetId,input.bookingId,repository)
  const result=returnSideHustlePhysicalAssetBooking({
    asset,booking,custodyReceiptId:input.custodyReceiptId,fromRef:input.fromRef,toRef:input.toRef,
    conditionNote:input.conditionNote,evidenceRefs:input.evidenceRefs,
    returnedAt:input.returnedAt??new Date().toISOString(),requiresMaintenance:input.requiresMaintenance,
  })
  await saveBatch([result.asset,result.booking,result.custody],repository)
  return result
}

export async function cancelPhysicalAssetBookingRuntime(input:{
  assetId:string
  bookingId:string
  evidenceRefs:string[]
  cancelledAt?:string
},repository:SideHustleSpecializedPersistence){
  const [asset,booking]=await requireAssetAndBooking(input.assetId,input.bookingId,repository)
  const result=cancelSideHustlePhysicalAssetBooking({
    asset,booking,evidenceRefs:input.evidenceRefs,cancelledAt:input.cancelledAt??new Date().toISOString(),
  })
  await saveBatch([result.asset,result.booking],repository)
  return result
}

export async function recordPhysicalAssetMaintenanceRuntime(input:{
  assetId:string
  id:string
  kind:'inspection'|'service'|'repair'|'damage'
  providerRef?:string
  cost?:number
  currency?:string
  note:string
  evidenceRefs:string[]
  observedAt?:string
  moveToMaintenance?:boolean
},repository:SideHustleSpecializedPersistence):Promise<{
  maintenance:SideHustlePhysicalAssetMaintenanceReceipt
  asset:SideHustlePhysicalAsset
}>{
  const asset=await requirePayload<SideHustlePhysicalAsset>(input.assetId,'physical_asset',repository)
  const observedAt=input.observedAt??new Date().toISOString()
  const maintenance=recordSideHustlePhysicalAssetMaintenance({
    asset,id:input.id,kind:input.kind,providerRef:input.providerRef,cost:input.cost,currency:input.currency,
    note:input.note,evidenceRefs:input.evidenceRefs,observedAt,
  })
  const shouldMove=(input.moveToMaintenance??true)&&asset.status!=='maintenance'
  const nextAsset=shouldMove?transitionSideHustlePhysicalAsset({
    asset,status:'maintenance',evidenceRefs:input.evidenceRefs,observedAt,
  }):asset
  if(shouldMove)await saveBatch([nextAsset,maintenance],repository)
  else await saveTyped(maintenance,repository)
  return{maintenance,asset:nextAsset}
}

export async function summarizeSpecializedSideHustleRuntime(input:{
  opportunityId:string
},repository:SideHustleSpecializedPersistence){
  const records=await repository.listSideHustleSpecializedRecords({opportunityId:requireText(input.opportunityId,'opportunityId')})
  return{
    opportunityId:input.opportunityId,
    ownedMediaProperties:records.filter(r=>r.kind==='owned_media_property').length,
    ownedMediaCycles:records.filter(r=>r.kind==='owned_media_cycle').length,
    ownedMediaPublications:records.filter(r=>r.kind==='owned_media_publication').length,
    ownedMediaAnalytics:records.filter(r=>r.kind==='owned_media_analytics').length,
    physicalAssets:records.filter(r=>r.kind==='physical_asset').length,
    activeBookings:records.filter(r=>r.kind==='physical_booking'&&['requested','reserved','checked_out'].includes(r.status??'')).length,
    custodyReceipts:records.filter(r=>r.kind==='physical_custody').length,
    maintenanceReceipts:records.filter(r=>r.kind==='physical_maintenance').length,
    externalActionAuthorized:false as const,
    publishingAuthorized:false as const,
    moneyMovementAuthorized:false as const,
  }
}

async function requireOpportunity(id:string,repository:SideHustleSpecializedPersistence){
  const stored=await repository.get(requireText(id,'opportunityId'))
  if(!stored)throw new Error('SIDE_HUSTLE_SPECIALIZED_OPPORTUNITY_NOT_FOUND')
  return stored
}

async function requirePayload<T extends SideHustleSpecializedRecord>(
  id:string,kind:SideHustleSpecializedRecordKind,repository:SideHustleSpecializedPersistence,
):Promise<T>{
  const stored=await repository.getSideHustleSpecializedRecord(requireText(id,'recordId'))
  if(!stored)throw new Error('SIDE_HUSTLE_SPECIALIZED_RECORD_NOT_FOUND')
  if(stored.kind!==kind)throw new Error('SIDE_HUSTLE_SPECIALIZED_RECORD_KIND_MISMATCH')
  return stored.payload as T
}

async function requireAssetAndBooking(
  assetId:string,bookingId:string,repository:SideHustleSpecializedPersistence,
):Promise<[SideHustlePhysicalAsset,SideHustlePhysicalAssetBooking]>{
  const [asset,booking]=await Promise.all([
    requirePayload<SideHustlePhysicalAsset>(assetId,'physical_asset',repository),
    requirePayload<SideHustlePhysicalAssetBooking>(bookingId,'physical_booking',repository),
  ])
  return[asset,booking]
}

async function saveTyped<T extends SideHustleSpecializedRecord>(
  record:T,repository:SideHustleSpecializedPersistence,
):Promise<T>{
  const kind=sideHustleSpecializedRecordKind(record)
  return await repository.saveSideHustleSpecializedRecord(kind,record) as T
}

async function saveBatch(
  records:SideHustleSpecializedRecord[],repository:SideHustleSpecializedPersistence,
){
  return repository.saveSideHustleSpecializedBatch(records.map(record=>({
    kind:sideHustleSpecializedRecordKind(record),record,
  })))
}

function requireText(value:string,field:string){
  if(typeof value!=='string'||!value.trim())throw new Error(`${field} is required`)
  return value.trim()
}
