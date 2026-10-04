import {NextRequest,NextResponse} from 'next/server'
import {authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient} from '@/lib/supabase/service-role'
import {runSharkShadowLearningCycle,type SharkShadowLearningMode} from '@/lib/money/shark-shadow-learning-worker'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function boundedInt(request:NextRequest,name:string,fallback:number,min:number,max:number):number|null{
  const raw=request.nextUrl.searchParams.get(name)
  if(raw===null)return fallback
  const n=Number(raw)
  return Number.isInteger(n)&&n>=min&&n<=max?n:null
}
function mode(request:NextRequest):SharkShadowLearningMode|null{
  const raw=(request.nextUrl.searchParams.get('mode')??'live').toLowerCase()
  return raw==='live'?'LIVE':raw==='replay'?'REPLAY':null
}

async function run(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false,error:'unauthorized'},{status:401})
  const resolvedMode=mode(request)
  if(!resolvedMode)return NextResponse.json({ok:false,error:'invalid_mode'},{status:400})
  const limit=boundedInt(request,'limit',resolvedMode==='REPLAY'?500:100,1,1000)
  const lookbackHours=boundedInt(request,'lookbackHours',resolvedMode==='REPLAY'?8760:336,1,43800)
  if(limit===null||lookbackHours===null)return NextResponse.json({ok:false,error:'invalid_bounds'},{status:400})
  const client=createSchedulerServiceRoleClient(request)
  if(!client)return NextResponse.json({ok:false,error:'money_shark_shadow_learning_storage_unavailable'},{status:503})
  try{
    const receipt=await runSharkShadowLearningCycle({client,mode:resolvedMode,limit,lookbackHours})
    return NextResponse.json({ok:true,receipt,authority:'SHADOW_LEARNING_ONLY',canExecute:false,canAuthorizeLive:false})
  }catch(error){
    console.error('SHARK shadow learning worker failed',error)
    return NextResponse.json({ok:false,error:'money_shark_shadow_learning_failed'},{status:502})
  }
}
export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
