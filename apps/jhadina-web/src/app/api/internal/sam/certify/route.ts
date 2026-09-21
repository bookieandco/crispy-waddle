import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { readSamUsableCertification } from '@/lib/money-opportunities/sam-usable-runtime'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function GET(request:Request){
  const secret=process.env.CRON_SECRET
  if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({ok:false},{status:401})
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'SAM_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED'},{status:503})
  const certification=await readSamUsableCertification(client)
  return NextResponse.json({ok:certification.status==='pass',certification},{status:certification.status==='pass'?200:409,headers:{'cache-control':'no-store'}})
}
