import {NextRequest,NextResponse} from 'next/server'
import {authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient} from '@/lib/supabase/service-role'
import {
  STALKCHAIN_CANARY_CONFIG,
  runStalkChainProviderAdmission,
  runStalkChainResearchWorker,
} from '@/lib/shark/stalkchain-research-worker'

export const runtime='nodejs'
export const dynamic='force-dynamic'

async function run(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false},{status:401})

  const apiKey=process.env.STALKCHAIN_API_KEY?.trim()
  if(!apiKey)return NextResponse.json({
    ok:false,
    ready:false,
    configured:false,
    state:'KEY_REQUIRED',
    authority:'READ_ONLY_RESEARCH',
    canAuthorizeTrade:false,
    canExecute:false,
  },{status:503})

  const client=createSchedulerServiceRoleClient(request)
  if(!client)return NextResponse.json({
    ok:false,
    ready:false,
    configured:true,
    state:'PERSISTENCE_UNAVAILABLE',
    authority:'READ_ONLY_RESEARCH',
    canAuthorizeTrade:false,
    canExecute:false,
  },{status:503})

  const {data:existing,error:existingError}=await client
    .from('jhadina_shark_stalkchain_research_briefs')
    .select('brief_id,generated_at,created_at')
    .order('generated_at',{ascending:false})
    .limit(1)
    .maybeSingle()

  if(existingError)return NextResponse.json({
    ok:false,
    ready:false,
    configured:true,
    state:'LEDGER_UNAVAILABLE',
    authority:'READ_ONLY_RESEARCH',
    canAuthorizeTrade:false,
    canExecute:false,
  },{status:503})

  if(existing)return NextResponse.json({
    ok:true,
    ready:true,
    configured:true,
    state:'ALREADY_COMMISSIONED',
    briefId:existing.brief_id,
    generatedAt:existing.generated_at,
    authority:'READ_ONLY_RESEARCH',
    canAuthorizeTrade:false,
    canExecute:false,
    canSign:false,
    canBroadcast:false,
  })

  try{
    const admission=await runStalkChainProviderAdmission(apiKey)
    const canary=await runStalkChainResearchWorker(client,{
      apiKey,
      ...STALKCHAIN_CANARY_CONFIG,
      verifyPersistenceReplay:true,
    })
    return NextResponse.json({
      ok:true,
      ready:true,
      configured:true,
      state:'COMMISSIONED',
      provider:{
        serviceHealthy:admission.serviceHealthy,
        accountReadable:admission.accountReadable,
        creditsRemaining:admission.creditsRemaining,
        observedAt:admission.observedAt,
      },
      canary:{
        briefId:canary.briefId,
        generatedAt:canary.generatedAt,
        traders:canary.traders,
        emerging:canary.emerging,
        failures:canary.failures,
        disposition:canary.disposition,
        replayDisposition:canary.replayDisposition,
        persistenceReplayVerified:canary.persistenceReplayVerified,
        providerCreditsRemaining:canary.providerCreditsRemaining,
      },
      authority:'READ_ONLY_RESEARCH',
      canAuthorizeTrade:false,
      canExecute:false,
      canSign:false,
      canBroadcast:false,
    })
  }catch(error){
    console.error('SHARK StalkChain commissioning failed',error)
    return NextResponse.json({
      ok:false,
      ready:false,
      configured:true,
      state:'COMMISSION_FAILED',
      error:'shark_stalkchain_commission_failed',
      authority:'READ_ONLY_RESEARCH',
      canAuthorizeTrade:false,
      canExecute:false,
    },{status:502})
  }
}

export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
