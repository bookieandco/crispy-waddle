import {NextResponse} from "next/server"
import type {
  DigitalProductB2bRoiSignals,
  DigitalProductDraft,
  DigitalProductFamily,
  DigitalProductOpportunitySignals,
  DigitalProductProvenanceRecord,
  MarketplacePolicySnapshot,
} from "@jhadina/opportunity-core"
import {requireRequestIdentity} from "@/lib/auth/request-user"
import {
  createDigitalProductStudioRepository,
} from "@/lib/opportunities/digital-product-studio-repository"
import {
  createDigitalProductMatrixRuntime,
  defineDigitalProductRuntime,
  evaluateDigitalProductMarketplaceRuntime,
  recordDigitalProductPolicyRuntime,
  recordDigitalProductProvenanceRuntime,
  scoreDigitalProductB2bRoiRuntime,
  scoreDigitalProductOpportunityRuntime,
  summarizeDigitalProductStudioRuntime,
} from "@/lib/opportunities/digital-product-studio-runtime"
import {
  createSupabaseOpportunityRepository,
} from "@/lib/opportunities/supabase-opportunity-repository"

export const dynamic="force-dynamic"
export const runtime="nodejs"

type Action=
  |"score_opportunity"
  |"create_matrix_cell"
  |"score_b2b_roi"
  |"define_product"
  |"record_policy"
  |"evaluate_marketplace"
  |"record_provenance"

type Body={
  action?:Action
  id?:string
  signals?:DigitalProductOpportunitySignals|DigitalProductB2bRoiSignals
  evidenceRefs?:string[]
  industry?:string
  businessStage?:string
  businessFunction?:string
  buyerRole?:string
  lifecycleStep?:string
  buyerType?:"business"|"consumer"
  family?:DigitalProductFamily
  productType?:string
  problem?:string
  desiredOutcome?:string
  matrixCellId?:string
  product?:Omit<DigitalProductDraft,"opportunityId">
  policy?:Omit<
    MarketplacePolicySnapshot,
    "authority"|"externalActionAuthorized"|"publishingAuthorized"
  >
  productId?:string
  policyRecordId?:string
  provenance?:Omit<
    DigitalProductProvenanceRecord,
    "productId"|"authority"|"externalActionAuthorized"|"publishingAuthorized"|"paymentAuthorized"
  >
}

function fail(requestId:string,message:string,status=400){
  return NextResponse.json(
    {ok:false,requestId,error:message},
    {status,headers:{"cache-control":"no-store"}},
  )
}

function text(value:unknown,field:string):string{
  if(typeof value!=="string"||!value.trim()){
    throw new Error(`${field} is required`)
  }
  return value.trim()
}

function evidence(value:unknown):string[]{
  if(!Array.isArray(value)||value.some(item=>typeof item!=="string")){
    throw new Error("evidenceRefs must be a string array")
  }
  return value as string[]
}

function statusFor(message:string){
  if(/Authenticated|identity|session/i.test(message))return 401
  if(/NOT_FOUND/.test(message))return 404
  if(/MISMATCH|does not belong|requires|invalid|must/i.test(message))return 409
  return 400
}

export async function GET(
  request:Request,
  context:{params:{id:string}},
){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const repository=createDigitalProductStudioRepository()
    const result=await summarizeDigitalProductStudioRuntime(
      {opportunityId:context.params.id},
      repository,
    )
    return NextResponse.json(
      {ok:true,requestId,result},
      {headers:{"cache-control":"no-store"}},
    )
  }catch(error){
    const message=error instanceof Error
      ?error.message
      :"Unable to summarize Digital Product Studio"
    return fail(requestId,message,statusFor(message))
  }
}

export async function POST(
  request:Request,
  context:{params:{id:string}},
){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const body=await request.json().catch(()=>({})) as Body
    const opportunityRepository=createSupabaseOpportunityRepository()
    const repository=createDigitalProductStudioRepository()
    const opportunityId=context.params.id

    let result
    switch(body.action){
      case"score_opportunity":
        result=await scoreDigitalProductOpportunityRuntime(
          {
            opportunityId,
            id:text(body.id,"id"),
            signals:body.signals as DigitalProductOpportunitySignals,
            evidenceRefs:evidence(body.evidenceRefs),
          },
          opportunityRepository,
          repository,
        )
        break
      case"create_matrix_cell":
        result=await createDigitalProductMatrixRuntime(
          {
            opportunityId,
            id:text(body.id,"id"),
            industry:text(body.industry,"industry"),
            businessStage:text(body.businessStage,"businessStage"),
            businessFunction:text(body.businessFunction,"businessFunction"),
            buyerRole:text(body.buyerRole,"buyerRole"),
            lifecycleStep:text(body.lifecycleStep,"lifecycleStep"),
            buyerType:body.buyerType as "business"|"consumer",
            family:body.family as DigitalProductFamily,
            productType:text(body.productType,"productType"),
            problem:text(body.problem,"problem"),
            desiredOutcome:text(body.desiredOutcome,"desiredOutcome"),
            evidenceRefs:evidence(body.evidenceRefs),
          },
          opportunityRepository,
          repository,
        )
        break
      case"score_b2b_roi":
        result=await scoreDigitalProductB2bRoiRuntime(
          {
            opportunityId,
            id:text(body.id,"id"),
            matrixCellId:text(body.matrixCellId,"matrixCellId"),
            signals:body.signals as DigitalProductB2bRoiSignals,
            evidenceRefs:evidence(body.evidenceRefs),
          },
          opportunityRepository,
          repository,
        )
        break
      case"define_product":
        if(!body.product)throw new Error("product is required")
        result=await defineDigitalProductRuntime(
          {opportunityId,product:body.product},
          opportunityRepository,
          repository,
        )
        break
      case"record_policy":
        if(!body.policy)throw new Error("policy is required")
        result=await recordDigitalProductPolicyRuntime(
          {opportunityId,policy:body.policy},
          opportunityRepository,
          repository,
        )
        break
      case"evaluate_marketplace":
        result=await evaluateDigitalProductMarketplaceRuntime(
          {
            opportunityId,
            id:text(body.id,"id"),
            productId:text(body.productId,"productId"),
            policyRecordId:text(body.policyRecordId,"policyRecordId"),
          },
          opportunityRepository,
          repository,
        )
        break
      case"record_provenance":
        if(!body.provenance)throw new Error("provenance is required")
        result=await recordDigitalProductProvenanceRuntime(
          {
            opportunityId,
            id:text(body.id,"id"),
            productId:text(body.productId,"productId"),
            provenance:body.provenance,
          },
          opportunityRepository,
          repository,
        )
        break
      default:
        return fail(requestId,"Unsupported Digital Product Studio action")
    }

    return NextResponse.json(
      {ok:true,requestId,result},
      {headers:{"cache-control":"no-store"}},
    )
  }catch(error){
    const message=error instanceof Error
      ?error.message
      :"Unable to update Digital Product Studio"
    return fail(requestId,message,statusFor(message))
  }
}
