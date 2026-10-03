import {describe,expect,it} from 'vitest'
import {
  buildSideHustleProfile,
  type Opportunity,
  type SideHustleSpecializedRecord,
  type SideHustleSpecializedRecordKind,
} from '@jhadina/opportunity-core'
import type {StoredCanonicalOpportunity} from './canonical'
import type {StoredSideHustleSpecializedRecord} from './supabase-opportunity-repository'
import {
  checkoutPhysicalAssetBookingRuntime,
  createOwnedMediaCycleRuntime,
  createOwnedMediaPropertyRuntime,
  createPhysicalAssetBookingRuntime,
  createPhysicalAssetRuntime,
  observeOwnedMediaAnalyticsRuntime,
  observeOwnedMediaMonetizationRuntime,
  recordOwnedMediaPublicationRuntime,
  recordPhysicalAssetMaintenanceRuntime,
  reservePhysicalAssetBookingRuntime,
  returnPhysicalAssetBookingRuntime,
  summarizeSpecializedSideHustleRuntime,
  transitionOwnedMediaCycleRuntime,
  transitionPhysicalAssetRuntime,
  type SideHustleSpecializedPersistence,
} from './side-hustle-specialized-runtime'

const now='2026-10-03T15:30:00.000Z'

function opportunity(id:string,family:'owned_media'|'physical_asset_businesses'):Opportunity{
  return {
    id,title:id,family:'business',type:'commercial',
    sourceName:'specialized runtime test',sourceUrl:'https://example.test/specialized',
    claims:[],evidence:[],verificationStatus:'unverified',sourceConfidence:.9,riskFlags:[],
    metadata:{sideHustleProfile:buildSideHustleProfile({family})},
    status:'ready',createdAt:now,updatedAt:now,
  }
}

function recordedAt(record:any){
  return record.updatedAt??record.publishedAt??record.observedAt
}

function fixture(){
  const owned=opportunity('opportunity:owned','owned_media')
  const assets=opportunity('opportunity:assets','physical_asset_businesses')
  const opportunities=new Map<string,StoredCanonicalOpportunity>([
    [owned.id,{userId:'owner:test',opportunity:owned,triageState:'saved'}],
    [assets.id,{userId:'owner:test',opportunity:assets,triageState:'saved'}],
  ])
  const records=new Map<string,StoredSideHustleSpecializedRecord>()
  const persist=(kind:SideHustleSpecializedRecordKind,record:SideHustleSpecializedRecord)=>{
    records.set(record.id,{
      id:record.id,opportunityId:record.opportunityId,family:record.family,kind,
      status:'status'in record?String(record.status):undefined,
      payload:structuredClone(record),recordedAt:recordedAt(record),
    })
    return record
  }
  const repository:SideHustleSpecializedPersistence={
    async get(id){return opportunities.get(id)},
    async getSideHustleSpecializedRecord(id){return records.get(id)},
    async listSideHustleSpecializedRecords(input={}){
      return [...records.values()].filter(row=>
        (!input.opportunityId||row.opportunityId===input.opportunityId)&&
        (!input.family||row.family===input.family)&&
        (!input.kind||row.kind===input.kind)
      )
    },
    async saveSideHustleSpecializedRecord(kind,record){return persist(kind,record)},
    async saveSideHustleSpecializedBatch(items){
      return items.map(item=>persist(item.kind,item.record))
    },
  }
  return{repository,records}
}

describe('specialized Side Hustle runtime',()=>{
  it('runs Owned Media through production, approval, publication, analytics and monetization',async()=>{
    const f=fixture()
    const property=await createOwnedMediaPropertyRuntime({
      opportunityId:'opportunity:owned',id:'property:1',propertyType:'youtube_channel',
      label:'Channel One',providerRef:'youtube:channel:1',evidenceRefs:['evidence:property'],createdAt:now,
    },f.repository)
    let cycle=await createOwnedMediaCycleRuntime({
      propertyId:property.id,id:'cycle:1',title:'Video one',topicRef:'topic:1',
      evidenceRefs:['evidence:topic'],createdAt:'2026-10-03T15:31:00.000Z',
    },f.repository)
    cycle=await transitionOwnedMediaCycleRuntime({
      cycleId:cycle.id,status:'produced',productionRef:'director:production:1',
      evidenceRefs:['evidence:production'],observedAt:'2026-10-03T15:32:00.000Z',
    },f.repository)
    cycle=await transitionOwnedMediaCycleRuntime({
      cycleId:cycle.id,status:'approved',approvalRef:'approval:1',
      evidenceRefs:['evidence:approval'],observedAt:'2026-10-03T15:33:00.000Z',
    },f.repository)
    const published=await recordOwnedMediaPublicationRuntime({
      propertyId:property.id,cycleId:cycle.id,id:'publication:1',
      providerRef:'youtube',externalContentRef:'youtube:video:1',
      evidenceRefs:['evidence:publish'],publishedAt:'2026-10-03T15:34:00.000Z',
    },f.repository)
    expect(published.cycle.status).toBe('published')
    expect(published.publication.publishingAuthorized).toBe(false)

    const measured=await observeOwnedMediaAnalyticsRuntime({
      propertyId:property.id,cycleId:cycle.id,id:'analytics:1',providerRef:'youtube',
      views:250,watchSeconds:12000,conversions:1,grossRevenue:12.5,currency:'USD',
      evidenceRefs:['evidence:analytics'],observedAt:'2026-10-04T15:30:00.000Z',
    },f.repository)
    expect(measured.cycle.status).toBe('measured')
    expect(measured.analytics.moneyMovementAuthorized).toBe(false)

    const revenue=await observeOwnedMediaMonetizationRuntime({
      propertyId:property.id,cycleId:cycle.id,id:'monetization:1',kind:'advertising',
      amount:12.5,currency:'USD',providerRef:'youtube',evidenceRefs:['evidence:revenue'],
      observedAt:'2026-10-04T15:31:00.000Z',
    },f.repository)
    expect(revenue.paymentAuthorized).toBe(false)

    const summary=await summarizeSpecializedSideHustleRuntime({opportunityId:'opportunity:owned'},f.repository)
    expect(summary).toMatchObject({
      ownedMediaProperties:1,ownedMediaCycles:1,ownedMediaPublications:1,ownedMediaAnalytics:1,
      externalActionAuthorized:false,publishingAuthorized:false,moneyMovementAuthorized:false,
    })
  })

  it('runs physical asset reservation, custody, return and maintenance',async()=>{
    const f=fixture()
    let asset=await createPhysicalAssetRuntime({
      opportunityId:'opportunity:assets',id:'asset:1',assetType:'camera',label:'Camera One',
      locationRef:'location:home',acquisitionCost:500,currency:'USD',
      evidenceRefs:['evidence:asset'],createdAt:now,
    },f.repository)
    asset=await transitionPhysicalAssetRuntime({
      assetId:asset.id,status:'available',evidenceRefs:['evidence:ready'],
      observedAt:'2026-10-03T15:31:00.000Z',
    },f.repository)
    let booking=await createPhysicalAssetBookingRuntime({
      assetId:asset.id,id:'booking:1',customerRef:'relationship:customer:1',
      startsAt:'2026-10-04T10:00:00.000Z',endsAt:'2026-10-05T10:00:00.000Z',
      price:{amount:80,currency:'USD'},depositTransactionRef:'transaction:deposit:1',
      evidenceRefs:['evidence:booking'],createdAt:'2026-10-03T15:32:00.000Z',
    },f.repository)
    const reserved=await reservePhysicalAssetBookingRuntime({
      assetId:asset.id,bookingId:booking.id,evidenceRefs:['evidence:reserve'],
      reservedAt:'2026-10-03T15:33:00.000Z',
    },f.repository)
    asset=reserved.asset;booking=reserved.booking
    expect(asset.status).toBe('reserved')

    const checked=await checkoutPhysicalAssetBookingRuntime({
      assetId:asset.id,bookingId:booking.id,custodyReceiptId:'custody:out:1',
      fromRef:'location:home',toRef:'customer:1',conditionNote:'Good condition',
      evidenceRefs:['evidence:checkout'],checkedOutAt:'2026-10-04T10:00:00.000Z',
    },f.repository)
    asset=checked.asset;booking=checked.booking
    expect(asset.status).toBe('checked_out')
    expect(checked.custody.externalActionAuthorized).toBe(false)

    const returned=await returnPhysicalAssetBookingRuntime({
      assetId:asset.id,bookingId:booking.id,custodyReceiptId:'custody:return:1',
      fromRef:'customer:1',toRef:'location:home',conditionNote:'Inspect lens',
      evidenceRefs:['evidence:return'],returnedAt:'2026-10-05T10:00:00.000Z',
      requiresMaintenance:true,
    },f.repository)
    asset=returned.asset
    expect(asset.status).toBe('maintenance')

    const maintenance=await recordPhysicalAssetMaintenanceRuntime({
      assetId:asset.id,id:'maintenance:1',kind:'inspection',cost:15,currency:'USD',
      note:'Inspected and cleared.',evidenceRefs:['evidence:maintenance'],
      observedAt:'2026-10-05T12:00:00.000Z',moveToMaintenance:false,
    },f.repository)
    expect(maintenance.maintenance.moneyMovementAuthorized).toBe(false)

    const summary=await summarizeSpecializedSideHustleRuntime({opportunityId:'opportunity:assets'},f.repository)
    expect(summary.physicalAssets).toBe(1)
    expect(summary.custodyReceipts).toBe(2)
    expect(summary.maintenanceReceipts).toBe(1)
  })
})
