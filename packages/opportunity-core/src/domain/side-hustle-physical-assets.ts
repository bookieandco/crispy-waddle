import {isSideHustleProfile} from './side-hustles.js'
import type {Opportunity} from './opportunity.js'

export type PhysicalAssetStatus=
  | 'planned'
  | 'available'
  | 'reserved'
  | 'checked_out'
  | 'maintenance'
  | 'retired'

export type SideHustlePhysicalAsset={
  id:string
  opportunityId:string
  family:'physical_asset_businesses'
  assetType:string
  label:string
  serialRef?:string
  locationRef?:string
  acquisitionCost?:number
  currency?:string
  evidenceRefs:string[]
  status:PhysicalAssetStatus
  createdAt:string
  updatedAt:string
  authority:'ASSET_REGISTRY_ONLY'
  externalActionAuthorized:false
  paymentAuthorized:false
  moneyMovementAuthorized:false
}

export type PhysicalAssetBookingStatus=
  | 'requested'
  | 'reserved'
  | 'checked_out'
  | 'returned'
  | 'cancelled'

export type SideHustlePhysicalAssetBooking={
  id:string
  opportunityId:string
  family:'physical_asset_businesses'
  assetId:string
  customerRef:string
  startsAt:string
  endsAt:string
  price:{amount:number;currency:string}
  depositTransactionRef?:string
  paymentTransactionRef?:string
  evidenceRefs:string[]
  status:PhysicalAssetBookingStatus
  createdAt:string
  updatedAt:string
  authority:'BOOKING_STATE_ONLY'
  externalActionAuthorized:false
  paymentAuthorized:false
  moneyMovementAuthorized:false
}

export type PhysicalAssetCustodyEventKind=
  | 'checkout'
  | 'return'
  | 'damage'
  | 'location_change'

export type SideHustlePhysicalAssetCustodyReceipt={
  id:string
  opportunityId:string
  family:'physical_asset_businesses'
  assetId:string
  bookingId?:string
  kind:PhysicalAssetCustodyEventKind
  fromRef?:string
  toRef?:string
  conditionNote?:string
  evidenceRefs:string[]
  observedAt:string
  authority:'CUSTODY_OBSERVATION_ONLY'
  externalActionAuthorized:false
}

export type PhysicalAssetMaintenanceKind='inspection'|'service'|'repair'|'damage'

export type SideHustlePhysicalAssetMaintenanceReceipt={
  id:string
  opportunityId:string
  family:'physical_asset_businesses'
  assetId:string
  kind:PhysicalAssetMaintenanceKind
  providerRef?:string
  cost?:number
  currency?:string
  note:string
  evidenceRefs:string[]
  observedAt:string
  authority:'MAINTENANCE_OBSERVATION_ONLY'
  externalActionAuthorized:false
  paymentAuthorized:false
  moneyMovementAuthorized:false
}

export type PhysicalAssetRecord=
  | SideHustlePhysicalAsset
  | SideHustlePhysicalAssetBooking
  | SideHustlePhysicalAssetCustodyReceipt
  | SideHustlePhysicalAssetMaintenanceReceipt

export type PhysicalAssetRecordKind='asset'|'booking'|'custody'|'maintenance'

export function createSideHustlePhysicalAsset(input:{
  opportunity:Opportunity
  id:string
  assetType:string
  label:string
  serialRef?:string
  locationRef?:string
  acquisitionCost?:number
  currency?:string
  evidenceRefs:string[]
  createdAt:string
}):SideHustlePhysicalAsset{
  requirePhysicalAssetOpportunity(input.opportunity)
  requireText(input.id,'asset.id')
  requireText(input.assetType,'asset.assetType')
  requireText(input.label,'asset.label')
  requireEvidence(input.evidenceRefs,'physical asset')
  requireDate(input.createdAt,'asset.createdAt')
  if(input.acquisitionCost!==undefined){
    validateMoney(input.acquisitionCost,input.currency,'asset acquisition')
  }
  return {
    id:input.id.trim(),
    opportunityId:input.opportunity.id,
    family:'physical_asset_businesses',
    assetType:input.assetType.trim(),
    label:input.label.trim(),
    serialRef:input.serialRef?.trim()||undefined,
    locationRef:input.locationRef?.trim()||undefined,
    acquisitionCost:input.acquisitionCost===undefined?undefined:roundMoney(input.acquisitionCost),
    currency:input.currency?.trim().toUpperCase(),
    evidenceRefs:unique(input.evidenceRefs),
    status:'planned',
    createdAt:input.createdAt,
    updatedAt:input.createdAt,
    authority:'ASSET_REGISTRY_ONLY',
    externalActionAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

export function transitionSideHustlePhysicalAsset(input:{
  asset:SideHustlePhysicalAsset
  status:PhysicalAssetStatus
  evidenceRefs:string[]
  observedAt:string
  locationRef?:string
}):SideHustlePhysicalAsset{
  const allowed:Record<PhysicalAssetStatus,PhysicalAssetStatus[]>={
    planned:['available','maintenance','retired'],
    available:['reserved','maintenance','retired'],
    reserved:['checked_out','available','maintenance','retired'],
    checked_out:['available','maintenance','retired'],
    maintenance:['available','retired'],
    retired:[],
  }
  if(input.status!==input.asset.status&&!allowed[input.asset.status].includes(input.status)){
    throw new Error(`Invalid physical asset transition: ${input.asset.status} -> ${input.status}`)
  }
  requireEvidence(input.evidenceRefs,'physical asset transition')
  requireDate(input.observedAt,'asset.updatedAt')
  return {
    ...input.asset,
    locationRef:input.locationRef?.trim()||input.asset.locationRef,
    evidenceRefs:unique([...input.asset.evidenceRefs,...input.evidenceRefs]),
    status:input.status,
    updatedAt:input.observedAt,
  }
}

export function createSideHustlePhysicalAssetBooking(input:{
  asset:SideHustlePhysicalAsset
  id:string
  customerRef:string
  startsAt:string
  endsAt:string
  price:{amount:number;currency:string}
  depositTransactionRef?:string
  paymentTransactionRef?:string
  evidenceRefs:string[]
  createdAt:string
}):SideHustlePhysicalAssetBooking{
  if(input.asset.status!=='available')throw new Error('Booking requires an available physical asset')
  requireText(input.id,'booking.id')
  requireText(input.customerRef,'booking.customerRef')
  requireDate(input.startsAt,'booking.startsAt')
  requireDate(input.endsAt,'booking.endsAt')
  if(Date.parse(input.endsAt)<=Date.parse(input.startsAt))throw new Error('Booking endsAt must follow startsAt')
  validateMoney(input.price.amount,input.price.currency,'booking price')
  requireEvidence(input.evidenceRefs,'physical asset booking')
  requireDate(input.createdAt,'booking.createdAt')
  return {
    id:input.id.trim(),
    opportunityId:input.asset.opportunityId,
    family:'physical_asset_businesses',
    assetId:input.asset.id,
    customerRef:input.customerRef.trim(),
    startsAt:input.startsAt,
    endsAt:input.endsAt,
    price:{amount:roundMoney(input.price.amount),currency:input.price.currency.trim().toUpperCase()},
    depositTransactionRef:input.depositTransactionRef?.trim()||undefined,
    paymentTransactionRef:input.paymentTransactionRef?.trim()||undefined,
    evidenceRefs:unique(input.evidenceRefs),
    status:'requested',
    createdAt:input.createdAt,
    updatedAt:input.createdAt,
    authority:'BOOKING_STATE_ONLY',
    externalActionAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

export function reserveSideHustlePhysicalAssetBooking(input:{
  asset:SideHustlePhysicalAsset
  booking:SideHustlePhysicalAssetBooking
  evidenceRefs:string[]
  reservedAt:string
}):{asset:SideHustlePhysicalAsset;booking:SideHustlePhysicalAssetBooking}{
  if(input.asset.status!=='available')throw new Error('Reservation requires available asset')
  if(input.booking.status!=='requested')throw new Error('Reservation requires requested booking')
  if(input.booking.assetId!==input.asset.id)throw new Error('Booking does not belong to physical asset')
  const evidence=unique(input.evidenceRefs)
  requireEvidence(evidence,'physical asset reservation')
  requireDate(input.reservedAt,'booking.reservedAt')
  return {
    asset:transitionSideHustlePhysicalAsset({
      asset:input.asset,status:'reserved',evidenceRefs:evidence,observedAt:input.reservedAt,
    }),
    booking:{
      ...input.booking,
      evidenceRefs:unique([...input.booking.evidenceRefs,...evidence]),
      status:'reserved',
      updatedAt:input.reservedAt,
    },
  }
}

export function checkoutSideHustlePhysicalAssetBooking(input:{
  asset:SideHustlePhysicalAsset
  booking:SideHustlePhysicalAssetBooking
  custodyReceiptId:string
  fromRef?:string
  toRef?:string
  conditionNote?:string
  evidenceRefs:string[]
  checkedOutAt:string
}):{
  asset:SideHustlePhysicalAsset
  booking:SideHustlePhysicalAssetBooking
  custody:SideHustlePhysicalAssetCustodyReceipt
}{
  if(input.asset.status!=='reserved'||input.booking.status!=='reserved')throw new Error('Checkout requires reserved asset and booking')
  if(input.booking.assetId!==input.asset.id)throw new Error('Checkout booking does not match asset')
  requireText(input.custodyReceiptId,'custody.id')
  requireEvidence(input.evidenceRefs,'physical asset checkout')
  requireDate(input.checkedOutAt,'checkout.checkedOutAt')
  const asset=transitionSideHustlePhysicalAsset({
    asset:input.asset,status:'checked_out',evidenceRefs:input.evidenceRefs,observedAt:input.checkedOutAt,
    locationRef:input.toRef,
  })
  const booking={
    ...input.booking,
    evidenceRefs:unique([...input.booking.evidenceRefs,...input.evidenceRefs]),
    status:'checked_out' as const,
    updatedAt:input.checkedOutAt,
  }
  return {
    asset,booking,
    custody:recordSideHustlePhysicalAssetCustody({
      asset,booking,id:input.custodyReceiptId,kind:'checkout',fromRef:input.fromRef,toRef:input.toRef,
      conditionNote:input.conditionNote,evidenceRefs:input.evidenceRefs,observedAt:input.checkedOutAt,
    }),
  }
}

export function returnSideHustlePhysicalAssetBooking(input:{
  asset:SideHustlePhysicalAsset
  booking:SideHustlePhysicalAssetBooking
  custodyReceiptId:string
  fromRef?:string
  toRef?:string
  conditionNote?:string
  evidenceRefs:string[]
  returnedAt:string
  requiresMaintenance?:boolean
}):{
  asset:SideHustlePhysicalAsset
  booking:SideHustlePhysicalAssetBooking
  custody:SideHustlePhysicalAssetCustodyReceipt
}{
  if(input.asset.status!=='checked_out'||input.booking.status!=='checked_out')throw new Error('Return requires checked-out asset and booking')
  if(input.booking.assetId!==input.asset.id)throw new Error('Return booking does not match asset')
  requireText(input.custodyReceiptId,'custody.id')
  requireEvidence(input.evidenceRefs,'physical asset return')
  requireDate(input.returnedAt,'return.returnedAt')
  const nextStatus=input.requiresMaintenance?'maintenance':'available'
  const asset=transitionSideHustlePhysicalAsset({
    asset:input.asset,status:nextStatus,evidenceRefs:input.evidenceRefs,observedAt:input.returnedAt,
    locationRef:input.toRef,
  })
  const booking={
    ...input.booking,
    evidenceRefs:unique([...input.booking.evidenceRefs,...input.evidenceRefs]),
    status:'returned' as const,
    updatedAt:input.returnedAt,
  }
  return {
    asset,booking,
    custody:recordSideHustlePhysicalAssetCustody({
      asset,booking,id:input.custodyReceiptId,kind:'return',fromRef:input.fromRef,toRef:input.toRef,
      conditionNote:input.conditionNote,evidenceRefs:input.evidenceRefs,observedAt:input.returnedAt,
    }),
  }
}

export function cancelSideHustlePhysicalAssetBooking(input:{
  asset:SideHustlePhysicalAsset
  booking:SideHustlePhysicalAssetBooking
  evidenceRefs:string[]
  cancelledAt:string
}):{asset:SideHustlePhysicalAsset;booking:SideHustlePhysicalAssetBooking}{
  if(!['requested','reserved'].includes(input.booking.status))throw new Error('Only requested or reserved booking may cancel')
  if(input.booking.assetId!==input.asset.id)throw new Error('Cancelled booking does not match asset')
  requireEvidence(input.evidenceRefs,'physical asset cancellation')
  requireDate(input.cancelledAt,'booking.cancelledAt')
  const asset=input.asset.status==='reserved'
    ?transitionSideHustlePhysicalAsset({asset:input.asset,status:'available',evidenceRefs:input.evidenceRefs,observedAt:input.cancelledAt})
    :input.asset
  return {
    asset,
    booking:{
      ...input.booking,
      evidenceRefs:unique([...input.booking.evidenceRefs,...input.evidenceRefs]),
      status:'cancelled',
      updatedAt:input.cancelledAt,
    },
  }
}

export function recordSideHustlePhysicalAssetCustody(input:{
  asset:SideHustlePhysicalAsset
  booking?:SideHustlePhysicalAssetBooking
  id:string
  kind:PhysicalAssetCustodyEventKind
  fromRef?:string
  toRef?:string
  conditionNote?:string
  evidenceRefs:string[]
  observedAt:string
}):SideHustlePhysicalAssetCustodyReceipt{
  if(input.booking&&input.booking.assetId!==input.asset.id)throw new Error('Custody booking does not match asset')
  requireText(input.id,'custody.id')
  requireEvidence(input.evidenceRefs,'physical asset custody')
  requireDate(input.observedAt,'custody.observedAt')
  return {
    id:input.id.trim(),
    opportunityId:input.asset.opportunityId,
    family:'physical_asset_businesses',
    assetId:input.asset.id,
    bookingId:input.booking?.id,
    kind:input.kind,
    fromRef:input.fromRef?.trim()||undefined,
    toRef:input.toRef?.trim()||undefined,
    conditionNote:input.conditionNote?.trim()||undefined,
    evidenceRefs:unique(input.evidenceRefs),
    observedAt:input.observedAt,
    authority:'CUSTODY_OBSERVATION_ONLY',
    externalActionAuthorized:false,
  }
}

export function recordSideHustlePhysicalAssetMaintenance(input:{
  asset:SideHustlePhysicalAsset
  id:string
  kind:PhysicalAssetMaintenanceKind
  providerRef?:string
  cost?:number
  currency?:string
  note:string
  evidenceRefs:string[]
  observedAt:string
}):SideHustlePhysicalAssetMaintenanceReceipt{
  requireText(input.id,'maintenance.id')
  requireText(input.note,'maintenance.note')
  requireEvidence(input.evidenceRefs,'physical asset maintenance')
  requireDate(input.observedAt,'maintenance.observedAt')
  if(input.cost!==undefined)validateMoney(input.cost,input.currency,'maintenance cost')
  return {
    id:input.id.trim(),
    opportunityId:input.asset.opportunityId,
    family:'physical_asset_businesses',
    assetId:input.asset.id,
    kind:input.kind,
    providerRef:input.providerRef?.trim()||undefined,
    cost:input.cost===undefined?undefined:roundMoney(input.cost),
    currency:input.currency?.trim().toUpperCase(),
    note:input.note.trim(),
    evidenceRefs:unique(input.evidenceRefs),
    observedAt:input.observedAt,
    authority:'MAINTENANCE_OBSERVATION_ONLY',
    externalActionAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

export function physicalAssetRecordKind(record:PhysicalAssetRecord):PhysicalAssetRecordKind{
  if('assetType'in record)return'asset'
  if('customerRef'in record)return'booking'
  if('fromRef'in record||('bookingId'in record&&'conditionNote'in record))return'custody'
  return'maintenance'
}

function requirePhysicalAssetOpportunity(opportunity:Opportunity){
  const profile=opportunity.metadata?.sideHustleProfile
  if(!isSideHustleProfile(profile)||profile.family!=='physical_asset_businesses'){
    throw new Error('Physical-asset runtime requires a physical_asset_businesses Opportunity')
  }
  if(!['ready','approved','pursuing'].includes(opportunity.status))throw new Error('Physical-asset runtime requires a ready or active Opportunity')
}
function validateMoney(amount:number,currency:string|undefined,label:string){
  if(!Number.isFinite(amount)||amount<0)throw new Error(`${label} amount must be non-negative`)
  if(!currency?.trim())throw new Error(`${label} currency is required`)
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
