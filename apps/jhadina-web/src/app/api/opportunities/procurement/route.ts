import { NextRequest, NextResponse } from 'next/server'
import { createRequestIdentityVerifier } from '@/lib/auth/request-identity'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { planProcurementSourceRecovery, reconcileProcurementNotice, prepareProcurementBidPacket, reviewProcurementCommercial, type ProcurementSource } from '@jhadina/opportunity-core'
import type { FulfillmentPlan } from '@jhadina/opportunity-core'

export const dynamic='force-dynamic'
export const runtime='nodejs'

type SourceRow={
 id:string;jurisdiction_id:string;source_name:string;source_url:string;state_code:string|null;
 source_kinds:string[]|null;verification_status:string;adapter_status:string;access_review_status:string;
 last_seen_at:string|null;last_adapter_trial_at:string|null;
}
async function authorize(){await (await createRequestIdentityVerifier()).verify({})}
const headers={'cache-control':'no-store'}
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers})
function errorReply(error:unknown){
 const message=error instanceof Error?error.message:'procurement_review_unavailable'
 return reply({ok:false,error:/Authenticated|identity|session|unauthorized/i.test(message)?'Authentication required':'Procurement review unavailable'},/Authenticated|identity|session|unauthorized/i.test(message)?401:502)
}
/** Read-only CA-first recovery list. This does NOT restart sources, bypass robots, or enable adapters. */
export async function GET(request:NextRequest){
 try{
  await authorize()
  const service=createServiceRoleClient()
  if(!service)return reply({ok:false,error:'Procurement registry unavailable'},503)
  const state=(request.nextUrl.searchParams.get('state')||'CA').toUpperCase()
  if(!/^[A-Z]{2}$/.test(state))return reply({ok:false,error:'State must be two letters'},400)
  const raw=Number(request.nextUrl.searchParams.get('limit')??50)
  if(!Number.isInteger(raw)||raw<1||raw>100)return reply({ok:false,error:'limit must be 1–100'},400)
  const {data,error}=await service
   .from('jhadina_public_procurement_sources')
   .select('id,jurisdiction_id,source_name,source_url,state_code,source_kinds,verification_status,adapter_status,access_review_status,last_seen_at,last_adapter_trial_at')
   .eq('state_code',state)
   .in('adapter_status',['degraded','adapter_required','deferred','active'])
   .order('last_seen_at',{ascending:false})
   .limit(500)
  if(error)throw new Error('registry_fetch_failed')
  const mapped=(data??[] as SourceRow[]).map(row=>({
   id:row.id,name:row.source_name,sourceUrl:row.source_url,stateCode:row.state_code??state,
   jurisdictionLevel:row.jurisdiction_id.startsWith('school_district:')?'school_district':row.jurisdiction_id.split(':')[0]??'other',
   verificationStatus:row.verification_status,adapterStatus:row.adapter_status,
   accessReviewStatus:row.access_review_status,lastSeenAt:row.last_seen_at,lastTrialAt:row.last_adapter_trial_at,
   sourceKinds:row.source_kinds??[],
  })) as ProcurementSource[]
  const plans=planProcurementSourceRecovery(mapped,new Date().toISOString(),raw)
  return reply({ok:true,mode:'read_only_source_recovery_plan',state,scanned: mapped.length,returned:plans.length,
   decisions:plans,sourceSnapshotIsPartial:true,
   caveat:'This samples up to 500 source rows by recent observation; it is not a full 26K-source recovery certificate.',
   externalFetchAuthorized:false,outreachAuthorized:false,bidSubmissionAuthorized:false})
 }catch(error){return errorReply(error)}
}
/** Build an immutable-style draft from a persisted public observation, not client assertions.
 * No documents, verified provider profiles, quotes or form attachments means a blocked review packet.
 */
export async function POST(request:NextRequest){
 try{
  await authorize()
  const body=await request.json().catch(()=>null) as {inboxId?:unknown}|null
  const id=typeof body?.inboxId==='string'?body.inboxId.trim():''
  if(!id||id.length>256)return reply({ok:false,error:'Valid inboxId required'},400)
  const service=createServiceRoleClient()
  if(!service)return reply({ok:false,error:'Procurement inbox unavailable'},503)
  const {data,error}=await service.from('jhadina_public_opportunity_inbox')
   .select('id,stage,title,source_url,source_id,state_code,active,last_seen_at')
   .eq('id',id).eq('active',true).maybeSingle<{
    id:string;stage:string;title:string;source_url:string;source_id:string;
    state_code:string;active:boolean;last_seen_at:string
   }>()
  if(error)throw new Error('inbox_read_failed')
  if(!data)return reply({ok:false,error:'Active observation not found'},404)
  const notice=reconcileProcurementNotice(data.id,[])
  const plan:FulfillmentPlan={opportunityId:data.id,structure:'unresolved',assignments:[],
   coveredRequirementIds:[],uncoveredRequirementIds:[],blockers:['No verified scope, provider assignments or qualification evidence loaded.'],
   rationale:['Research-only public observation; obtain official documents first.'],requiresHumanApproval:true,engagementAuthorized:false}
  const commercial=reviewProcurementCommercial({plan,providers:[],quotes:[],costEvidence:[]})
  const packet=prepareProcurementBidPacket({notice,plan,providers:[],commercial,formAttachments:{}})
  return reply({ok:true,mode:'no_send_draft',observed:{id:data.id,title:data.title,stage:data.stage,sourceUrl:data.source_url,
   sourceId:data.source_id,state:data.state_code,lastSeenAt:data.last_seen_at},
   packet,missingEvidence:'Official solicitation/addenda, source-attributed buyer contact, requirements, qualified providers, firm quotes and forms.',
   externalActionAuthorized:false})
 }catch(error){return errorReply(error)}
}
