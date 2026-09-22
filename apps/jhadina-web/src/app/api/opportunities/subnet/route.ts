import { NextRequest,NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic='force-dynamic'
export const runtime='nodejs'

function limitFrom(request:NextRequest){
  const raw=request.nextUrl.searchParams.get('limit')
  if(raw===null)return 100
  const value=Number(raw)
  return Number.isInteger(value)&&value>=1&&value<=200?value:null
}

export async function GET(request:NextRequest){
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({success:false,error:'Authentication required'},{status:401})
  const limit=limitFrom(request)
  if(limit===null)return NextResponse.json({success:false,error:'limit must be between 1 and 200'},{status:400})
  const service=createServiceRoleClient()
  if(!service)return NextResponse.json({
    success:false,error:'SUBNet runtime is not configured.',blocker:'SUPABASE_SERVICE_ROLE_KEY',
  },{status:503})

  const {data,error}=await service.from('jhadina_subnet_catalog')
    .select('external_id,title,prime_name,description,closing_date,performance_start_date,place_of_performance,naics_code,naics_label,contact_name,contact_email,contact_phone,source_url,last_seen_at')
    .order('closing_date',{ascending:true,nullsFirst:false})
    .limit(limit)
  if(error)return NextResponse.json({success:false,error:'Unable to load SBA SUBNet opportunities: '+error.message},{status:502})

  const today=new Date().toISOString().slice(0,10)
  const rows=(data??[]).filter(row=>!row.closing_date||String(row.closing_date)>=today)
  const soon=new Date(Date.now()+7*86400000).toISOString().slice(0,10)
  return NextResponse.json({
    success:true,
    data:{
      opportunities:rows,
      summary:{
        total:rows.length,
        closingSoon:rows.filter(row=>row.closing_date&&String(row.closing_date)<=soon).length,
        withNaics:rows.filter(row=>row.naics_code).length,
        withContact:rows.filter(row=>row.contact_email||row.contact_phone).length,
      },
      authority:{
        outreachAuthorized:false,
        quoteSubmissionAuthorized:false,
        contractSignatureAuthorized:false,
        paymentAuthorized:false,
      },
    },
  },{headers:{'cache-control':'no-store'}})
}
