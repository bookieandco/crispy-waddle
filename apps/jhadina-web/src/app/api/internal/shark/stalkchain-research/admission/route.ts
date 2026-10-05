import {NextRequest,NextResponse} from 'next/server'
import {authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth'
import {runStalkChainProviderAdmission} from '@/lib/shark/stalkchain-research-worker'

export const runtime='nodejs'
export const dynamic='force-dynamic'

async function run(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false},{status:401})
  const apiKey=process.env.STALKCHAIN_API_KEY?.trim()
  if(!apiKey)return NextResponse.json({
    ok:false,
    error:'shark_stalkchain_api_key_unavailable',
    configured:false,
    authority:'READ_ONLY_RESEARCH',
    canAuthorizeTrade:false,
  },{status:503})
  try{
    const admission=await runStalkChainProviderAdmission(apiKey)
    return NextResponse.json({
      ok:true,
      configured:true,
      serviceHealthy:admission.serviceHealthy,
      accountReadable:admission.accountReadable,
      creditsRemaining:admission.creditsRemaining,
      observedAt:admission.observedAt,
      evidenceIds:admission.evidenceIds,
      authority:admission.authority,
      canAuthorizeTrade:false,
      canSign:false,
      canBroadcast:false,
    })
  }catch(error){
    console.error('SHARK StalkChain provider admission failed',error)
    return NextResponse.json({
      ok:false,
      configured:true,
      error:'shark_stalkchain_provider_admission_failed',
      authority:'READ_ONLY_RESEARCH',
      canAuthorizeTrade:false,
    },{status:502})
  }
}

export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
