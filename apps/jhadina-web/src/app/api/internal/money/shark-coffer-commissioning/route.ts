import {NextRequest,NextResponse} from 'next/server'
import {authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient} from '@/lib/supabase/service-role'
import {collectSharkCofferCommissioningSnapshot} from '@/lib/money/shark-coffer-commissioning'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function windowHours(request:NextRequest):number|null{
  const raw=request.nextUrl.searchParams.get('windowHours')
  if(raw===null)return 24
  const value=Number(raw)
  return Number.isInteger(value)&&value>=1&&value<=168?value:null
}

async function run(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false,error:'unauthorized'},{status:401})
  const hours=windowHours(request)
  if(hours===null)return NextResponse.json({ok:false,error:'invalid_window_hours'},{status:400})
  const client=createSchedulerServiceRoleClient(request)
  if(!client)return NextResponse.json({ok:false,error:'money_shark_coffer_commissioning_storage_unavailable'},{status:503})
  try{
    const snapshot=await collectSharkCofferCommissioningSnapshot({client,windowHours:hours})
    return NextResponse.json({
      ok:true,
      snapshot,
      authority:'COMMISSIONING_EVIDENCE_ONLY',
      canExecute:false,
    })
  }catch(error){
    console.error('SHARK Coffer commissioning snapshot failed',error)
    return NextResponse.json({ok:false,error:'money_shark_coffer_commissioning_failed'},{status:502})
  }
}

export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
