import {NextRequest,NextResponse} from 'next/server'
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {summarizeNationalProcurementCoverage,US_STATE_AND_DC_CODES,NATIONAL_PROCUREMENT_GAP_SOURCES,type NationalCoverageRow} from '@jhadina/opportunity-core'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'cache-control':'no-store'}})
export async function GET(request:NextRequest){
 try{
  await (await createRequestIdentityVerifier()).verify({})
  const state=(request.nextUrl.searchParams.get('state')??'').trim().toUpperCase()
  if(state&&!US_STATE_AND_DC_CODES.some(code=>code===state))return reply({ok:false,error:'Invalid state/DC code'},400)
  const client=createServiceRoleClient()
  if(!client)return reply({ok:false,error:'Private coverage registry unavailable'},503)
  const {data,error}=await client.from('jhadina_procurement_national_coverage')
   .select('state_code,level,jurisdictions,source_bearing,verified_source_jurisdictions,certified_read_only_jurisdictions,total_source_records,blocked_jobs,no_provider_jobs,recovery_ready_jobs')
   .limit(600)
  if(error)throw error
  const report=summarizeNationalProcurementCoverage((data??[]) as NationalCoverageRow[])
  return reply({
   ok:true,mode:'read_only_national_coverage',
   report:state?{...report,states:report.states.filter(item=>item.state===state)}:report,
   rollupScope:state||'ALL_50_STATES_AND_DC',
   expansionCatalogs:NATIONAL_PROCUREMENT_GAP_SOURCES,
   coverageSource:'existing_jhadina_public_jurisdictions_sources_and_jobs',
   censusBenchmark:'2025 independent-local-governments baseline is not comparable to the mixed registry',
   warning:'An inventoried jurisdiction, candidate source, verified official source and certified active solicitation feed are four different statuses. Never infer bid or purchase eligibility.',
   externalContactAuthorized:false,bidSubmissionAuthorized:false,paymentAuthorized:false,
  })
 }catch(error){
  const message=error instanceof Error?error.message:''
  return reply({ok:false,error:/identity|authenticated|session|unauthorized/i.test(message)?'Authentication required':'Coverage report unavailable'},
   /identity|authenticated|session|unauthorized/i.test(message)?401:503)
 }
}
