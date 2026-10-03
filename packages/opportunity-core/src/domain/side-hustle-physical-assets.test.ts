import assert from 'node:assert/strict'
import type {Opportunity} from './opportunity.js'
import {buildSideHustleProfile} from './side-hustles.js'
import {
  checkoutSideHustlePhysicalAssetBooking,
  createSideHustlePhysicalAsset,
  createSideHustlePhysicalAssetBooking,
  physicalAssetRecordKind,
  recordSideHustlePhysicalAssetMaintenance,
  reserveSideHustlePhysicalAssetBooking,
  returnSideHustlePhysicalAssetBooking,
  transitionSideHustlePhysicalAsset,
} from './side-hustle-physical-assets.js'

const now='2026-10-03T15:00:00.000Z'
const opportunity:Opportunity={
  id:'opportunity:asset:1',title:'Asset rental',family:'business',type:'commercial',
  sourceName:'Physical asset test',sourceUrl:'https://example.test/asset',
  claims:[],evidence:[],verificationStatus:'unverified',sourceConfidence:.9,riskFlags:[],
  metadata:{sideHustleProfile:buildSideHustleProfile({family:'physical_asset_businesses'})},
  status:'ready',createdAt:now,updatedAt:now,
}
let asset=createSideHustlePhysicalAsset({
  opportunity,id:'asset:1',assetType:'camera',label:'Camera One',serialRef:'serial:1',
  locationRef:'location:home',acquisitionCost:500,currency:'USD',
  evidenceRefs:['evidence:asset'],createdAt:now,
})
assert.equal(physicalAssetRecordKind(asset),'asset')
asset=transitionSideHustlePhysicalAsset({
  asset,status:'available',evidenceRefs:['evidence:ready'],observedAt:'2026-10-03T15:01:00.000Z',
})
let booking=createSideHustlePhysicalAssetBooking({
  asset,id:'booking:1',customerRef:'relationship:customer:1',
  startsAt:'2026-10-04T10:00:00.000Z',endsAt:'2026-10-05T10:00:00.000Z',
  price:{amount:80,currency:'USD'},depositTransactionRef:'transaction:deposit:1',
  evidenceRefs:['evidence:booking'],createdAt:'2026-10-03T15:02:00.000Z',
})
assert.equal(physicalAssetRecordKind(booking),'booking')
let reserved=reserveSideHustlePhysicalAssetBooking({
  asset,booking,evidenceRefs:['evidence:reserve'],reservedAt:'2026-10-03T15:03:00.000Z',
})
asset=reserved.asset;booking=reserved.booking
assert.equal(asset.status,'reserved')
const checkout=checkoutSideHustlePhysicalAssetBooking({
  asset,booking,custodyReceiptId:'custody:checkout:1',fromRef:'location:home',toRef:'customer:1',
  conditionNote:'Good condition',evidenceRefs:['evidence:checkout'],checkedOutAt:'2026-10-04T10:00:00.000Z',
})
asset=checkout.asset;booking=checkout.booking
assert.equal(physicalAssetRecordKind(checkout.custody),'custody')
assert.equal(asset.status,'checked_out')
const returned=returnSideHustlePhysicalAssetBooking({
  asset,booking,custodyReceiptId:'custody:return:1',fromRef:'customer:1',toRef:'location:home',
  conditionNote:'Lens needs inspection',evidenceRefs:['evidence:return'],
  returnedAt:'2026-10-05T10:00:00.000Z',requiresMaintenance:true,
})
asset=returned.asset;booking=returned.booking
assert.equal(booking.status,'returned')
assert.equal(asset.status,'maintenance')
const maintenance=recordSideHustlePhysicalAssetMaintenance({
  asset,id:'maintenance:1',kind:'inspection',providerRef:'operator:1',cost:15,currency:'USD',
  note:'Inspected lens and cleared for use.',evidenceRefs:['evidence:maintenance'],
  observedAt:'2026-10-05T12:00:00.000Z',
})
assert.equal(physicalAssetRecordKind(maintenance),'maintenance')
assert.equal(maintenance.moneyMovementAuthorized,false)
asset=transitionSideHustlePhysicalAsset({
  asset,status:'available',evidenceRefs:['evidence:maintenance-complete'],observedAt:'2026-10-05T12:05:00.000Z',
})
assert.equal(asset.status,'available')
assert.equal(asset.paymentAuthorized,false)

console.log('side hustle physical asset tests passed')
