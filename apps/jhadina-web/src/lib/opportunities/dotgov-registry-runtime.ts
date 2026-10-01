import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DOTGOV_REGISTRY_CSV_URL,
  US_STATE_FIPS,
  matchDotGovDomainToJurisdiction,
  normalizeGovernmentOrganization,
  parseDotGovRegistryCsv,
  type DotGovJurisdictionMatchInput,
  type DotGovRegistryRecord,
  type PublicJurisdictionLevel,
  type UsStateOrDcCode,
} from '@jhadina/opportunity-core'

type JurisdictionRow={
  id:string
  level:PublicJurisdictionLevel
  state_code:UsStateOrDcCode
  name:string
  normalized_name:string
}

const chunks=<T>(values:T[],size:number)=>{
  const out:T[][]=[]
  for(let index=0;index<values.length;index+=size)out.push(values.slice(index,index+size))
  return out
}

async function fetchRegistryCsv(fetchImpl:typeof fetch){
  const response=await fetchImpl(DOTGOV_REGISTRY_CSV_URL,{
    headers:{accept:'text/csv,text/plain','user-agent':'Jhadina-DotGov-Registry/1.0'},
    cache:'no-store',
    signal:AbortSignal.timeout(30_000),
  })
  if(!response.ok)throw new Error(`DOTGOV_REGISTRY_HTTP_${response.status}`)
  return response.text()
}

async function loadJurisdictions(client:SupabaseClient):Promise<JurisdictionRow[]>{
  const out:JurisdictionRow[]=[]
  const pageSize=1000
  for(let from=0;;from+=pageSize){
    const {data,error}=await client
      .from('jhadina_public_jurisdictions')
      .select('id,level,state_code,name,normalized_name')
      .order('id',{ascending:true})
      .range(from,from+pageSize-1)
      .returns<JurisdictionRow[]>()
    if(error)throw new Error(`dotgov_jurisdiction_read_failed:${error.message}`)
    const rows=data??[]
    out.push(...rows)
    if(rows.length<pageSize)break
  }
  return out
}

function specialDistrictId(state:UsStateOrDcCode,normalized:string){
  const hash=createHash('sha256').update(`${state}\n${normalized}`).digest('hex').slice(0,20)
  return `special_district:dotgov:${state}:${hash}`
}

function registryKey(record:DotGovRegistryRecord){
  return record.state&&record.domainType==='special_district'
    ?`${record.state}:${normalizeGovernmentOrganization(record.organization)}`
    :undefined
}

async function upsertSpecialDistricts(
  client:SupabaseClient,
  records:DotGovRegistryRecord[],
  now:string,
):Promise<JurisdictionRow[]>{
  const grouped=new Map<string,DotGovRegistryRecord[]>()
  for(const record of records){
    const key=registryKey(record)
    if(!key||!record.state)continue
    const list=grouped.get(key)??[]
    list.push(record)
    grouped.set(key,list)
  }

  const rows=[...grouped.values()].flatMap(group=>{
    const first=group[0]
    if(!first?.state)return[]
    const normalized=normalizeGovernmentOrganization(first.organization)
    if(!normalized)return[]
    return [{
      id:specialDistrictId(first.state,normalized),
      level:'special_district' as const,
      state_code:first.state,
      state_fips:US_STATE_FIPS[first.state],
      county_geoid:null,
      jurisdiction_geoid:null,
      jurisdiction_subtype:'dotgov_special_district',
      name:first.organization,
      normalized_name:normalized,
      latitude:null,
      longitude:null,
      source_url:DOTGOV_REGISTRY_CSV_URL,
      source_payload:{
        source:'CISA .gov Registry',
        domains:group.map(record=>record.domain),
        rawDomainTypes:[...new Set(group.map(record=>record.rawDomainType))],
      },
      observed_at:now,
      updated_at:now,
    }]
  })

  for(const batch of chunks(rows,500)){
    const {error}=await client.from('jhadina_public_jurisdictions').upsert(batch,{onConflict:'id'})
    if(error)throw new Error(`dotgov_special_district_persist_failed:${error.message}`)
  }

  const jobs=rows.map(row=>({
    id:`discover:${row.id}`,
    jurisdiction_id:row.id,
    status:'pending',
    priority:35,
    target_kinds:['procurement','bids','awards','vendor_portal','capital_plan','board_agenda','public_works','cooperative_contracts'],
    source_refs:[],
    last_attempt_at:null,
    updated_at:now,
  }))
  for(const batch of chunks(jobs,500)){
    const {error}=await client.from('jhadina_public_source_discovery_jobs').upsert(batch,{onConflict:'id',ignoreDuplicates:true})
    if(error)throw new Error(`dotgov_special_district_job_persist_failed:${error.message}`)
  }

  return rows.map(row=>({
    id:row.id,
    level:row.level,
    state_code:row.state_code,
    name:row.name,
    normalized_name:row.normalized_name,
  }))
}

function buildCandidateIndex(jurisdictions:JurisdictionRow[]){
  const map=new Map<string,DotGovJurisdictionMatchInput[]>()
  for(const row of jurisdictions){
    const key=`${row.state_code}:${row.level}`
    const list=map.get(key)??[]
    list.push({
      id:row.id,
      level:row.level,
      state:row.state_code,
      name:row.name,
      normalizedName:row.normalized_name,
    })
    map.set(key,list)
  }
  return map
}

function levelForRegistryRecord(record:DotGovRegistryRecord):PublicJurisdictionLevel|undefined{
  if(record.domainType==='state')return'state'
  if(record.domainType==='county')return'county'
  if(record.domainType==='city')return'city'
  if(record.domainType==='school_district')return'school_district'
  if(record.domainType==='special_district')return'special_district'
  return undefined
}

export async function syncDotGovOfficialDomainRegistry(
  client:SupabaseClient,
  input:{fetchImpl?:typeof fetch;now?:string}={},
){
  const fetchImpl=input.fetchImpl??fetch
  const now=input.now??new Date().toISOString()
  const csv=await fetchRegistryCsv(fetchImpl)
  const records=parseDotGovRegistryCsv(csv)

  const existing=await loadJurisdictions(client)
  const special=await upsertSpecialDistricts(client,records,now)
  const jurisdictions=[...new Map([...existing,...special].map(row=>[row.id,row])).values()]
  const index=buildCandidateIndex(jurisdictions)

  let matched=0
  const rows=records.map(record=>{
    const level=levelForRegistryRecord(record)
    const candidates=record.state&&level?index.get(`${record.state}:${level}`)??[]:[]
    const match=matchDotGovDomainToJurisdiction(record,candidates)
    if(match)matched+=1
    return {
      domain:record.domain,
      raw_domain_type:record.rawDomainType,
      domain_type:record.domainType,
      organization_name:record.organization,
      suborganization_name:record.suborganization??null,
      city:record.city??null,
      state_code:record.state??null,
      matched_jurisdiction_id:match?.jurisdictionId??null,
      match_score:match?.score??null,
      match_reason:match?.reason??null,
      source_url:DOTGOV_REGISTRY_CSV_URL,
      observed_at:now,
      last_seen_at:now,
      updated_at:now,
    }
  })

  for(const batch of chunks(rows,500)){
    const {error}=await client.from('jhadina_public_official_domains').upsert(batch,{onConflict:'domain'})
    if(error)throw new Error(`dotgov_registry_persist_failed:${error.message}`)
  }

  return {
    status:'PASS' as const,
    observedAt:now,
    registryRows:records.length,
    matchedDomains:matched,
    unmatchedDomains:records.length-matched,
    specialDistrictJurisdictions:special.length,
    sourceUrl:DOTGOV_REGISTRY_CSV_URL,
    externalContactAuthorized:false as const,
  }
}

export async function loadOfficialDomainHints(
  client:SupabaseClient,
  jurisdictionIds:string[],
):Promise<Map<string,string[]>>{
  const out=new Map<string,string[]>()
  if(!jurisdictionIds.length)return out
  for(const batch of chunks([...new Set(jurisdictionIds)],250)){
    const {data,error}=await client
      .from('jhadina_public_official_domains')
      .select('domain,matched_jurisdiction_id,match_score')
      .in('matched_jurisdiction_id',batch)
      .gte('match_score',0.86)
      .order('match_score',{ascending:false})
    if(error)throw new Error(`dotgov_domain_hint_read_failed:${error.message}`)
    for(const row of data??[]){
      const id=String(row.matched_jurisdiction_id??'')
      const domain=String(row.domain??'')
      if(!id||!domain)continue
      const list=out.get(id)??[]
      if(!list.includes(domain))list.push(domain)
      out.set(id,list)
    }
  }
  return out
}
