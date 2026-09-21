import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { certifySamUsableRuntime } from '@/lib/money-opportunities/sam-usable-runtime'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function authorized(request:NextRequest){
  const secret=process.env.CRON_SECRET
  return Boolean(secret&&request.headers.get('authorization')===`Bearer ${secret}`)
}
async function run(request:NextRequest){
  if(!authorized(request))return NextResponse.json({ok:false},{status:401})
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'sam_persistence_unavailable'},{status:503})
  try{
    const certification=await certifySamUsableRuntime(client)
    return NextResponse.json({ok:true,certification},{status:certification.status==='pass'?200:409})
  }catch(error){
    console.error('SAM usable-final certification failed',error)
    return NextResponse.json({ok:false,error:'sam_certification_failed',reason:error instanceof Error?error.message:'worker_execution_failed'},{status:502})
  }
}
export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
