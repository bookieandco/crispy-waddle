import {NextRequest,NextResponse} from 'next/server'
import {authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient} from '@/lib/supabase/service-role'
import {runStalkChainResearchWorker,stalkChainResearchWorkerConfig} from '@/lib/shark/stalkchain-research-worker'

export const runtime='nodejs'
export const dynamic='force-dynamic'

async function run(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false},{status:401})
  const apiKey=process.env.STALKCHAIN_API_KEY?.trim()
  if(!apiKey)return NextResponse.json({ok:false,error:'shark_stalkchain_api_key_unavailable'},{status:503})
  const client=createSchedulerServiceRoleClient(request)
  if(!client)return NextResponse.json({ok:false,error:'shark_persistence_unavailable'},{status:503})
  try{
    const config=stalkChainResearchWorkerConfig()
    const result=await runStalkChainResearchWorker(client,{apiKey,...config})
    return NextResponse.json({
      ok:true,
      briefId:result.briefId,
      generatedAt:result.generatedAt,
      leaderboardWindow:result.leaderboardWindow,
      traders:result.traders,
      emerging:result.emerging,
      failures:result.failures,
      disposition:result.disposition,
      providerCreditsRemaining:result.providerCreditsRemaining,
      authority:result.authority,
      canAuthorizeTrade:false,
      canExecute:false,
      canSign:false,
      canBroadcast:false,
    })
  }catch(error){
    console.error('SHARK StalkChain research worker failed',error)
    return NextResponse.json({ok:false,error:'shark_stalkchain_research_worker_failed',reason:'worker_execution_failed'},{status:502})
  }
}

export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
