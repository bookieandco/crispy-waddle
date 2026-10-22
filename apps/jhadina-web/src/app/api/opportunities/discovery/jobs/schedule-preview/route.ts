import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assessDiscoverySchedule, type OpportunityDiscoverySchedule } from '@jhadina/opportunity-core'

export const dynamic='force-dynamic'
export const runtime='nodejs'

/** Planning preview ONLY. An unverified client-supplied receipt does not enroll a cron. */
export async function POST(request:Request) {
  const supabase=await createClient()
  const {data:{user},error}=await supabase.auth.getUser()
  if(error||!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
  const payload=await request.json().catch(()=>null) as Partial<OpportunityDiscoverySchedule>|null
  if(!payload || payload.ownerId!==user.id || typeof payload.id!=='string' ||
      !Array.isArray(payload.boards) || payload.boards.length>5 ||
      typeof payload.ownerApprovedAt!=='string' || typeof payload.providerTermsReviewedAt!=='string' ||
      typeof payload.expiresAt!=='string' || typeof payload.intervalMinutes!=='number' ||
      typeof payload.maxFindingsPerCycle!=='number') {
    return NextResponse.json({ok:false,error:'Invalid schedule preview or owner identity'},{status:400})
  }
  try {
    const decision=assessDiscoverySchedule(payload as OpportunityDiscoverySchedule,new Date().toISOString())
    return NextResponse.json({
      ok:true,decision,
      persisted:false,cronInstalled:false,approvalReceiptIndependentlyVerified:false,
      scheduledExecutionAuthorized:false,
      next:'Review provider terms; register bounded owner approval in the governing authorization system before enrolling any recurring job.',
    },{headers:{'cache-control':'no-store'}})
  }catch(e){
    return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Schedule preview rejected'},{status:400})
  }
}
