import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { runSamMarketBootstrap } from '@/lib/money-opportunities/sam-wide-runtime'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300

function authorized(request:NextRequest){
  const secret=process.env.CRON_SECRET
  return Boolean(secret&&request.headers.get('authorization')===`Bearer ${secret}`)
}
function intParam(request:NextRequest,key:string,fallback:number,min:number,max:number){
  const raw=request.nextUrl.searchParams.get(key)
  if(raw===null)return fallback
  const value=Number(raw)
  return Number.isInteger(value)&&value>=min&&value<=max?value:null
}
async function run(request:NextRequest){
  if(!authorized(request))return NextResponse.json({ok:false},{status:401})
  if(!process.env.SAM_GOV_API_KEY)return NextResponse.json({ok:false,error:'sam_api_unavailable'},{status:503})
  const historyDays=intParam(request,'historyDays',365,30,3650)
  const windowDays=intParam(request,'windowDays',7,1,31)
  const maxWindows=intParam(request,'maxWindows',4,1,31)
  const maxPages=intParam(request,'maxPages',20,1,100)
  if(historyDays===null||windowDays===null||maxWindows===null||maxPages===null){
    return NextResponse.json({ok:false,error:'invalid_bootstrap_parameters'},{status:400})
  }
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'sam_persistence_unavailable'},{status:503})
  try{
    const result=await runSamMarketBootstrap(client,{historyDays,windowDays,maxWindows,maxPages,pageSize:1000})
    return NextResponse.json({ok:true,result})
  }catch(error){
    console.error('SAM market bootstrap failed',error)
    return NextResponse.json({
      ok:false,
      error:'sam_bootstrap_failed',
      reason:error instanceof Error?error.message:'worker_execution_failed',
    },{status:502})
  }
}
export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
