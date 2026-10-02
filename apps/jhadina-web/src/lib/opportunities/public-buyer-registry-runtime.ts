import type { SupabaseClient } from '@supabase/supabase-js'
import {
  US_STATE_FIPS,
  parseCmsGovernmentHospitals,
  parseIpedsPublicInstitutions,
  parseGovernmentUnitsSpecialDistricts,
  probeGovernmentUnitsSchema,
  type PublicHospitalRegistryRecord,
  type PublicHigherEdRegistryRecord,
  type PublicSpecialDistrictRegistryRecord,
} from '@jhadina/opportunity-core'
import { extractZipTextEntries } from './public-registry-zip'

const CMS_DATASET_PAGE='https://data.cms.gov/provider-data/dataset/xubh-q36u'
const CMS_QUERY_BASE='https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0'
const CENSUS_GOV_UNITS='https://www2.census.gov/programs-surveys/gus/datasets/2026/gov_units_2026.zip'

const chunks=<T>(values:T[],size:number)=>{
  const out:T[][]=[]
  for(let i=0;i<values.length;i+=size)out.push(values.slice(i,i+size))
  return out
}

async function fetchJson(fetchImpl:typeof fetch,url:string){
  const response=await fetchImpl(url,{
    headers:{accept:'application/json','user-agent':'Jhadina-Public-Buyer-Registry/1.0'},
    cache:'no-store',
    signal:AbortSignal.timeout(30_000),
  })
  if(!response.ok)throw new Error(`public_registry_http_${response.status}:${url}`)
  return response.json()
}

async function fetchZip(fetchImpl:typeof fetch,url:string){
  const response=await fetchImpl(url,{
    headers:{accept:'application/zip,application/octet-stream','user-agent':'Jhadina-Public-Buyer-Registry/1.0'},
    cache:'no-store',
    signal:AbortSignal.timeout(45_000),
  })
  if(!response.ok)throw new Error(`public_registry_zip_http_${response.status}:${url}`)
  const buffer=Buffer.from(await response.arrayBuffer())
  if(buffer.length<4||buffer[0]!==0x50||buffer[1]!==0x4b)throw new Error(`public_registry_not_zip:${url}`)
  return buffer
}

async function fetchCmsGovernmentHospitals(fetchImpl:typeof fetch){
  const records:PublicHospitalRegistryRecord[]=[]
  const limit=1000
  for(let offset=0;offset<10_000;offset+=limit){
    const url=new URL(CMS_QUERY_BASE)
    url.searchParams.set('limit',String(limit))
    url.searchParams.set('offset',String(offset))
    const payload=await fetchJson(fetchImpl,url.toString())
    const page=parseCmsGovernmentHospitals(payload,CMS_DATASET_PAGE)
    records.push(...page)
    const rawResults=payload&&typeof payload==='object'&&Array.isArray((payload as {results?:unknown}).results)
      ?(payload as {results:unknown[]}).results
      :[]
    if(rawResults.length<limit)break
  }
  return records
}

async function fetchLatestIpedsPublicInstitutions(fetchImpl:typeof fetch){
  const years=[2025,2024]
  const errors:string[]=[]
  for(const year of years){
    const url=`https://nces.ed.gov/ipeds/datacenter/data/HD${year}.zip`
    try{
      const archive=await fetchZip(fetchImpl,url)
      const entries=extractZipTextEntries(archive)
      const entry=entries.find(item=>new RegExp(`(^|/)HD${year}\\.csv$`,'i').test(item.name))
        ??entries.find(item=>/\.csv$/i.test(item.name))
      if(!entry)throw new Error(`ipeds_hd_csv_missing:${year}`)
      const records=parseIpedsPublicInstitutions(entry.text,url)
      if(records.length<100)throw new Error(`ipeds_public_institution_count_implausible:${records.length}`)
      return {year,url,entryName:entry.name,records}
    }catch(error){
      errors.push(error instanceof Error?error.message:`ipeds_${year}_unknown_failure`)
    }
  }
  throw new Error(`ipeds_directory_unavailable:${errors.join('|')}`)
}

async function probeCensusGovernmentUnits(fetchImpl:typeof fetch){
  const archive=await fetchZip(fetchImpl,CENSUS_GOV_UNITS)
  const entries=extractZipTextEntries(archive)
  const candidate=entries.find(entry=>/\.(csv|txt)$/i.test(entry.name))
  if(!candidate)throw new Error('census_government_units_text_entry_missing')
  return {
    entryName:candidate.name,
    probe:probeGovernmentUnitsSchema(candidate.text),
    records:parseGovernmentUnitsSpecialDistricts(candidate.text,CENSUS_GOV_UNITS),
  }
}

function hospitalRow(record:PublicHospitalRegistryRecord,now:string){
  return {
    id:`public_hospital:cms:${record.facilityId}`,
    level:'public_hospital',
    state_code:record.state,
    state_fips:US_STATE_FIPS[record.state],
    county_geoid:null,
    jurisdiction_geoid:record.facilityId,
    jurisdiction_subtype:record.ownership,
    name:record.name,
    normalized_name:record.name,
    latitude:null,
    longitude:null,
    official_domain_hints:record.officialDomainHints,
    source_url:record.sourceUrl,
    source_payload:record,
    observed_at:now,
    updated_at:now,
  }
}

function higherEdRow(record:PublicHigherEdRegistryRecord,now:string){
  return {
    id:`public_university:ipeds:${record.unitId}`,
    level:'public_university',
    state_code:record.state,
    state_fips:US_STATE_FIPS[record.state],
    county_geoid:null,
    jurisdiction_geoid:record.unitId,
    jurisdiction_subtype:'ipeds_public_postsecondary',
    name:record.name,
    normalized_name:record.name,
    latitude:record.latitude??null,
    longitude:record.longitude??null,
    official_domain_hints:record.officialDomainHints,
    source_url:record.sourceUrl,
    source_payload:record,
    observed_at:now,
    updated_at:now,
  }
}

function specialDistrictRow(record:PublicSpecialDistrictRegistryRecord,now:string){
  return {
    id:`special_district:census:${record.governmentId}`,
    level:'special_district',
    state_code:record.state,
    state_fips:US_STATE_FIPS[record.state],
    county_geoid:null,
    jurisdiction_geoid:record.governmentId,
    jurisdiction_subtype:record.function?`census_special_district:${record.function}`:'census_special_district',
    name:record.name,
    normalized_name:record.name,
    latitude:null,
    longitude:null,
    official_domain_hints:[],
    source_url:record.sourceUrl,
    source_payload:record,
    observed_at:now,
    updated_at:now,
  }
}

async function persistJurisdictions(
  client:SupabaseClient,
  rows:Array<ReturnType<typeof hospitalRow>|ReturnType<typeof higherEdRow>|ReturnType<typeof specialDistrictRow>>,
  now:string,
){
  for(const batch of chunks(rows,500)){
    const {error}=await client.from('jhadina_public_jurisdictions').upsert(batch,{onConflict:'id'})
    if(error)throw new Error(`public_buyer_registry_jurisdiction_persist_failed:${error.message}`)
  }
  const jobs=rows.map(row=>({
    id:`discover:${row.id}`,
    jurisdiction_id:row.id,
    state_code:row.state_code,
    status:'pending',
    priority:row.level==='special_district'?35:40,
    target_kinds:[
      'solicitation','award','capital_plan','board_agenda','budget',
      'vendor_portal','public_works_project',
    ],
    source_refs:[],
    last_attempt_at:null,
    updated_at:now,
  }))
  for(const batch of chunks(jobs,500)){
    const {error}=await client.from('jhadina_public_source_discovery_jobs').upsert(batch,{onConflict:'id',ignoreDuplicates:true})
    if(error)throw new Error(`public_buyer_registry_discovery_job_persist_failed:${error.message}`)
  }
  return jobs.length
}

async function persistRegistryState(
  client:SupabaseClient,
  input:{
    registryId:string
    status:'healthy'|'degraded'|'failed'|'fixture_review_required'|'disabled'
    sourceUrl:string
    checkpoint:Record<string,unknown>
    health:Record<string,unknown>
    now:string
    error?:string
  },
){
  const {error}=await client.from('jhadina_public_buyer_registry_state').upsert({
    registry_id:input.registryId,
    status:input.status,
    source_url:input.sourceUrl,
    checkpoint:input.checkpoint,
    health:input.health,
    last_success_at:['healthy','fixture_review_required'].includes(input.status)?input.now:null,
    last_error_at:input.error?input.now:null,
    last_error:input.error??null,
    last_run_at:input.now,
    updated_at:input.now,
  },{onConflict:'registry_id'})
  if(error)throw new Error(`public_buyer_registry_state_persist_failed:${error.message}`)
}

export async function refreshRemainingPublicBuyerRegistries(
  client:SupabaseClient,
  input:{fetchImpl?:typeof fetch;now?:string}={},
){
  const fetchImpl=input.fetchImpl??fetch
  const now=input.now??new Date().toISOString()
  const results:{
    cmsHospitals?:number
    ipedsPublicInstitutions?:number
    ipedsYear?:number
    censusGovernmentUnitsSchema?:ReturnType<typeof probeGovernmentUnitsSchema>
    censusSpecialDistricts?:number
  }={}
  const errors:string[]=[]

  try{
    const hospitals=await fetchCmsGovernmentHospitals(fetchImpl)
    const rows=hospitals.map(record=>hospitalRow(record,now))
    await persistJurisdictions(client,rows,now)
    results.cmsHospitals=rows.length
    await persistRegistryState(client,{
      registryId:'cms-hospital-general-information',
      status:rows.length?'healthy':'degraded',
      sourceUrl:CMS_DATASET_PAGE,
      checkpoint:{dataset:'xubh-q36u',records:rows.length},
      health:{governmentOwnedHospitals:rows.length},
      now,
      ...(rows.length?{}:{error:'cms_government_hospital_count_zero'}),
    })
  }catch(error){
    const message=error instanceof Error?error.message:'cms_hospital_registry_failed'
    errors.push(message)
    await persistRegistryState(client,{
      registryId:'cms-hospital-general-information',
      status:'failed',
      sourceUrl:CMS_DATASET_PAGE,
      checkpoint:{},
      health:{},
      now,
      error:message,
    })
  }

  try{
    const ipeds=await fetchLatestIpedsPublicInstitutions(fetchImpl)
    const rows=ipeds.records.map(record=>higherEdRow(record,now))
    await persistJurisdictions(client,rows,now)
    results.ipedsPublicInstitutions=rows.length
    results.ipedsYear=ipeds.year
    await persistRegistryState(client,{
      registryId:'nces-ipeds-directory',
      status:'healthy',
      sourceUrl:ipeds.url,
      checkpoint:{year:ipeds.year,entry:ipeds.entryName,records:rows.length},
      health:{publicInstitutions:rows.length},
      now,
    })
  }catch(error){
    const message=error instanceof Error?error.message:'ipeds_public_registry_failed'
    errors.push(message)
    await persistRegistryState(client,{
      registryId:'nces-ipeds-directory',
      status:'failed',
      sourceUrl:'https://nces.ed.gov/ipeds/datacenter/',
      checkpoint:{},
      health:{},
      now,
      error:message,
    })
  }

  try{
    const census=await probeCensusGovernmentUnits(fetchImpl)
    results.censusGovernmentUnitsSchema=census.probe
    const canHydrate=census.probe.status==='READY_FOR_FIXTURE_REVIEW'&&census.records.length>=100
    if(canHydrate){
      const rows=census.records.map(record=>specialDistrictRow(record,now))
      await persistJurisdictions(client,rows,now)
      results.censusSpecialDistricts=rows.length
    }
    await persistRegistryState(client,{
      registryId:'census-2026-government-units',
      status:canHydrate?'healthy':'fixture_review_required',
      sourceUrl:CENSUS_GOV_UNITS,
      checkpoint:{
        entry:census.entryName,
        headers:census.probe.headers,
        recognized:census.probe.recognized,
        specialDistricts:census.records.length,
      },
      health:{
        schemaStatus:census.probe.status,
        blockers:census.probe.blockers,
        specialDistricts:census.records.length,
        hydrationAuthorized:canHydrate,
      },
      now,
      ...(canHydrate?{}:{error:'census_special_district_schema_or_count_not_admitted'}),
    })
  }catch(error){
    const message=error instanceof Error?error.message:'census_government_units_probe_failed'
    errors.push(message)
    await persistRegistryState(client,{
      registryId:'census-2026-government-units',
      status:'failed',
      sourceUrl:CENSUS_GOV_UNITS,
      checkpoint:{},
      health:{},
      now,
      error:message,
    })
  }

  return {
    status:errors.length?'PARTIAL':'PASS',
    refreshedAt:now,
    ...results,
    errors,
    specialDistrictHydrationAuthorized:Boolean(results.censusSpecialDistricts),
    authorityHydrationAuthorized:false as const,
    externalContactAuthorized:false as const,
  }
}
