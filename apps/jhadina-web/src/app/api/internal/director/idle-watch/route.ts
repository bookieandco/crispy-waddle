import {NextRequest,NextResponse} from 'next/server'
import {authorizedDirectorBackgroundRequest,authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient} from '@/lib/supabase/service-role'
import {runDirectorIdleWatchWorker} from '@/lib/director-idle-watch-worker'

export const runtime='nodejs'
export const dynamic='force-dynamic'

async function run(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request))&&!(await authorizedDirectorBackgroundRequest(request))){
    return NextResponse.json({ok:false,error:'unauthorized'},{status:401})
  }
  const client=createSchedulerServiceRoleClient(request)
  if(!client){
    return NextResponse.json({ok:false,error:'DIRECTOR_IDLE_WATCH_SCHEDULER_STORAGE_UNAVAILABLE'},{status:503})
  }
  try{
    const receipt=await runDirectorIdleWatchWorker(client)
    return NextResponse.json({ok:true,receipt})
  }catch(error){
    return NextResponse.json({
      ok:false,
      error:error instanceof Error?error.message:String(error),
    },{status:503})
  }
}

export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
