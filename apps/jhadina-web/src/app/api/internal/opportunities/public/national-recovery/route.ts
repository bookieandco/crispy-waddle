import {NextRequest,NextResponse} from 'next/server'
import {authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient} from '@/lib/supabase/service-role'
import {loadOfficialDomainHints} from '@/lib/opportunities/dotgov-registry-runtime'
import {planNationwideDiscoveryRecovery,US_STATE_AND_DC_CODES,type UsStateOrDcCode,type PublicJurisdictionLevel,type NationwideRecoveryCandidate} from '@jhadina/opportunity-core'

export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=60
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'cache-control':'no-store'}})
type RecoveryRow={
 id:string;jurisdiction_id:string;state_code:UsStateOrDcCode|null
 status:NationwideRecoveryCandidate['status']
 last_error:string|null;source_refs:string[]|null;attempt_count:number
}
export async function POST(request:NextRequest){
 if(!(await authorizedSchedulerRequest(request)))return reply({ok:false,error:'unauthorized_scheduler'},401)
 const client=createSchedulerServiceRoleClient(request)
 if(!client)return reply({ok:false,error:'national_recovery_persistence_unavailable'},503)
 const body=await request.json().catch(()=>null) as {state?:unknown;jobIds?:unknown;apply?:unknown}|null
 const state=typeof body?.state==='string'?body.state.trim().toUpperCase():''
 if(!US_STATE_AND_DC_CODES.some(x=>x===state))return reply({ok:false,error:'state_code_required'},400)
 if(!Array.isArray(body?.jobIds)||body.jobIds.length<1||body.jobIds.length>20||
  body.jobIds.some(id=>typeof id!=='string'||!id.startsWith('discover:')||id.length>256)||
  new Set(body.jobIds).size!==body.jobIds.length)return reply({ok:false,error:'one_to_twenty_unique_existing_job_ids_required'},400)
 const apply=body?.apply===true
 const jobIds=body.jobIds as string[]
 try{
  const {data:jobs,error}=await client.from('jhadina_public_source_discovery_jobs')
   .select('id,jurisdiction_id,state_code,status,last_error,source_refs,attempt_count')
   .eq('state_code',state).in('id',jobIds).limit(20).returns<RecoveryRow[]>()
  if(error)throw error
  if((jobs??[]).length!==jobIds.length)return reply({ok:false,error:'unknown_or_mismatched_jobs'},404)
  const jurisdictions=[...new Set((jobs??[]).map(x=>x.jurisdiction_id))]
  const [{data:jurisdictionRows,error:jurisdictionError},domains]=await Promise.all([
   client.from('jhadina_public_jurisdictions').select('id,level,state_code')
    .eq('state_code',state).in('id',jurisdictions).limit(20),
   loadOfficialDomainHints(client,jurisdictions),
  ])
  if(jurisdictionError)throw jurisdictionError
  const levels=new Map((jurisdictionRows??[]).map(row=>[row.id,row.level as PublicJurisdictionLevel]))
  if(levels.size!==jurisdictions.length)throw new Error('national_recovery_jurisdiction_identity_mismatch')
  const byId=new Map((jobs??[]).map(job=>[job.id,job]))
  const ordered=jobIds.map(jobId=>{
   const job=byId.get(jobId)!
   return {jobId:job.id,jurisdictionId:job.jurisdiction_id,state:state as UsStateOrDcCode,
    level:levels.get(job.jurisdiction_id)!,
    status:job.status,lastError:job.last_error,sourceReferences:job.source_refs??[],
    officialDomains:domains.get(job.jurisdiction_id)??[],attemptCount:job.attempt_count}
  })
  const decisions=planNationwideDiscoveryRecovery(ordered,20)
  const eligible=decisions.filter(item=>item.action==='requeue_official_only')
  if(!apply)return reply({ok:true,mode:'official_domain_recovery_preview',state,decisions,
   eligibleCount:eligible.length,applied:0,externalFetchAuthorized:false,contactAuthorized:false})
  // Exact IDs only. An application worker will separately undertake discovery
  // under its existing scheduler and access checks; this does not fetch a website.
  let applied=0
  const now=new Date().toISOString()
  for(const row of eligible){
   const {data:updated,error:updateError}=await client.from('jhadina_public_source_discovery_jobs')
    .update({status:'pending',attempt_count:0,last_error:null,updated_at:now})
    .eq('id',row.jobId).eq('jurisdiction_id',row.jurisdictionId).eq('state_code',state)
    .eq('status','blocked').eq('last_error','PUBLIC_SOURCE_NO_OFFICIAL_DOMAIN_AND_SEARCH_NOT_CONFIGURED')
    .select('id')
   if(updateError)throw updateError
   applied+=(updated??[]).length
  }
  return reply({ok:true,mode:'exact_id_official_domain_recovery',state,decisions,eligibleCount:eligible.length,
   applied,externalFetchAuthorized:false,contactAuthorized:false,bidSubmissionAuthorized:false})
 }catch{
  return reply({ok:false,error:'national_recovery_failed_closed'},503)
 }
}
