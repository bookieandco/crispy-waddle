import {NextResponse} from 'next/server'
import type {
  SideHustleAffiliateEconomicState,
  SideHustleAffiliateEventKind,
  SideHustleBillingCadence,
  SideHustleDeliveryMode,
  SideHustleDirectoryListingStatus,
  SideHustleSubscriptionStatus,
} from '@jhadina/opportunity-core'
import {requireRequestIdentity} from '@/lib/auth/request-user'
import {createSupabaseOpportunityRepository} from '@/lib/opportunities/supabase-opportunity-repository'
import {
  activateSideHustleCommerceOfferRuntime,
  createSideHustleCommerceOfferRuntime,
  createSideHustleDirectoryListingRuntime,
  endSideHustleEntitlementRuntime,
  grantSideHustleEntitlementRuntime,
  observeSideHustleSubscriptionRuntime,
  recordSideHustleAffiliateEventRuntime,
  recordSideHustleDigitalDeliveryRuntime,
  recordSideHustleRefundReversalRuntime,
  retireSideHustleCommerceOfferRuntime,
  summarizeSideHustleCommerceRuntime,
  transitionSideHustleDirectoryListingRuntime,
} from '@/lib/opportunities/side-hustle-commerce-runtime'

export const dynamic='force-dynamic'
export const runtime='nodejs'

type Body={
  action?:string
  id?:string
  offerId?:string
  entitlementId?:string
  listingId?:string
  title?:string
  description?:string
  summary?:string
  ownerRef?:string
  customerRef?:string
  sourceTransactionRef?:string
  transactionRef?:string
  providerRef?:string
  programRef?:string
  externalEventRef?:string
  customerOrSessionRef?:string
  deliveryRef?:string
  artifactRefs?:string[]
  evidenceRefs?:string[]
  reason?:string
  moderationNote?:string
  status?:string
  providerStatus?:string
  economicState?:SideHustleAffiliateEconomicState
  amount?:number
  currency?:string
  billing?:{amount:number;currency:string;cadence:SideHustleBillingCadence}
  deliveryMode?:SideHustleDeliveryMode
  periodStart?:string
  periodEnd?:string
  expiresAt?:string
  observedAt?:string
  occurredAt?:string
  createdAt?:string
}

function fail(requestId:string,message:string,status=400){
  return NextResponse.json({ok:false,requestId,error:message},{status,headers:{'cache-control':'no-store'}})
}

function statusFor(message:string){
  if(/Authenticated|identity|session/i.test(message))return 401
  if(/NOT_FOUND/.test(message))return 404
  if(/MISMATCH|requires|invalid|Only|cannot|must/i.test(message))return 409
  return 400
}

export async function GET(_request:Request,context:{params:{id:string}}){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const repository=createSupabaseOpportunityRepository()
    const [summary,records]=await Promise.all([
      summarizeSideHustleCommerceRuntime({opportunityId:context.params.id},repository),
      repository.listSideHustleCommerceRecords({opportunityId:context.params.id}),
    ])
    return NextResponse.json({ok:true,requestId,summary,records},{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to load Side Hustle commerce state'
    return fail(requestId,message,statusFor(message))
  }
}

export async function POST(request:Request,context:{params:{id:string}}){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const body=await request.json().catch(()=>({})) as Body
    const action=body.action?.trim()
    if(!action)return fail(requestId,'Commerce action is required')
    const repository=createSupabaseOpportunityRepository()
    let record:unknown

    switch(action){
      case 'create_offer':
        if(!body.id||!body.title||!body.description||!body.billing||!body.deliveryMode||!body.evidenceRefs?.length){
          return fail(requestId,'create_offer fields are incomplete')
        }
        record=await createSideHustleCommerceOfferRuntime({
          opportunityId:context.params.id,id:body.id,title:body.title,description:body.description,
          billing:body.billing,deliveryMode:body.deliveryMode,providerRef:body.providerRef,
          evidenceRefs:body.evidenceRefs,createdAt:body.createdAt,
        },repository)
        break

      case 'activate_offer':
        if(!body.offerId||!body.evidenceRefs?.length)return fail(requestId,'activate_offer fields are incomplete')
        record=await activateSideHustleCommerceOfferRuntime({
          offerId:body.offerId,evidenceRefs:body.evidenceRefs,activatedAt:body.observedAt,
        },repository)
        break

      case 'retire_offer':
        if(!body.offerId||!body.evidenceRefs?.length)return fail(requestId,'retire_offer fields are incomplete')
        record=await retireSideHustleCommerceOfferRuntime({
          offerId:body.offerId,evidenceRefs:body.evidenceRefs,retiredAt:body.observedAt,
        },repository)
        break

      case 'grant_entitlement':
        if(!body.offerId||!body.id||!body.customerRef||!body.sourceTransactionRef||!body.evidenceRefs?.length){
          return fail(requestId,'grant_entitlement fields are incomplete')
        }
        record=await grantSideHustleEntitlementRuntime({
          offerId:body.offerId,id:body.id,customerRef:body.customerRef,
          sourceTransactionRef:body.sourceTransactionRef,evidenceRefs:body.evidenceRefs,
          grantedAt:body.observedAt,expiresAt:body.expiresAt,
        },repository)
        break

      case 'end_entitlement':
        if(!body.entitlementId||!body.status||!body.reason||!body.evidenceRefs?.length){
          return fail(requestId,'end_entitlement fields are incomplete')
        }
        if(!['expired','revoked'].includes(body.status))return fail(requestId,'Invalid entitlement status')
        record=await endSideHustleEntitlementRuntime({
          entitlementId:body.entitlementId,status:body.status as 'expired'|'revoked',
          reason:body.reason,evidenceRefs:body.evidenceRefs,endedAt:body.observedAt,
        },repository)
        break

      case 'observe_subscription':
        if(!body.offerId||!body.id||!body.customerRef||!body.providerRef||!body.status||!body.evidenceRefs?.length){
          return fail(requestId,'observe_subscription fields are incomplete')
        }
        record=await observeSideHustleSubscriptionRuntime({
          offerId:body.offerId,id:body.id,customerRef:body.customerRef,providerRef:body.providerRef,
          status:body.status as SideHustleSubscriptionStatus,periodStart:body.periodStart,periodEnd:body.periodEnd,
          transactionRef:body.transactionRef,evidenceRefs:body.evidenceRefs,observedAt:body.observedAt,
        },repository)
        break

      case 'record_delivery':
        if(!body.offerId||!body.entitlementId||!body.id||!body.deliveryRef||!body.artifactRefs?.length||!body.evidenceRefs?.length){
          return fail(requestId,'record_delivery fields are incomplete')
        }
        record=await recordSideHustleDigitalDeliveryRuntime({
          offerId:body.offerId,entitlementId:body.entitlementId,id:body.id,
          deliveryRef:body.deliveryRef,artifactRefs:body.artifactRefs,evidenceRefs:body.evidenceRefs,
          deliveredAt:body.observedAt,
        },repository)
        break

      case 'create_listing':
        if(!body.offerId||!body.id||!body.ownerRef||!body.title||!body.summary||!body.evidenceRefs?.length){
          return fail(requestId,'create_listing fields are incomplete')
        }
        record=await createSideHustleDirectoryListingRuntime({
          offerId:body.offerId,id:body.id,ownerRef:body.ownerRef,title:body.title,summary:body.summary,
          evidenceRefs:body.evidenceRefs,createdAt:body.createdAt,
        },repository)
        break

      case 'transition_listing':
        if(!body.listingId||!body.status||!body.evidenceRefs?.length){
          return fail(requestId,'transition_listing fields are incomplete')
        }
        if(!['pending_review','approved','rejected','published','retired'].includes(body.status)){
          return fail(requestId,'Invalid listing status')
        }
        record=await transitionSideHustleDirectoryListingRuntime({
          listingId:body.listingId,status:body.status as Exclude<SideHustleDirectoryListingStatus,'draft'>,
          evidenceRefs:body.evidenceRefs,observedAt:body.observedAt,moderationNote:body.moderationNote,
        },repository)
        break

      case 'record_refund_reversal':
        if(!body.offerId||!body.id||!body.customerRef||!body.transactionRef||body.amount===undefined||!body.reason||!body.evidenceRefs?.length){
          return fail(requestId,'record_refund_reversal fields are incomplete')
        }
        record=await recordSideHustleRefundReversalRuntime({
          offerId:body.offerId,id:body.id,customerRef:body.customerRef,transactionRef:body.transactionRef,
          amount:body.amount,currency:body.currency,reason:body.reason,evidenceRefs:body.evidenceRefs,
          observedAt:body.observedAt,
        },repository)
        break

      case 'record_affiliate_event':
        if(!body.id||!body.programRef||!body.providerRef||!body.externalEventRef||!body.status||!body.evidenceRefs?.length){
          return fail(requestId,'record_affiliate_event fields are incomplete')
        }
        if(!['click','conversion','reversal','payout'].includes(body.status))return fail(requestId,'Invalid affiliate event kind')
        record=await recordSideHustleAffiliateEventRuntime({
          opportunityId:context.params.id,id:body.id,programRef:body.programRef,providerRef:body.providerRef,
          externalEventRef:body.externalEventRef,kind:body.status as SideHustleAffiliateEventKind,
          providerStatus:body.providerStatus,economicState:body.economicState,
          customerOrSessionRef:body.customerOrSessionRef,amount:body.amount,currency:body.currency,
          evidenceRefs:body.evidenceRefs,occurredAt:body.occurredAt,
        },repository)
        break

      default:
        return fail(requestId,'Unsupported commerce action')
    }

    return NextResponse.json({
      ok:true,requestId,record,externalActionAuthorized:false,paymentAuthorized:false,moneyMovementAuthorized:false,
    },{status:201,headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to mutate Side Hustle commerce state'
    return fail(requestId,message,statusFor(message))
  }
}
