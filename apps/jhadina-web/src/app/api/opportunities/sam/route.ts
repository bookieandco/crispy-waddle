import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { projectSamCommandCenter } from '@/lib/money-opportunities/sam-command-center'

export const dynamic='force-dynamic'
export const runtime='nodejs'

async function authenticated(){
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  return Boolean(user)
}

function limitFrom(request:NextRequest){
  const raw=request.nextUrl.searchParams.get('limit')
  if(raw===null)return 50
  const value=Number(raw)
  return Number.isInteger(value)&&value>=1&&value<=100?value:null
}

export async function GET(request:NextRequest){
  if(!await authenticated())return NextResponse.json({success:false,error:'Authentication required'},{status:401})
  const limit=limitFrom(request)
  if(limit===null)return NextResponse.json({success:false,error:'limit must be between 1 and 100'},{status:400})

  const service=createServiceRoleClient()
  if(!service)return NextResponse.json({
    success:false,
    error:'Federal contracts runtime is not configured.',
    blocker:'SUPABASE_SERVICE_ROLE_KEY',
  },{status:503})

  const {data:catalog,error:catalogError}=await service
    .from('jhadina_sam_catalog')
    .select('notice_id,solicitation_number,title,agency,office,posted_date,response_deadline,naics_codes,classification_codes,set_aside,source_url,version,last_seen_at')
    .order('last_seen_at',{ascending:false})
    .limit(limit)
  if(catalogError)return NextResponse.json({success:false,error:'Unable to load SAM catalog: '+catalogError.message},{status:502})

  const catalogRows=(catalog??[]) as Array<Record<string,unknown>>
  const noticeIds=catalogRows.map(row=>String(row.notice_id)).filter(Boolean)
  if(!noticeIds.length){
    return NextResponse.json({success:true,data:projectSamCommandCenter({catalog:[],analyses:[],providers:[],pursuits:[]})})
  }

  const [analysisResult,providerResult,pursuitResult]=await Promise.all([
    service.from('jhadina_sam_analysis').select('notice_id,requirements,subcontractability,operating,analyzed_at').in('notice_id',noticeIds),
    service.from('jhadina_sam_provider_candidates').select('notice_id,requirement_id,provider_key,provider_name,country,uei,cage,score,status,sources,discovered_at').in('notice_id',noticeIds),
    service.from('jhadina_sam_pursuit_options').select('notice_id,status,assignments,uncovered_requirement_ids,quote_targets,commercial,blockers,generated_at').in('notice_id',noticeIds),
  ])
  const error=analysisResult.error??providerResult.error??pursuitResult.error
  if(error)return NextResponse.json({success:false,error:'Unable to load Federal Contracts evidence: '+error.message},{status:502})

  const data=projectSamCommandCenter({
    catalog:catalogRows,
    analyses:(analysisResult.data??[]) as Array<Record<string,unknown>>,
    providers:(providerResult.data??[]) as Array<Record<string,unknown>>,
    pursuits:(pursuitResult.data??[]) as Array<Record<string,unknown>>,
  })
  return NextResponse.json({success:true,data},{headers:{'cache-control':'no-store'}})
}
