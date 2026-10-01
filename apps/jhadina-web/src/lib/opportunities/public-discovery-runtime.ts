import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CALIFORNIA_REFERENCE_SOURCES,
  US_STATE_FIPS,
  assessNationalCountyCatalog,
  buildCensusCountyGazetteerUrl,
  parseCensusCountyGazetteer,
  type PublicSourceCheckpoint,
  type PublicSourceHealth,
  type UsStateOrDcCode,
} from '@jhadina/opportunity-core'
import {
  LA_COUNTY_MASTER_AGREEMENT_SOURCE_ID,
  scanLosAngelesCountyMasterAgreements,
} from './public-source-adapters'

type PublicSourceStateRow={
  source_id:string
  status:PublicSourceHealth['status']
  checkpoint:PublicSourceCheckpoint
  health:PublicSourceHealth
  last_success_at:string|null
  last_error_at:string|null
  consecutive_failures:number
  observations:number
  last_run_at:string
}

const DISCOVERY_TARGET_KINDS=[
  'procurement','bids','awards','vendor_portal','capital_plan','board_agenda','public_works','cooperative_contracts',
] as const

function digest(value:unknown):string{
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function chunks<T>(values:T[],size:number):T[][]{
  const out:T[][]=[]
  for(let i=0;i<values.length;i+=size)out.push(values.slice(i,i+size))
  return out
}

async function fetchText(fetchImpl:typeof fetch,url:string):Promise<string>{
  const response=await fetchImpl(url,{
    headers:{accept:'text/plain','user-agent':'Jhadina-Public-Jurisdiction-Refresh/1.0'},
    cache:'no-store',
    signal:AbortSignal.timeout(30_000),
  })
  if(!response.ok)throw new Error(`public_jurisdiction_http_${response.status}`)
  return response.text()
}

export async function refreshNationalPublicJurisdictions(
  client:SupabaseClient,
  input:{fetchImpl?:typeof fetch;now?:string;concurrency?:number}={},
){
  const fetchImpl=input.fetchImpl??fetch
  const now=input.now??new Date().toISOString()
  const concurrency=Math.max(1,Math.min(input.concurrency??8,12))
  const states=Object.keys(US_STATE_FIPS) as UsStateOrDcCode[]
  const allRecords:ReturnType<typeof parseCensusCountyGazetteer>=[]
  for(const batch of chunks(states,concurrency)){
    const results=await Promise.all(batch.map(async state=>{
      const url=buildCensusCountyGazetteerUrl(state)
      const text=await fetchText(fetchImpl,url)
      return parseCensusCountyGazetteer(text,state,url)
    }))
    allRecords.push(...results.flat())
  }

  const assessment=assessNationalCountyCatalog(allRecords)
  if(assessment.status!=='PASS')throw new Error(`public_jurisdiction_catalog_blocked:${assessment.blockers.join('|')}`)

  const stateRows=states.map(state=>({
    id:`state:${state}`,
    level:'state',
    state_code:state,
    state_fips:US_STATE_FIPS[state],
    county_geoid:null,
    name:state,
    normalized_name:state,
    latitude:null,
    longitude:null,
    source_url:buildCensusCountyGazetteerUrl(state),
    source_payload:{source:'US Census Bureau 2026 Gazetteer',state},
    observed_at:now,
    updated_at:now,
  }))
  const countyRows=allRecords.map(record=>({
    id:`county:${record.geoid}`,
    level:'county',
    state_code:record.state,
    state_fips:record.stateFips,
    county_geoid:record.geoid,
    name:record.name,
    normalized_name:record.normalizedName,
    latitude:record.latitude,
    longitude:record.longitude,
    source_url:record.sourceUrl,
    source_payload:record,
    observed_at:now,
    updated_at:now,
  }))
  const jurisdictionRows=[...stateRows,...countyRows]
  for(const batch of chunks(jurisdictionRows,500)){
    const {error}=await client.from('jhadina_public_jurisdictions').upsert(batch,{onConflict:'id'})
    if(error)throw new Error(`public_jurisdiction_persist_failed:${error.message}`)
  }

  const discoveryJobs=jurisdictionRows.map(row=>({
    id:`discover:${row.id}`,
    jurisdiction_id:row.id,
    status:'pending',
    target_kinds:[...DISCOVERY_TARGET_KINDS],
    source_refs:[],
    last_attempt_at:null,
    updated_at:now,
  }))
  for(const batch of chunks(discoveryJobs,500)){
    const {error}=await client.from('jhadina_public_source_discovery_jobs').upsert(batch,{onConflict:'id',ignoreDuplicates:true})
    if(error)throw new Error(`public_source_discovery_job_persist_failed:${error.message}`)
  }

  return {
    status:'PASS' as const,
    refreshedAt:now,
    stateAndDcCount:states.length,
    countyEquivalentCount:assessment.countyEquivalentCount,
    jurisdictionCount:jurisdictionRows.length,
    sourceDiscoveryJobCount:discoveryJobs.length,
    automaticExternalContactAuthorized:false as const,
  }
}

async function loadSourceState(client:SupabaseClient,sourceId:string):Promise<PublicSourceStateRow|undefined>{
  const {data,error}=await client
    .from('jhadina_public_source_state')
    .select('*')
    .eq('source_id',sourceId)
    .maybeSingle<PublicSourceStateRow>()
  if(error)throw new Error(`public_source_state_read_failed:${error.message}`)
  return data??undefined
}

export async function scanLosAngelesCountyReferenceSource(
  client:SupabaseClient,
  input:{fetchImpl?:typeof fetch;now?:string}={},
){
  const now=input.now??new Date().toISOString()
  const source=CALIFORNIA_REFERENCE_SOURCES.find(row=>row.id===LA_COUNTY_MASTER_AGREEMENT_SOURCE_ID)
  if(!source)throw new Error('la_county_master_agreement_source_not_registered')
  const previous=await loadSourceState(client,source.id)

  const result=await scanLosAngelesCountyMasterAgreements({
    source,
    checkpoint:previous?.checkpoint,
    previousHealth:previous?.health,
    fetchImpl:input.fetchImpl,
    now,
  })

  if(result.signals.length){
    const rows=result.signals.map((signal,index)=>({
      id:signal.id,
      source_id:signal.sourceId,
      external_id:signal.externalId??null,
      state_code:signal.state,
      county_name:signal.county??null,
      locality:signal.locality??null,
      stage:signal.stage,
      title:signal.title,
      source_url:signal.sourceUrl,
      content_digest:digest(result.opportunities[index]??signal),
      payload:{
        signal,
        opportunity:result.opportunities[index],
        routeAuthority:{
          automaticDiscoveryAuthorized:true,
          externalContactAuthorized:false,
          bidSubmissionAuthorized:false,
        },
      },
      captured_at:signal.capturedAt,
      last_seen_at:now,
      active:true,
      updated_at:now,
    }))
    const {error}=await client.from('jhadina_public_opportunity_inbox').upsert(rows,{onConflict:'id'})
    if(error)throw new Error(`public_opportunity_inbox_persist_failed:${error.message}`)
  }

  const stateRow={
    source_id:source.id,
    status:result.health.status,
    checkpoint:result.checkpoint,
    health:result.health,
    last_success_at:result.health.lastSuccessAt??previous?.last_success_at??null,
    last_error_at:result.health.lastErrorAt??previous?.last_error_at??null,
    consecutive_failures:result.health.consecutiveFailures,
    observations:result.health.observations,
    last_run_at:now,
    updated_at:now,
  }
  const {error:stateError}=await client.from('jhadina_public_source_state').upsert(stateRow,{onConflict:'source_id'})
  if(stateError)throw new Error(`public_source_state_persist_failed:${stateError.message}`)

  return {
    sourceId:source.id,
    status:result.health.status,
    observations:result.signals.length,
    opportunityIds:result.opportunities.map(opportunity=>opportunity.id),
    checkpoint:result.checkpoint,
    automaticExternalContactAuthorized:false as const,
    bidSubmissionAuthorized:false as const,
  }
}
