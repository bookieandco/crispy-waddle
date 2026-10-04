import {NextResponse} from "next/server"
import {requireRequestIdentity} from "@/lib/auth/request-user"
import {proveAffiliateContributionRuntime} from "@/lib/opportunities/affiliate-contribution-runtime"
import {createSideHustleCommissioningEvidenceRepository} from "@/lib/opportunities/side-hustle-commissioning-repository"
import {createSupabaseOpportunityRepository} from "@/lib/opportunities/supabase-opportunity-repository"

export const dynamic="force-dynamic"
export const runtime="nodejs"

type Body={
  experimentId?:string
  currency?:string
  freshnessDays?:number
}

function fail(requestId:string,message:string,status=400){
  return NextResponse.json(
    {ok:false,requestId,error:message},
    {status,headers:{"cache-control":"no-store"}},
  )
}

function statusFor(message:string){
  if(/Authenticated|identity|session/i.test(message))return 401
  if(/NOT_FOUND/.test(message))return 404
  if(/must|requires|invalid|mismatch|FX inference/i.test(message))return 409
  return 400
}

export async function POST(
  request:Request,
  context:{params:{id:string}},
){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const body=await request.json().catch(()=>({})) as Body
    if(typeof body.experimentId!=="string"||!body.experimentId.trim()){
      return fail(requestId,"experimentId is required")
    }
    if(typeof body.currency!=="string"||!body.currency.trim()){
      return fail(requestId,"currency is required")
    }

    const result=await proveAffiliateContributionRuntime(
      {
        opportunityId:context.params.id,
        experimentId:body.experimentId,
        currency:body.currency,
        freshnessDays:body.freshnessDays,
      },
      createSupabaseOpportunityRepository(),
      createSideHustleCommissioningEvidenceRepository(),
    )

    return NextResponse.json(
      {ok:true,requestId,result},
      {headers:{"cache-control":"no-store"}},
    )
  }catch(error){
    const message=error instanceof Error
      ?error.message
      :"Unable to prove affiliate contribution"
    return fail(requestId,message,statusFor(message))
  }
}
