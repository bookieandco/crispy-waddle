import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRuntimeServiceRoleClient } from '@/lib/supabase/service-role'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import { calculateOpportunityActivationReadiness } from '@/lib/opportunities/activation-readiness'

export const dynamic='force-dynamic'
export const runtime='nodejs'

/** Owner-scoped, read-only commissioning health; no secret values or production claims. */
export async function GET(){
  const supabase=await createClient()
  const { data:{user},error }=await supabase.auth.getUser()
  if(error||!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401,headers:{'cache-control':'no-store'}})
  try{
    const owned=await createSupabaseOpportunityRepository().list()
    const result=calculateOpportunityActivationReadiness({
      ownerId:user.id,
      stored:owned,
      allowedSourceHosts:(process.env.OCE_RESEARCH_ALLOWED_HOSTS??'').split(','),
      agentPersistenceConfigured:Boolean(await createRuntimeServiceRoleClient()),
    })
    return NextResponse.json({
      ok:true,readiness:result,verifiedAt:new Date().toISOString(),
      evidenceScope:'authenticated_data_read_only',
      liveIphoneTested:false,cronRunning:false,externalActionsPermitted:false,
    },{headers:{'cache-control':'no-store'}})
  }catch{
    return NextResponse.json({ok:false,error:'Owner-scoped commissioning read unavailable',readiness:'UNKNOWN_NOT_READY'},{
      status:503,headers:{'cache-control':'no-store'},
    })
  }
}
