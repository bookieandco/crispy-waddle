import { inflateRawSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CALIFORNIA_REFERENCE_SOURCES,
  US_STATE_FIPS,
  US_STATE_NAMES,
  assessNationalCountyCatalog,
  buildCensusCountyGazetteerZipUrl,
  buildCensusPlaceGazetteerZipUrl,
  buildCensusSchoolDistrictGazetteerZipUrl,
  parseCensusCountyGazetteer,
  parseCensusPlaceGazetteer,
  parseCensusSchoolDistrictGazetteer,
  type CensusSchoolDistrictKind,
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

async function fetchBytes(fetchImpl:typeof fetch,url:string):Promise<Buffer>{
  const response=await fetchImpl(url,{
    headers:{accept:'application/zip,application/octet-stream','user-agent':'Jhadina-Public-Jurisdiction-Refresh/1.0'},
    cache:'no-store',
    signal:AbortSignal.timeout(30_000),
  })
  if(!response.ok)throw new Error(`public_jurisdiction_zip_http_${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

function extractFirstZipText(buffer:Buffer):string{
  const EOCD=0x06054b50
  const CENTRAL=0x02014b50
  const LOCAL=0x04034b50
  let eocd=-1
  const floor=Math.max(0,buffer.length-65_557)
  for(let offset=buffer.length-22;offset>=floor;offset-=1){
    if(buffer.readUInt32LE(offset)===EOCD){eocd=offset;break}
  }
  if(eocd<0)throw new Error('public_jurisdiction_zip_eocd_missing')
  const entries=buffer.readUInt16LE(eocd+10)
  let cursor=buffer.readUInt32LE(eocd+16)
  for(let index=0;index<entries;index+=1){
    if(buffer.readUInt32LE(cursor)!==CENTRAL)throw new Error('public_jurisdiction_zip_central_directory_invalid')
    const method=buffer.readUInt16LE(cursor+10)
    const compressedSize=buffer.readUInt32LE(cursor+20)
    const fileNameLength=buffer.readUInt16LE(cursor+28)
    const extraLength=buffer.readUInt16LE(cursor+30)
    const commentLength=buffer.readUInt16LE(cursor+32)
    const localOffset=buffer.readUInt32LE(cursor+42)
    const fileName=buffer.subarray(cursor+46,cursor+46+fileNameLength).toString('utf8')
    cursor+=46+fileNameLength+extraLength+commentLength
    if(fileName.endsWith('/'))continue
    if(buffer.readUInt32LE(localOffset)!==LOCAL)throw new Error('public_jurisdiction_zip_local_header_invalid')
    const localNameLength=buffer.readUInt16LE(localOffset+26)
    const localExtraLength=buffer.readUInt16LE(localOffset+28)
    const dataStart=localOffset+30+localNameLength+localExtraLength
    const compressed=buffer.subarray(dataStart,dataStart+compressedSize)
    if(method===0)return compressed.toString('utf8')
    if(method===8)return inflateRawSync(compressed).toString('utf8')
    throw new Error(`public_jurisdiction_zip_unsupported_method_${method}`)
  }
  throw new Error('public_jurisdiction_zip_no_file')
}

export async function refreshNationalPublicJurisdictions(
  client:SupabaseClient,
  input:{fetchImpl?:typeof fetch;now?:string;concurrency?:number}={},
){
  const fetchImpl=input.fetchImpl??fetch
  const now=input.now??new Date().toISOString()
  const states=Object.keys(US_STATE_FIPS) as UsStateOrDcCode[]
  const countyUrl=buildCensusCountyGazetteerZipUrl()
  const placeUrl=buildCensusPlaceGazetteerZipUrl()
  const [countyArchive,placeArchive]=await Promise.all([
    fetchBytes(fetchImpl,countyUrl),
    fetchBytes(fetchImpl,placeUrl),
  ])
  const countyRecords=parseCensusCountyGazetteer(extractFirstZipText(countyArchive),undefined,countyUrl)
  const placeRecords=parseCensusPlaceGazetteer(extractFirstZipText(placeArchive),undefined,placeUrl)
    .filter(record=>record.governmental)

  const assessment=assessNationalCountyCatalog(countyRecords)
  if(assessment.status!=='PASS')throw new Error(`public_jurisdiction_catalog_blocked:${assessment.blockers.join('|')}`)

  const schoolKinds:CensusSchoolDistrictKind[]=['elementary','secondary','unified','administrative']
  const schoolResults=await Promise.all(schoolKinds.map(async kind=>{
    const url=buildCensusSchoolDistrictGazetteerZipUrl(kind)
    const archive=await fetchBytes(fetchImpl,url)
    return parseCensusSchoolDistrictGazetteer(extractFirstZipText(archive),kind,url)
  }))
  const schoolRecords=schoolResults.flat()

  const stateRows=states.map(state=>({
    id:`state:${state}`,
    level:'state',
    state_code:state,
    state_fips:US_STATE_FIPS[state],
    county_geoid:null,
    jurisdiction_geoid:US_STATE_FIPS[state],
    jurisdiction_subtype:'state',
    name:US_STATE_NAMES[state],
    normalized_name:US_STATE_NAMES[state],
    latitude:null,
    longitude:null,
    source_url:countyUrl,
    source_payload:{source:'US Census Bureau 2026 Gazetteer',state},
    observed_at:now,
    updated_at:now,
  }))
  const countyRows=countyRecords.map(record=>({
    id:`county:${record.geoid}`,
    level:'county',
    state_code:record.state,
    state_fips:record.stateFips,
    county_geoid:record.geoid,
    jurisdiction_geoid:record.geoid,
    jurisdiction_subtype:'county_equivalent',
    name:record.name,
    normalized_name:record.normalizedName,
    latitude:record.latitude,
    longitude:record.longitude,
    source_url:record.sourceUrl,
    source_payload:record,
    observed_at:now,
    updated_at:now,
  }))
  const cityRows=placeRecords.map(record=>({
    id:`city:${record.geoid}`,
    level:'city',
    state_code:record.state,
    state_fips:record.stateFips,
    county_geoid:null,
    jurisdiction_geoid:record.geoid,
    jurisdiction_subtype:record.lsad||'incorporated_place',
    name:record.name,
    normalized_name:record.normalizedName,
    latitude:record.latitude,
    longitude:record.longitude,
    source_url:record.sourceUrl,
    source_payload:record,
    observed_at:now,
    updated_at:now,
  }))
  const schoolRows=schoolRecords.map(record=>({
    id:`school_district:${record.kind}:${record.geoid}`,
    level:'school_district',
    state_code:record.state,
    state_fips:US_STATE_FIPS[record.state],
    county_geoid:null,
    jurisdiction_geoid:record.geoid,
    jurisdiction_subtype:record.kind,
    name:record.name,
    normalized_name:record.normalizedName,
    latitude:record.latitude,
    longitude:record.longitude,
    source_url:record.sourceUrl,
    source_payload:record,
    observed_at:now,
    updated_at:now,
  }))
  const jurisdictionRows=[...stateRows,...countyRows,...cityRows,...schoolRows]
  for(const batch of chunks(jurisdictionRows,500)){
    const {error}=await client.from('jhadina_public_jurisdictions').upsert(batch,{onConflict:'id'})
    if(error)throw new Error(`public_jurisdiction_persist_failed:${error.message}`)
  }

  const priority=(level:string)=>level==='state'?10:level==='school_district'?20:level==='city'?25:level==='county'?30:50
  const discoveryJobs=jurisdictionRows.map(row=>({
    id:`discover:${row.id}`,
    jurisdiction_id:row.id,
    state_code:row.state_code,
    status:'pending',
    priority:priority(row.level),
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
    municipalityCount:cityRows.length,
    schoolDistrictCount:schoolRows.length,
    jurisdictionCount:jurisdictionRows.length,
    sourceDiscoveryJobCount:discoveryJobs.length,
    unhydratedJurisdictionFamilies:['special_district','authority','public_university','public_hospital'] as const,
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
