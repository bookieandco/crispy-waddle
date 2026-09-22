import { NextRequest,NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { runSubnetScan } from '@/lib/opportunities/subnet-runtime'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300

function authorized(request:NextRequest){
  const secret=process.env.CRON_SECRET
  return Boolean(secret&&request.headers.get('authorization')==='Bearer '+secret)
}
function intParam(request:NextRequest,key:string,fallback:number,min:number,max:number){
  const raw=request.nextUrl.searchParams.get(key)
  if(raw===null)return fallback
  const value=Number(raw)
  return Number.isInteger(value)&&value>=min&&value<=max?value:null
}
async function run(request:NextRequest){
  if(!authorized(request))return NextResponse.json({ok:false},{status:401})
  const maxPages=intParam(request,'maxPages',20,1,50)
  if(maxPages===null)return NextResponse.json({ok:false,error:'invalid_scan_parameters'},{status:400})
  const state=request.nextUrl.searchParams.get('state')?.trim()||'All'
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'subnet_persistence_unavailable'},{status:503})
  try{
    const receipt=await runSubnetScan(client,{maxPages,state})
    return NextResponse.json({ok:true,receipt})
  }catch(error){
    console.error('SBA SUBNet scan failed',error)
    return NextResponse.json({
      ok:false,
      error:'subnet_scan_failed',
      reason:error instanceof Error?error.message:'worker_execution_failed',
    },{status:502})
  }
}
export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
