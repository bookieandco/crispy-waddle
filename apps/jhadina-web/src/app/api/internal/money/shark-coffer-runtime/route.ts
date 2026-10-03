import {NextRequest,NextResponse} from 'next/server'
import {authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient} from '@/lib/supabase/service-role'
import {runSharkCofferRuntimeCycle} from '@/lib/money/shark-coffer-runtime-worker'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function limit(request:NextRequest):number|null{
  const raw=request.nextUrl.searchParams.get('limit')
  if(raw===null)return 100
  const n=Number(raw)
  return Number.isInteger(n)&&n>=1&&n<=500?n:null
}

async function run(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false,error:'unauthorized'},{status:401})
  const bounded=limit(request)
  if(bounded===null)return NextResponse.json({ok:false,error:'invalid_limit'},{status:400})
  const client=createSchedulerServiceRoleClient(request)
  if(!client)return NextResponse.json({ok:false,error:'money_shark_coffer_runtime_storage_unavailable'},{status:503})
  try{
    const result=await runSharkCofferRuntimeCycle({client,limit:bounded})
    return NextResponse.json({
      ok:true,
      ...result,
      // This worker can create non-authorizing autonomous intents only.
      // Existing Money mandate/risk/Action Core/permit/canary runtimes retain all side-effect authority.
      canExecute:false,
    })
  }catch(error){
    console.error('SHARK Coffer runtime worker failed',error)
    return NextResponse.json({ok:false,error:'money_shark_coffer_runtime_failed'},{status:502})
  }
}

export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
