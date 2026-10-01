import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildPublicSourceDiscoveryQueries,
  decidePublicSourceDiscovery,
  type PublicJurisdictionDescriptor,
  type PublicProcurementSourceCandidate,
  type UsStateOrDcCode,
} from '@jhadina/opportunity-core'
import {
  discoverPublicProcurementCandidates,
  discoverPublicProcurementCandidatesFromOfficialDomains,
} from './public-source-discovery-provider'
import { loadOfficialDomainHints, syncDotGovOfficialDomainRegistry } from './dotgov-registry-runtime'

type DiscoveryJobRow={
  id:string
  jurisdiction_id:string
  status:'pending'|'discovered'|'adapter_required'|'active'|'blocked'
  priority:number
  attempt_count:number
}

type JurisdictionRow={
  id:string
  level:PublicJurisdictionDescriptor['level']
  state_code:UsStateOrDcCode
  name:string
  normalized_name:string
}

const chunks=<T>(values:T[],size:number)=>{
  const out:T[][]=[]
  for(let i=0;i<values.length;i+=size)out.push(values.slice(i,i+size))
  return out
}

function sourceId(jurisdictionId:string,url:string):string{
  const hash=createHash('sha256').update(`${jurisdictionId}\n${url}`).digest('hex').slice(0,24)
  return `public-source:${jurisdictionId}:${hash}`
}

function discoveryConfigured():boolean{
  const generic=Boolean(process.env.WEB_SEARCH_URL?.trim()&&process.env.WEB_SEARCH_API_KEY?.trim())
  const exa=Boolean(process.env.EXA_API_KEY?.trim())
  return generic||exa
}

function boundedInt(raw:string|undefined,fallback:number,min:number,max:number):number{
  const parsed=Number(raw)
  return Number.isInteger(parsed)&&parsed>=min&&parsed<=max?parsed:fallback
}

async function persistCandidates(
  client:SupabaseClient,
  jurisdictionId:string,
  candidates:PublicProcurementSourceCandidate[],
  now:string,
){
  if(!candidates.length)return[] as string[]
  const rows=candidates.map(candidate=>({
    id:sourceId(jurisdictionId,candidate.sourceUrl),
    jurisdiction_id:jurisdictionId,
    source_name:candidate.sourceName,
    source_url:candidate.sourceUrl,
    source_kinds:candidate.sourceKinds,
    adapter_kind:candidate.adapterKind,
    discovery_provider:candidate.provider,
    verification_status:candidate.status,
    official_owner_url:candidate.officialLinkEvidence?.officialPageUrl??(candidate.status==='official_owner_verified'?candidate.sourceUrl:null),
    confidence:candidate.confidence,
    evidence_refs:candidate.evidenceRefs,
    blockers:candidate.blockers,
    adapter_status:'adapter_required',
    discovered_at:now,
    verified_at:['official_owner_verified','official_portal_verified'].includes(candidate.status)?now:null,
    last_seen_at:now,
    updated_at:now,
  }))
  const {error}=await client.from('jhadina_public_procurement_sources').upsert(rows,{onConflict:'jurisdiction_id,source_url'})
  if(error)throw new Error(`public_procurement_source_persist_failed:${error.message}`)
  return rows.filter(row=>['official_owner_verified','official_portal_verified'].includes(row.verification_status)).map(row=>row.id)
}

async function commissionOne(input:{
  client:SupabaseClient
  job:DiscoveryJobRow
  jurisdiction:JurisdictionRow
  fetchImpl?:typeof fetch
  now:string
  queryBudget:number
  officialDomains:string[]
  searchConfigured:boolean
}){
  const descriptor:PublicJurisdictionDescriptor={
    id:input.jurisdiction.id,
    level:input.jurisdiction.level,
    name:input.jurisdiction.name,
    state:input.jurisdiction.state_code,
    county:input.jurisdiction.level==='county'?input.jurisdiction.normalized_name:undefined,
    locality:input.jurisdiction.level==='city'?input.jurisdiction.normalized_name:undefined,
  }
  try{
    descriptor.officialDomainHints=input.officialDomains
    let candidates=input.officialDomains.length
      ?await discoverPublicProcurementCandidatesFromOfficialDomains({
        jurisdiction:descriptor,
        domains:input.officialDomains,
        fetchImpl:input.fetchImpl,
        now:input.now,
      })
      :[]

    let decision=decidePublicSourceDiscovery(descriptor.id,candidates)
    if(decision.verifiedSources.length===0&&input.searchConfigured){
      const searched=await discoverPublicProcurementCandidates({
        jurisdiction:descriptor,
        queries:buildPublicSourceDiscoveryQueries(descriptor),
        queryBudget:input.queryBudget,
        fetchImpl:input.fetchImpl,
        now:input.now,
      })
      const byUrl=new Map(candidates.map(candidate=>[candidate.sourceUrl,candidate]))
      for(const candidate of searched){
        const current=byUrl.get(candidate.sourceUrl)
        if(!current||candidate.confidence>current.confidence)byUrl.set(candidate.sourceUrl,candidate)
      }
      candidates=[...byUrl.values()]
      decision=decidePublicSourceDiscovery(descriptor.id,candidates)
    }else if(decision.verifiedSources.length===0&&!input.searchConfigured&&input.officialDomains.length===0){
      throw new Error('PUBLIC_SOURCE_NO_OFFICIAL_DOMAIN_AND_SEARCH_NOT_CONFIGURED')
    }
    const sourceRefs=await persistCandidates(input.client,descriptor.id,candidates,input.now)
    const nextStatus=decision.verifiedSources.length?'adapter_required':decision.reviewCandidates.length?'discovered':'pending'
    const {error}=await input.client
      .from('jhadina_public_source_discovery_jobs')
      .update({
        status:nextStatus,
        source_refs:sourceRefs,
        last_attempt_at:input.now,
        attempt_count:input.job.attempt_count+1,
        last_error:null,
        candidate_count:candidates.length,
        verified_source_count:decision.verifiedSources.length,
        updated_at:input.now,
      })
      .eq('id',input.job.id)
    if(error)throw new Error(`public_source_discovery_job_update_failed:${error.message}`)
    return {
      jobId:input.job.id,
      jurisdictionId:descriptor.id,
      status:nextStatus,
      candidateCount:candidates.length,
      verifiedSourceCount:decision.verifiedSources.length,
      error:null as string|null,
    }
  }catch(error){
    const message=error instanceof Error?error.message:'public_source_discovery_unknown_failure'
    const {error:updateError}=await input.client
      .from('jhadina_public_source_discovery_jobs')
      .update({
        status:input.job.status==='discovered'?'discovered':'pending',
        last_attempt_at:input.now,
        attempt_count:input.job.attempt_count+1,
        last_error:message,
        updated_at:input.now,
      })
      .eq('id',input.job.id)
    if(updateError)throw new Error(`public_source_discovery_job_error_update_failed:${updateError.message}`)
    return {
      jobId:input.job.id,
      jurisdictionId:descriptor.id,
      status:'retryable_error' as const,
      candidateCount:0,
      verifiedSourceCount:0,
      error:message,
    }
  }
}


async function ensureOfficialDomainRegistry(
  client:SupabaseClient,
  input:{fetchImpl?:typeof fetch;now:string},
){
  const {data,error}=await client
    .from('jhadina_public_official_domains')
    .select('last_seen_at')
    .order('last_seen_at',{ascending:false})
    .limit(1)
  if(error)throw new Error(`dotgov_registry_state_read_failed:${error.message}`)
  const latest=String(data?.[0]?.last_seen_at??'')
  const latestMs=latest?Date.parse(latest):NaN
  const nowMs=Date.parse(input.now)
  const stale=!Number.isFinite(latestMs)||!Number.isFinite(nowMs)||nowMs-latestMs>7*24*60*60*1000
  if(!stale){
    return {refreshed:false,latest}
  }
  const result=await syncDotGovOfficialDomainRegistry(client,{
    fetchImpl:input.fetchImpl,
    now:input.now,
  })
  return {refreshed:true,latest:input.now,result}
}

export async function commissionPublicProcurementSourceBatch(
  client:SupabaseClient,
  input:{batchSize?:number;queryBudget?:number;concurrency?:number;fetchImpl?:typeof fetch;now?:string}={},
){
  const now=input.now??new Date().toISOString()
  const searchConfigured=discoveryConfigured()
  const dotGovBootstrap=await ensureOfficialDomainRegistry(client,{fetchImpl:input.fetchImpl,now})
  const defaultBatch=searchConfigured?12:60
  const batchSize=Math.max(1,Math.min(input.batchSize??boundedInt(process.env.LOCAL_GOV_SOURCE_DISCOVERY_BATCH_SIZE,defaultBatch,1,100),100))
  const queryBudget=Math.max(1,Math.min(input.queryBudget??boundedInt(process.env.LOCAL_GOV_SOURCE_DISCOVERY_QUERY_BUDGET,3,1,4),4))
  const concurrency=Math.max(1,Math.min(input.concurrency??(searchConfigured?3:6),10))

  const {data:jobs,error:jobsError}=await client
    .from('jhadina_public_source_discovery_jobs')
    .select('id,jurisdiction_id,status,priority,attempt_count')
    .in('status',['pending','discovered'])
    .order('priority',{ascending:true})
    .order('attempt_count',{ascending:true})
    .order('updated_at',{ascending:true})
    .limit(batchSize)
    .returns<DiscoveryJobRow[]>()
  if(jobsError)throw new Error(`public_source_discovery_queue_read_failed:${jobsError.message}`)
  if(!jobs?.length)return {status:'IDLE' as const,processed:0,verifiedSources:0,retryableErrors:0,results:[],externalContactAuthorized:false as const}

  const ids=[...new Set(jobs.map(job=>job.jurisdiction_id))]
  const {data:jurisdictions,error:jurisdictionError}=await client
    .from('jhadina_public_jurisdictions')
    .select('id,level,state_code,name,normalized_name')
    .in('id',ids)
    .returns<JurisdictionRow[]>()
  if(jurisdictionError)throw new Error(`public_jurisdiction_batch_read_failed:${jurisdictionError.message}`)
  const byId=new Map((jurisdictions??[]).map(row=>[row.id,row]))
  const domainHints=await loadOfficialDomainHints(client,ids)
  const missing=ids.filter(id=>!byId.has(id))
  if(missing.length)throw new Error(`public_source_discovery_missing_jurisdictions:${missing.join(',')}`)

  const results:Array<Awaited<ReturnType<typeof commissionOne>>>=[]
  for(const batch of chunks(jobs,concurrency)){
    const rows=await Promise.all(batch.map(job=>commissionOne({
      client,
      job,
      jurisdiction:byId.get(job.jurisdiction_id)!,
      fetchImpl:input.fetchImpl,
      now,
      queryBudget,
      officialDomains:domainHints.get(job.jurisdiction_id)??[],
      searchConfigured,
    })))
    results.push(...rows)
  }

  return {
    status:'PROCESSED' as const,
    processed:results.length,
    verifiedSources:results.reduce((sum,row)=>sum+row.verifiedSourceCount,0),
    retryableErrors:results.filter(row=>row.error).length,
    results,
    searchConfigured,
    dotGovBootstrap,
    dotGovAssisted:results.filter(row=>!row.error).length>0,
    automaticAdapterActivationAuthorized:false as const,
    externalContactAuthorized:false as const,
  }
}
