import {NextResponse} from "next/server"
import {requireRequestIdentity} from "@/lib/auth/request-user"
import {
  createAffiliateNetworkProvider,
  createAffiliatePayoutProvider,
  type AffiliateNetworkProviderName,
} from "@/lib/opportunities/affiliate-network-providers"
import {createAffiliatePayoutSnapshotRepository} from "@/lib/opportunities/affiliate-payout-repository"
import {commissionAffiliateLiveRuntime} from "@/lib/opportunities/affiliate-live-commissioning-runtime"
import {createSideHustleCommissioningEvidenceRepository} from "@/lib/opportunities/side-hustle-commissioning-repository"
import {createSupabaseOpportunityRepository} from "@/lib/opportunities/supabase-opportunity-repository"

export const dynamic="force-dynamic"
export const runtime="nodejs"

type Body={
  provider?:AffiliateNetworkProviderName
  startAt?:string
  endAt?:string
  maxPages?:number
  credentialFreshnessDays?:number
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
  if(/REQUIRES_COMMERCE_AFFILIATE|MISMATCH|INCOMPLETE/.test(message))return 409
  if(/NOT_CONFIGURED|UNSUPPORTED/.test(message))return 503
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
    if(body.provider!=="partnerize"&&body.provider!=="cj-affiliate"){
      return fail(requestId,"Affiliate commissioning provider must be partnerize or cj-affiliate")
    }

    const network=createAffiliateNetworkProvider(body.provider)
    const payout=body.provider==="partnerize"
      ?createAffiliatePayoutProvider("partnerize")
      :undefined
    const opportunityRepository=createSupabaseOpportunityRepository()

    const result=await commissionAffiliateLiveRuntime(
      {
        opportunityId:context.params.id,
        provider:body.provider,
        accountRef:network.accountRef,
        startAt:body.startAt,
        endAt:body.endAt,
        maxPages:body.maxPages,
        credentialFreshnessDays:body.credentialFreshnessDays,
      },
      {
        networkAdapter:network.adapter,
        payoutAdapter:payout?.adapter,
        opportunityRepository,
        payoutRepository:createAffiliatePayoutSnapshotRepository(),
        commissioningRepository:createSideHustleCommissioningEvidenceRepository(),
      },
    )

    return NextResponse.json(
      {ok:true,requestId,result},
      {headers:{"cache-control":"no-store"}},
    )
  }catch(error){
    const message=error instanceof Error
      ?error.message
      :"Unable to commission affiliate provider"
    return fail(requestId,message,statusFor(message))
  }
}
