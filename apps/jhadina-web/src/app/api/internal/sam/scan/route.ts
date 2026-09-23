import { NextRequest, NextResponse } from 'next/server'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { runSamWideScan } from '@/lib/money-opportunities/sam-wide-runtime'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300

const mmddyyyy=(d:Date)=>`${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')}/${d.getUTCFullYear()}`
function intParam(request:NextRequest,key:string,fallback:number,min:number,max:number){
  const raw=request.nextUrl.searchParams.get(key)
  if(raw===null)return fallback
  const value=Number(raw)
  return Number.isInteger(value)&&value>=min&&value<=max?value:null
}
async function run(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false},{status:401})
  if(!process.env.SAM_GOV_API_KEY)return NextResponse.json({ok:false,error:'sam_api_unavailable'},{status:503})
  const lookbackDays=intParam(request,'lookbackDays',2,0,31)
  const maxPages=intParam(request,'maxPages',20,1,100)
  if(lookbackDays===null||maxPages===null)return NextResponse.json({ok:false,error:'invalid_scan_parameters'},{status:400})
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'sam_persistence_unavailable'},{status:503})
  const end=new Date()
  const start=new Date(end.getTime()-lookbackDays*86400000)
  try{
    const receipt=await runSamWideScan(client,{postedFrom:mmddyyyy(start),postedTo:mmddyyyy(end),maxPages,pageSize:1000})
    return NextResponse.json({ok:true,receipt})
  }catch(error){
    console.error('SAM wide scan failed',error)
    return NextResponse.json({ok:false,error:'sam_scan_failed',reason:error instanceof Error?error.message:'worker_execution_failed'},{status:502})
  }
}
export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
