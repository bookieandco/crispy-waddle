import {NextRequest,NextResponse} from 'next/server'
import {authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient} from '@/lib/supabase/service-role'
import {runPumpLifecycleObservationWorker} from '@/lib/shark/pump-lifecycle-repository'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function parseLimit(request:NextRequest):number|null{
  const raw=request.nextUrl.searchParams.get('limit')
  if(raw===null)return 100
  const value=Number(raw)
  return Number.isInteger(value)&&value>=1&&value<=500?value:null
}

async function run(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false},{status:401})
  const limit=parseLimit(request)
  if(limit===null)return NextResponse.json({ok:false,error:'invalid_limit'},{status:400})
  const rpcUrl=process.env.SOLANA_RPC_URL?.trim()
  if(!rpcUrl)return NextResponse.json({ok:false,error:'shark_solana_rpc_unavailable'},{status:503})
  const client=createSchedulerServiceRoleClient(request)
  if(!client)return NextResponse.json({ok:false,error:'shark_persistence_unavailable'},{status:503})
  try{
    const result=await runPumpLifecycleObservationWorker(client,{rpcUrl,limit})
    return NextResponse.json({
      ok:true,
      scanned:result.scanned,
      eligible:result.eligible,
      processed:result.processed,
      inserted:result.inserted,
      replayed:result.replayed,
      failed:result.failed,
      skipped:result.skipped,
      failures:result.failures.map(item=>({launchId:item.launchId,reason:'provider_or_persistence_failure'})),
      authority:'READ_ONLY_RESEARCH',
      canAuthorizeTrade:false,
    })
  }catch(error){
    console.error('SHARK Pump lifecycle worker failed',error)
    return NextResponse.json({ok:false,error:'shark_pump_lifecycle_worker_failed',reason:'worker_execution_failed'},{status:502})
  }
}

export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
