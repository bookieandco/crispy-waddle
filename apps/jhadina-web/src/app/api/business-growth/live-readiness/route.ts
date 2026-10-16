import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const gates=[
  {code:'LIVE.01',title:'Owned site',missing:'No authoritative site ↔ venture binding receipt'},
  {code:'LIVE.02',title:'Search Console',missing:'No OAuth-authorized first-party Search Console receipt'},
  {code:'LIVE.03',title:'Site and content',missing:'No approved audited site and sourced content receipt'},
  {code:'LIVE.04',title:'Publishing',missing:'No exact canonical approval → provider delivery receipt'},
  {code:'LIVE.05',title:'Commerce',missing:'No settled order with full campaign/asset/cost lineage'},
  {code:'LIVE.06',title:'Certification',missing:'Complete six-stage real receipt chain not established'},
] as const

/** Read-only account-scoped readiness. No browser evidence can elevate a gate. */
export async function GET(request:NextRequest) {
  let ownerUserId:string
  try {ownerUserId=(await requireRequestIdentity()).userId}
  catch {return NextResponse.json({ok:false,error:'AUTHENTICATION_REQUIRED'},{status:401})}
  const ventureId=request.nextUrl.searchParams.get('ventureId')?.trim()??''
  if (!ventureId || ventureId.length>200) {
    return NextResponse.json({ok:false,error:'CANONICAL_VENTURE_ID_REQUIRED'},{status:400})
  }
  try {
    const service=createServiceRoleClient()
    if (!service) {
      return NextResponse.json({ok:false,error:'VENTURE_RUNTIME_NOT_CONFIGURED',
        externalActionAuthorized:false},{status:503,headers:{'cache-control':'no-store'}})
    }
    const repository=new VentureRuntimeRepository(service)
    const venture=await repository.getVenture(ownerUserId,ventureId)
    if (!venture) {
      return NextResponse.json({ok:false,error:'OWNED_VENTURE_NOT_FOUND'},{status:404,
        headers:{'cache-control':'no-store'}})
    }
    return NextResponse.json({
      ok:true,ventureId:venture.id,business:venture.title,
      sourceOfTruth:'CANONICAL_VENTURE_LEDGER',
      // No provider/approval/settlement reader is bound to this endpoint yet.
      // Do not infer proof from candidate ideas or manually entered URLs.
      gates:gates.map(gate=>({...gate,status:'BLOCKED' as const})),
      evidenceCoverage:'UNAVAILABLE',
      liveCommissioningCertified:false,
      externalActionAuthorized:false,
      publishingAuthorized:false,
      spendingAuthorized:false,
      next:'Authorize an owned-site mapping and read-only Google Search Console provider before stage 2 can be evaluated.',
    },{headers:{'cache-control':'no-store'}})
  } catch {
    // No leaking service-role exceptions or tenant table contents to the browser.
    return NextResponse.json({ok:false,error:'VENTURE_READINESS_PROBE_UNAVAILABLE',
      externalActionAuthorized:false},{status:503,headers:{'cache-control':'no-store'}})
  }
}
