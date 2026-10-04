import {NextRequest,NextResponse} from 'next/server'
import {authorizedDirectorBackgroundRequest,authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient} from '@/lib/supabase/service-role'
import {runSideHustleDirectorAutopilotWorker} from '@/lib/opportunities/side-hustle-director-autopilot-worker'

export const runtime='nodejs'
export const dynamic='force-dynamic'

async function run(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request))&&!(await authorizedDirectorBackgroundRequest(request))){
    return NextResponse.json({ok:false,error:'unauthorized'},{status:401})
  }
  const client=createSchedulerServiceRoleClient(request)
  if(!client){
    return NextResponse.json({ok:false,error:'DIRECTOR_AUTOPILOT_SCHEDULER_STORAGE_UNAVAILABLE'},{status:503})
  }
  try{
    const url=new URL(request.url)
    const requested=Number(url.searchParams.get('limit')??5)
    const limit=Number.isFinite(requested)?Math.max(1,Math.min(20,Math.floor(requested))):5
    const receipt=await runSideHustleDirectorAutopilotWorker(client,{limit})
    return NextResponse.json({ok:receipt.failed===0,receipt},{status:receipt.failed===0?200:503})
  }catch(error){
    return NextResponse.json({
      ok:false,
      error:error instanceof Error?error.message:String(error),
    },{status:503})
  }
}

export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
