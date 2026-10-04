import {NextResponse} from 'next/server'
import {requireRequestIdentity} from '@/lib/auth/request-user'
import {summarizeAffiliatePortfolioRuntime} from '@/lib/opportunities/affiliate-portfolio-runtime'
import {createSupabaseOpportunityRepository} from '@/lib/opportunities/supabase-opportunity-repository'

export const dynamic='force-dynamic'
export const runtime='nodejs'

function fail(requestId:string,message:string,status=400){
  return NextResponse.json(
    {ok:false,requestId,error:message},
    {status,headers:{'cache-control':'no-store'}},
  )
}

function statusFor(message:string){
  if(/Authenticated|identity|session/i.test(message))return 401
  if(/NOT_FOUND/.test(message))return 404
  if(/REQUIRES_COMMERCE_AFFILIATE/.test(message))return 409
  return 400
}

export async function GET(_request:Request,context:{params:{id:string}}){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const repository=createSupabaseOpportunityRepository()
    const portfolio=await summarizeAffiliatePortfolioRuntime(
      {opportunityId:context.params.id},
      repository,
    )
    return NextResponse.json(
      {ok:true,requestId,portfolio},
      {headers:{'cache-control':'no-store'}},
    )
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to summarize affiliate portfolio'
    return fail(requestId,message,statusFor(message))
  }
}
