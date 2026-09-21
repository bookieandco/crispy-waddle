import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { runSamEnrichment } from '@/lib/money-opportunities/sam-usable-runtime'

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
  const limit=intParam(request,'limit',5,3,20)
  const maxDocuments=intParam(request,'maxDocuments',40,1,100)
  const maxProviders=intParam(request,'maxProviders',8,1,20)
  if(limit===null||maxDocuments===null||maxProviders===null)return NextResponse.json({ok:false,error:'invalid_enrichment_parameters'},{status:400})
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'sam_persistence_unavailable'},{status:503})
  try{
    const result=await runSamEnrichment(client,{limit,maxDocuments,maxProvidersPerNotice:maxProviders})
    return NextResponse.json({ok:true,...result})
  }catch(error){
    console.error('SAM enrichment failed',error)
    return NextResponse.json({ok:false,error:'sam_enrichment_failed',reason:error instanceof Error?error.message:'worker_execution_failed'},{status:502})
  }
}
export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
