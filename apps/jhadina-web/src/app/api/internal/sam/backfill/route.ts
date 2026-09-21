import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { nextSamBackfillWindow, runSamUsablePipeline } from '@/lib/money-opportunities/sam-usable-runtime'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60

export async function GET(request:Request){
  const secret=process.env.CRON_SECRET
  if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({ok:false},{status:401})
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'SAM_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED'},{status:503})
  if(!process.env.SAM_GOV_API_KEY)return NextResponse.json({ok:false,error:'SAM_GOV_API_KEY_NOT_CONFIGURED'},{status:503})
  try{
    const window=await nextSamBackfillWindow(client,7)
    const result=await runSamUsablePipeline(client,{...window,maxPages:20,maxProcessNotices:10})
    return NextResponse.json({ok:true,mode:'backfill',window,...result},{headers:{'cache-control':'no-store'}})
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'SAM_BACKFILL_FAILED'},{status:502,headers:{'cache-control':'no-store'}})
  }
}
