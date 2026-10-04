import {NextResponse} from 'next/server'
import {requireRequestIdentity} from '@/lib/auth/request-user'
import {createAffiliatePayoutProvider} from '@/lib/opportunities/affiliate-network-providers'
import {createAffiliatePayoutSnapshotRepository} from '@/lib/opportunities/affiliate-payout-repository'
import {syncAffiliatePayoutBalancesRuntime} from '@/lib/opportunities/affiliate-payout-runtime'
import {createSupabaseOpportunityRepository} from '@/lib/opportunities/supabase-opportunity-repository'

export const dynamic='force-dynamic'
export const runtime='nodejs'

type Body={
  provider?:'partnerize'
  observedAt?:string
}

function fail(requestId:string,message:string,status=400){
  return NextResponse.json(
    {ok:false,requestId,error:message},
    {status,headers:{'cache-control':'no-store'}},
  )
}

function statusFor(message:string){
  if(/Authenticated|identity|session/i.test(message))return 401
  if(/NOT_FOUND/.test(message))return 404
  if(/REQUIRES_COMMERCE_AFFILIATE|MISMATCH/.test(message))return 409
  if(/NOT_CONFIGURED|UNSUPPORTED/.test(message))return 503
  return 400
}

export async function GET(request:Request,context:{params:{id:string}}){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const url=new URL(request.url)
    const provider=url.searchParams.get('provider')?.trim()||undefined
    if(provider&&provider!=='partnerize')return fail(requestId,'Unsupported affiliate payout provider')
    const repository=createAffiliatePayoutSnapshotRepository()
    const snapshots=await repository.list({
      opportunityId:context.params.id,
      provider,
      limit:50,
    })
    return NextResponse.json(
      {ok:true,requestId,snapshots,programAttributionAvailable:false},
      {headers:{'cache-control':'no-store'}},
    )
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to list affiliate payout snapshots'
    return fail(requestId,message,statusFor(message))
  }
}

export async function POST(request:Request,context:{params:{id:string}}){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const body=await request.json().catch(()=>({})) as Body
    if(body.provider&&body.provider!=='partnerize'){
      return fail(requestId,'Affiliate payout provider must be partnerize')
    }

    const binding=createAffiliatePayoutProvider('partnerize')
    const result=await syncAffiliatePayoutBalancesRuntime(
      {
        opportunityId:context.params.id,
        accountRef:binding.accountRef,
        observedAt:body.observedAt,
      },
      binding.adapter,
      createSupabaseOpportunityRepository(),
      createAffiliatePayoutSnapshotRepository(),
    )
    return NextResponse.json(
      {ok:true,requestId,result},
      {headers:{'cache-control':'no-store'}},
    )
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to sync affiliate payout balances'
    return fail(requestId,message,statusFor(message))
  }
}
