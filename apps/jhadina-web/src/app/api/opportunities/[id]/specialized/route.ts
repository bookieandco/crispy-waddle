import {NextResponse} from 'next/server'
import type {
  OwnedMediaCycleStatus,
  OwnedMediaMonetizationKind,
  OwnedMediaPropertyStatus,
  OwnedMediaPropertyType,
  PhysicalAssetStatus,
} from '@jhadina/opportunity-core'
import {requireRequestIdentity} from '@/lib/auth/request-user'
import {createSupabaseOpportunityRepository} from '@/lib/opportunities/supabase-opportunity-repository'
import {
  cancelPhysicalAssetBookingRuntime,
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
  setOwnedMediaPropertyStatusRuntime,
  summarizeSpecializedSideHustleRuntime,
  transitionOwnedMediaCycleRuntime,
  transitionPhysicalAssetRuntime,
} from '@/lib/opportunities/side-hustle-specialized-runtime'

export const dynamic='force-dynamic'
export const runtime='nodejs'

type Body=Record<string,unknown>&{action?:string}

const text=(body:Body,key:string)=>{
  const value=body[key]
  if(typeof value!=='string'||!value.trim())throw new Error(`${key} is required`)
  return value.trim()
}
const optionalText=(body:Body,key:string)=>typeof body[key]==='string'&&String(body[key]).trim()?String(body[key]).trim():undefined
const strings=(body:Body,key:string)=>{
  const value=body[key]
  if(!Array.isArray(value)||!value.length||value.some(item=>typeof item!=='string'||!item.trim())){
    throw new Error(`${key} is required`)
  }
  return value as string[]
}
const numberValue=(body:Body,key:string)=>{
  const value=body[key]
  if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`${key} must be a number`)
  return value
}
const optionalNumber=(body:Body,key:string)=>typeof body[key]==='number'&&Number.isFinite(body[key])?body[key] as number:undefined
const optionalBoolean=(body:Body,key:string)=>typeof body[key]==='boolean'?body[key] as boolean:undefined

function fail(requestId:string,message:string,status=400){
  return NextResponse.json({ok:false,requestId,error:message},{status,headers:{'cache-control':'no-store'}})
}
function statusFor(message:string){
  if(/Authenticated|identity|session/i.test(message))return 401
  if(/NOT_FOUND/.test(message))return 404
  if(/MISMATCH|requires|Invalid|invalid|cannot|must|Only/i.test(message))return 409
  return 400
}

export async function GET(_request:Request,context:{params:{id:string}}){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const repository=createSupabaseOpportunityRepository()
    const [summary,records]=await Promise.all([
      summarizeSpecializedSideHustleRuntime({opportunityId:context.params.id},repository),
      repository.listSideHustleSpecializedRecords({opportunityId:context.params.id}),
    ])
    return NextResponse.json({ok:true,requestId,summary,records},{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to load specialized Side Hustle state'
    return fail(requestId,message,statusFor(message))
  }
}

export async function POST(request:Request,context:{params:{id:string}}){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const body=await request.json().catch(()=>({})) as Body
    const action=text(body,'action')
    const repository=createSupabaseOpportunityRepository()
    let result:unknown

    switch(action){
      case 'create_media_property':
        result=await createOwnedMediaPropertyRuntime({
          opportunityId:context.params.id,id:text(body,'id'),
          propertyType:text(body,'propertyType') as OwnedMediaPropertyType,
          label:text(body,'label'),providerRef:optionalText(body,'providerRef'),
          evidenceRefs:strings(body,'evidenceRefs'),createdAt:optionalText(body,'createdAt'),
        },repository);break

      case 'set_media_property_status':
        result=await setOwnedMediaPropertyStatusRuntime({
          propertyId:text(body,'propertyId'),status:text(body,'status') as OwnedMediaPropertyStatus,
          evidenceRefs:strings(body,'evidenceRefs'),observedAt:optionalText(body,'observedAt'),
        },repository);break

      case 'create_media_cycle':
        result=await createOwnedMediaCycleRuntime({
          propertyId:text(body,'propertyId'),id:text(body,'id'),title:text(body,'title'),
          topicRef:text(body,'topicRef'),evidenceRefs:strings(body,'evidenceRefs'),
          createdAt:optionalText(body,'createdAt'),
        },repository);break

      case 'transition_media_cycle':
        result=await transitionOwnedMediaCycleRuntime({
          cycleId:text(body,'cycleId'),
          status:text(body,'status') as Exclude<OwnedMediaCycleStatus,'planned'|'published'|'measured'>,
          evidenceRefs:strings(body,'evidenceRefs'),observedAt:optionalText(body,'observedAt'),
          productionRef:optionalText(body,'productionRef'),approvalRef:optionalText(body,'approvalRef'),
        },repository);break

      case 'record_media_publication':
        result=await recordOwnedMediaPublicationRuntime({
          propertyId:text(body,'propertyId'),cycleId:text(body,'cycleId'),id:text(body,'id'),
          providerRef:text(body,'providerRef'),externalContentRef:text(body,'externalContentRef'),
          canonicalUrl:optionalText(body,'canonicalUrl'),evidenceRefs:strings(body,'evidenceRefs'),
          publishedAt:optionalText(body,'publishedAt'),
        },repository);break

      case 'observe_media_analytics':
        result=await observeOwnedMediaAnalyticsRuntime({
          propertyId:text(body,'propertyId'),cycleId:text(body,'cycleId'),id:text(body,'id'),
          providerRef:text(body,'providerRef'),impressions:optionalNumber(body,'impressions'),
          views:optionalNumber(body,'views'),watchSeconds:optionalNumber(body,'watchSeconds'),
          clicks:optionalNumber(body,'clicks'),leads:optionalNumber(body,'leads'),
          conversions:optionalNumber(body,'conversions'),grossRevenue:optionalNumber(body,'grossRevenue'),
          currency:optionalText(body,'currency'),evidenceRefs:strings(body,'evidenceRefs'),
          observedAt:optionalText(body,'observedAt'),markMeasured:optionalBoolean(body,'markMeasured'),
        },repository);break

      case 'observe_media_monetization':
        result=await observeOwnedMediaMonetizationRuntime({
          propertyId:text(body,'propertyId'),cycleId:optionalText(body,'cycleId'),id:text(body,'id'),
          kind:text(body,'kind') as OwnedMediaMonetizationKind,amount:numberValue(body,'amount'),
          currency:text(body,'currency'),transactionRef:optionalText(body,'transactionRef'),
          providerRef:optionalText(body,'providerRef'),evidenceRefs:strings(body,'evidenceRefs'),
          observedAt:optionalText(body,'observedAt'),
        },repository);break

      case 'create_asset':
        result=await createPhysicalAssetRuntime({
          opportunityId:context.params.id,id:text(body,'id'),assetType:text(body,'assetType'),
          label:text(body,'label'),serialRef:optionalText(body,'serialRef'),
          locationRef:optionalText(body,'locationRef'),acquisitionCost:optionalNumber(body,'acquisitionCost'),
          currency:optionalText(body,'currency'),evidenceRefs:strings(body,'evidenceRefs'),
          createdAt:optionalText(body,'createdAt'),
        },repository);break

      case 'transition_asset':
        result=await transitionPhysicalAssetRuntime({
          assetId:text(body,'assetId'),status:text(body,'status') as PhysicalAssetStatus,
          evidenceRefs:strings(body,'evidenceRefs'),observedAt:optionalText(body,'observedAt'),
          locationRef:optionalText(body,'locationRef'),
        },repository);break

      case 'create_booking':
        result=await createPhysicalAssetBookingRuntime({
          assetId:text(body,'assetId'),id:text(body,'id'),customerRef:text(body,'customerRef'),
          startsAt:text(body,'startsAt'),endsAt:text(body,'endsAt'),
          price:{amount:numberValue(body,'amount'),currency:text(body,'currency')},
          depositTransactionRef:optionalText(body,'depositTransactionRef'),
          paymentTransactionRef:optionalText(body,'paymentTransactionRef'),
          evidenceRefs:strings(body,'evidenceRefs'),createdAt:optionalText(body,'createdAt'),
        },repository);break

      case 'reserve_booking':
        result=await reservePhysicalAssetBookingRuntime({
          assetId:text(body,'assetId'),bookingId:text(body,'bookingId'),
          evidenceRefs:strings(body,'evidenceRefs'),reservedAt:optionalText(body,'observedAt'),
        },repository);break

      case 'checkout_booking':
        result=await checkoutPhysicalAssetBookingRuntime({
          assetId:text(body,'assetId'),bookingId:text(body,'bookingId'),
          custodyReceiptId:text(body,'custodyReceiptId'),fromRef:optionalText(body,'fromRef'),
          toRef:optionalText(body,'toRef'),conditionNote:optionalText(body,'conditionNote'),
          evidenceRefs:strings(body,'evidenceRefs'),checkedOutAt:optionalText(body,'observedAt'),
        },repository);break

      case 'return_booking':
        result=await returnPhysicalAssetBookingRuntime({
          assetId:text(body,'assetId'),bookingId:text(body,'bookingId'),
          custodyReceiptId:text(body,'custodyReceiptId'),fromRef:optionalText(body,'fromRef'),
          toRef:optionalText(body,'toRef'),conditionNote:optionalText(body,'conditionNote'),
          evidenceRefs:strings(body,'evidenceRefs'),returnedAt:optionalText(body,'observedAt'),
          requiresMaintenance:optionalBoolean(body,'requiresMaintenance'),
        },repository);break

      case 'cancel_booking':
        result=await cancelPhysicalAssetBookingRuntime({
          assetId:text(body,'assetId'),bookingId:text(body,'bookingId'),
          evidenceRefs:strings(body,'evidenceRefs'),cancelledAt:optionalText(body,'observedAt'),
        },repository);break

      case 'record_maintenance':
        result=await recordPhysicalAssetMaintenanceRuntime({
          assetId:text(body,'assetId'),id:text(body,'id'),
          kind:text(body,'kind') as 'inspection'|'service'|'repair'|'damage',
          providerRef:optionalText(body,'providerRef'),cost:optionalNumber(body,'cost'),
          currency:optionalText(body,'currency'),note:text(body,'note'),
          evidenceRefs:strings(body,'evidenceRefs'),observedAt:optionalText(body,'observedAt'),
          moveToMaintenance:optionalBoolean(body,'moveToMaintenance'),
        },repository);break

      default:return fail(requestId,'Unsupported specialized Side Hustle action')
    }

    return NextResponse.json({
      ok:true,requestId,result,externalActionAuthorized:false,publishingAuthorized:false,
      paymentAuthorized:false,moneyMovementAuthorized:false,
    },{status:201,headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to mutate specialized Side Hustle state'
    return fail(requestId,message,statusFor(message))
  }
}
