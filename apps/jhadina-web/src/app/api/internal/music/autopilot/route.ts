import {NextRequest,NextResponse} from 'next/server';
import {authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth';
import {createSchedulerServiceRoleClient} from '@/lib/supabase/service-role';
import {runMusicAutopilotWorker} from '@/lib/music/music-autopilot-worker';

export const runtime='nodejs';
export const dynamic='force-dynamic';

async function run(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request))){
    return NextResponse.json({ok:false,error:'unauthorized'},{status:401});
  }
  const client=createSchedulerServiceRoleClient(request);
  if(!client){
    return NextResponse.json({ok:false,error:'MUSIC_AUTOPILOT_SCHEDULER_STORAGE_UNAVAILABLE'},{status:503});
  }
  try{
    const receipt=await runMusicAutopilotWorker(client);
    if(receipt.failed>0){
      return NextResponse.json({ok:false,receipt},{status:503});
    }
    return NextResponse.json({ok:true,receipt});
  }catch(error){
    return NextResponse.json({
      ok:false,
      error:error instanceof Error?error.message:String(error),
    },{status:503});
  }
}

export async function GET(request:NextRequest){return run(request);}
export async function POST(request:NextRequest){return run(request);}
