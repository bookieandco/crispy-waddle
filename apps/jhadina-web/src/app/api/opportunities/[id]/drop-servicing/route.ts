import {NextResponse} from 'next/server'
import {requireRequestIdentity} from '@/lib/auth/request-user'
import {createSupabaseOpportunityRepository} from '@/lib/opportunities/supabase-opportunity-repository'
import {
  buildDropServicingMarginRuntime,
  planDropServicingProviderAssignmentRuntime,
  recordDropServicingIssueRuntime,
  recordDropServicingProviderQuoteRuntime,
  summarizeDropServicingRuntime,
} from '@/lib/opportunities/side-hustle-drop-servicing-runtime'

export const dynamic='force-dynamic'
export const runtime='nodejs'

type Body={
  action?:string
  workOrderId?:string
  id?:string
  quoteId?:string
  assignmentId?:string
  outcomeId?:string
  assignmentIds?:string[]
  providerRef?:string
  scopeItemIds?:string[]
  amount?:number
  currency?:string
  slaDueAt?:string
  revisionsIncluded?:number
  validUntil?:string
  deliveryRef?:string
  issue?:string
  requestedResolution?:string
  evidenceRefs?:string[]
  observedAt?:string
  plannedAt?:string
}

function fail(requestId:string,message:string,status=400){
  return NextResponse.json({ok:false,requestId,error:message},{status,headers:{'cache-control':'no-store'}})
}
function statusFor(message:string){
  if(/Authenticated|identity|session/i.test(message))return 401
  if(/NOT_FOUND/.test(message))return 404
  if(/MISMATCH|requires|expired|unknown|invalid|must/i.test(message))return 409
  return 400
}

export async function GET(request:Request,context:{params:{id:string}}){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const repository=createSupabaseOpportunityRepository()
    const url=new URL(request.url)
    const workOrderId=url.searchParams.get('workOrderId')?.trim()
    if(workOrderId){
      const workOrder=await repository.getSideHustleCommercialWorkOrder(workOrderId)
      if(!workOrder||workOrder.opportunityId!==context.params.id){
        return fail(requestId,'Drop Servicing work order not found',404)
      }
      const [summary,records]=await Promise.all([
        summarizeDropServicingRuntime({workOrderId},repository),
        repository.listDropServicingRecords({workOrderId}),
      ])
      return NextResponse.json({ok:true,requestId,summary,records},{headers:{'cache-control':'no-store'}})
    }
    const records=await repository.listDropServicingRecords({opportunityId:context.params.id})
    return NextResponse.json({ok:true,requestId,records},{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to load Drop Servicing state'
    return fail(requestId,message,statusFor(message))
  }
}

export async function POST(request:Request,context:{params:{id:string}}){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const body=await request.json().catch(()=>({})) as Body
    if(!body.action?.trim()||!body.workOrderId?.trim())return fail(requestId,'Drop Servicing action and workOrderId are required')
    const repository=createSupabaseOpportunityRepository()
    const workOrder=await repository.getSideHustleCommercialWorkOrder(body.workOrderId)
    if(!workOrder||workOrder.opportunityId!==context.params.id){
      return fail(requestId,'Drop Servicing work order not found',404)
    }

    let record:unknown
    switch(body.action){
      case 'record_quote':
        if(!body.id||!body.providerRef||!body.scopeItemIds?.length||body.amount===undefined||!body.currency||
           !body.slaDueAt||body.revisionsIncluded===undefined||!body.evidenceRefs?.length){
          return fail(requestId,'record_quote fields are incomplete')
        }
        record=await recordDropServicingProviderQuoteRuntime({
          workOrderId:body.workOrderId,id:body.id,providerRef:body.providerRef,
          scopeItemIds:body.scopeItemIds,amount:body.amount,currency:body.currency,
          slaDueAt:body.slaDueAt,revisionsIncluded:body.revisionsIncluded,validUntil:body.validUntil,
          evidenceRefs:body.evidenceRefs,observedAt:body.observedAt,
        },repository)
        break
      case 'plan_assignment':
        if(!body.id||!body.quoteId||!body.evidenceRefs?.length)return fail(requestId,'plan_assignment fields are incomplete')
        record=await planDropServicingProviderAssignmentRuntime({
          workOrderId:body.workOrderId,quoteId:body.quoteId,id:body.id,
          evidenceRefs:body.evidenceRefs,plannedAt:body.plannedAt,
        },repository)
        break
      case 'record_issue':
        if(!body.id||!body.assignmentId||!body.issue||!body.requestedResolution||!body.evidenceRefs?.length){
          return fail(requestId,'record_issue fields are incomplete')
        }
        record=await recordDropServicingIssueRuntime({
          workOrderId:body.workOrderId,assignmentId:body.assignmentId,id:body.id,
          kind:'rework',deliveryRef:body.deliveryRef,issue:body.issue,
          requestedResolution:body.requestedResolution,evidenceRefs:body.evidenceRefs,
          observedAt:body.observedAt,
        },repository)
        break
      case 'build_margin':
        if(!body.id||!body.outcomeId||!body.assignmentIds?.length||!body.evidenceRefs?.length){
          return fail(requestId,'build_margin fields are incomplete')
        }
        record=await buildDropServicingMarginRuntime({
          workOrderId:body.workOrderId,outcomeId:body.outcomeId,assignmentIds:body.assignmentIds,
          id:body.id,evidenceRefs:body.evidenceRefs,
        },repository)
        break
      default:
        return fail(requestId,'Unsupported Drop Servicing action')
    }
    return NextResponse.json({
      ok:true,requestId,record,
      externalActionAuthorized:false,assignmentAuthorized:false,paymentAuthorized:false,moneyMovementAuthorized:false,
    },{status:201,headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to mutate Drop Servicing state'
    return fail(requestId,message,statusFor(message))
  }
}
