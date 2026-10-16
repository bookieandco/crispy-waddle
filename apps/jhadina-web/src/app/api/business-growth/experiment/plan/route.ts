import { NextResponse } from 'next/server'
import { createBusinessGrowthExperiment } from '@jhadina/growth-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'
export const runtime='nodejs'
export const dynamic='force-dynamic'

/** Draft-only 30-day mission cadence. No provider connection or DB write. */
export async function POST(request: Request) {
  try {
    await requireRequestIdentity()
  } catch {
    return NextResponse.json({ok:false,error:'AUTHENTICATION_REQUIRED'}, {status:401})
  }
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 8192) {
      return NextResponse.json({ok:false,error:'EXPERIMENT_PLAN_INPUT_TOO_LARGE'},{status:413})
    }
    const body = await request.json() as {
      businessId?: string
      ventureId?: string
      hypothesis?: string
      startDate?: string
    }
    if (!body || typeof body.businessId !== 'string' || typeof body.startDate !== 'string'
      || typeof body.hypothesis !== 'string' || body.businessId.length > 100
      || body.hypothesis.length > 500) {
      return NextResponse.json({ok:false,error:'EXPERIMENT_PLAN_INPUT_INVALID'},{status:400})
    }
    const brand = body.businessId.trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').slice(0,70)
    if (!brand) return NextResponse.json({ok:false,error:'BUSINESS_NAME_REQUIRED'},{status:400})
    const experiment = createBusinessGrowthExperiment({
      id:'growth-experiment:preview:'+brand+':'+body.startDate,
      businessId:brand,
      // Provisional identity only. No server verified venture is claimed.
      ventureId:'preview:'+brand,
      startDate:body.startDate,
      hypothesis:body.hypothesis,
    })
    return NextResponse.json({
      ok:true,
      experiment,
      providerStatus:'NOT_CONNECTED',
      ownershipStatus:'NOT_VERIFIED',
      persistence:'NONE',
      commercialOutcomeStatus:'NO_REAL_RECEIPT',
      externalExecutionAuthorized:false,
    },{headers:{'cache-control':'no-store'}})
  } catch (error) {
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'EXPERIMENT_PLAN_FAILED'},
      {status:400,headers:{'cache-control':'no-store'}})
  }
}
