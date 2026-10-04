import {NextResponse} from "next/server"
import type {
  AffiliateComplianceChannel,
  AffiliateContentComplianceReview,
  AffiliateDisclosureObservation,
  AffiliateTermsSnapshot,
} from "@jhadina/opportunity-core"
import {requireRequestIdentity} from "@/lib/auth/request-user"
import {
  createAffiliateComplianceSnapshotRepository,
} from "@/lib/opportunities/affiliate-compliance-repository"
import {
  certifyAffiliateComplianceRuntime,
} from "@/lib/opportunities/affiliate-compliance-runtime"
import {
  createSideHustleCommissioningEvidenceRepository,
} from "@/lib/opportunities/side-hustle-commissioning-repository"
import {
  createSupabaseOpportunityRepository,
} from "@/lib/opportunities/supabase-opportunity-repository"

export const dynamic="force-dynamic"
export const runtime="nodejs"

type Body={
  usedChannels?:AffiliateComplianceChannel[]
  termsSnapshots?:AffiliateTermsSnapshot[]
  disclosureObservations?:AffiliateDisclosureObservation[]
  contentReviews?:AffiliateContentComplianceReview[]
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
  if(/requires|invalid|missing|stale|compliance|portfolio/i.test(message))return 409
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

    if(!Array.isArray(body.usedChannels)){
      return fail(requestId,"usedChannels must be an array")
    }
    if(!Array.isArray(body.termsSnapshots)){
      return fail(requestId,"termsSnapshots must be an array")
    }
    if(!Array.isArray(body.disclosureObservations)){
      return fail(requestId,"disclosureObservations must be an array")
    }
    if(!Array.isArray(body.contentReviews)){
      return fail(requestId,"contentReviews must be an array")
    }

    const result=await certifyAffiliateComplianceRuntime(
      {
        opportunityId:context.params.id,
        usedChannels:body.usedChannels,
        termsSnapshots:body.termsSnapshots,
        disclosureObservations:body.disclosureObservations,
        contentReviews:body.contentReviews,
        freshnessDays:body.freshnessDays,
      },
      createSupabaseOpportunityRepository(),
      createAffiliateComplianceSnapshotRepository(),
      createSideHustleCommissioningEvidenceRepository(),
    )

    return NextResponse.json(
      {ok:true,requestId,result},
      {headers:{"cache-control":"no-store"}},
    )
  }catch(error){
    const message=error instanceof Error
      ?error.message
      :"Unable to certify affiliate compliance"
    return fail(requestId,message,statusFor(message))
  }
}
