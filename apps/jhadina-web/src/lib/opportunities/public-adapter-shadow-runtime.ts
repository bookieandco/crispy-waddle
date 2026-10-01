import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  certifyPublicAdapter,
  planPublicAdapterCommissioning,
  type PublicAdapterTrial,
  type PublicProcurementSourceCandidate,
  type UsStateOrDcCode,
} from '@jhadina/opportunity-core'
import {
  parseGenericHtmlOpportunityTable,
  parseGenericJsonOpportunityCollection,
  parseGenericRssAtomFeed,
  type GenericAdapterParseResult,
  type GenericPublicSourceDescriptor,
} from './public-generic-adapters'

type SourceRow={
  id:string
  jurisdiction_id:string
  source_name:string
  source_url:string
  source_kinds:string[]
  adapter_kind:string
  discovery_provider:string
  verification_status:PublicProcurementSourceCandidate['status']
  official_owner_url:string|null
  confidence:number
  evidence_refs:string[]
  blockers:string[]
  adapter_status:'adapter_required'|'active'|'degraded'|'disabled'
  adapter_key:string|null
  adapter_version:string|null
  access_review_status:'pending'|'approved_public_official'|'approved_platform'|'blocked'
  last_adapter_trial_at:string|null
}

type JurisdictionRow={
  id:string
  level:'state'|'county'
  state_code:UsStateOrDcCode
  name:string
  normalized_name:string
}

const ADAPTER_VERSION='1.0.0'

function digest(value:string):string{
  return createHash('sha256').update(value).digest('hex')
}

function safeUrl(raw:string):URL|undefined{
  try{
    const u=new URL(raw)
    if(!['http:','https:'].includes(u.protocol))return undefined
    const host=u.hostname.toLowerCase()
    if(['localhost','127.0.0.1','0.0.0.0','::1'].includes(host))return undefined
    return u
  }catch{return undefined}
}

function robotsAllows(robots:string,path:string,userAgent='Jhadina-Public-Opportunity-Discovery'):boolean{
  const lines=robots.split(/\r?\n/).map(line=>line.replace(/#.*/,'').trim()).filter(Boolean)
  let active=false
  const disallows:string[]=[]
  for(const line of lines){
    const [rawKey,...rawValue]=line.split(':')
    const key=(rawKey??'').trim().toLowerCase()
    const value=rawValue.join(':').trim()
    if(key==='user-agent'){
      active=value==='*'||value.toLowerCase()===userAgent.toLowerCase()
      continue
    }
    if(active&&key==='disallow'&&value)disallows.push(value)
    if(active&&key==='allow'&&value&&path.startsWith(value))return true
  }
  return !disallows.some(rule=>rule==='/'||path.startsWith(rule))
}

async function publicOfficialAccessReview(url:string,fetchImpl:typeof fetch){
  const parsed=safeUrl(url)
  if(!parsed)return {approved:false,reason:'invalid_source_url'}
  if(!parsed.hostname.toLowerCase().endsWith('.gov'))return {approved:false,reason:'not_native_government_domain'}
  const robotsUrl=new URL('/robots.txt',parsed.origin)
  try{
    const response=await fetchImpl(robotsUrl,{
      headers:{accept:'text/plain','user-agent':'Jhadina-Public-Opportunity-Discovery/1.0'},
      cache:'no-store',
      signal:AbortSignal.timeout(10_000),
    })
    if(response.status===404)return {approved:true,reason:'official_public_page_robots_absent'}
    if(!response.ok)return {approved:false,reason:`robots_http_${response.status}`}
    const robots=await response.text()
    return robotsAllows(robots,parsed.pathname)
      ?{approved:true,reason:'official_public_page_robots_allowed'}
      :{approved:false,reason:'robots_disallow'}
  }catch{
    return {approved:false,reason:'robots_review_failed'}
  }
}

function adapterKeyFor(source:SourceRow):string|undefined{
  const candidate={
    sourceUrl:source.source_url,
    adapterKind:source.adapter_kind as PublicProcurementSourceCandidate['adapterKind'],
    status:source.verification_status,
    evidenceRefs:source.evidence_refs,
    blockers:source.blockers,
  }
  const plan=planPublicAdapterCommissioning(candidate)
  if(plan.status!=='SHADOW_READY')return undefined
  if(plan.templateKind==='generic_html_table')return'generic-html-table-v1'
  if(plan.templateKind==='generic_rss_atom')return'generic-rss-atom-v1'
  if(plan.templateKind==='generic_json_collection')return'generic-json-collection-v1'
  return undefined
}

async function fetchAndParse(input:{
  source:SourceRow
  jurisdiction:JurisdictionRow
  adapterKey:string
  fetchImpl:typeof fetch
  now:string
}):Promise<{httpStatus:number;body:string;contentType:string;parsed?:GenericAdapterParseResult;errorCode?:string}>{
  const response=await input.fetchImpl(input.source.source_url,{
    headers:{
      accept:input.adapterKey==='generic-json-collection-v1'?'application/json,text/json;q=0.9,*/*;q=0.1':
        input.adapterKey==='generic-rss-atom-v1'?'application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.1':
        'text/html,*/*;q=0.1',
      'user-agent':'Jhadina-Public-Opportunity-Discovery/1.0',
    },
    cache:'no-store',
    redirect:'follow',
    signal:AbortSignal.timeout(30_000),
  })
  const body=await response.text()
  const contentType=response.headers.get('content-type')??''
  if(!response.ok)return {httpStatus:response.status,body,contentType,errorCode:`source_http_${response.status}`}

  const descriptor:GenericPublicSourceDescriptor={
    sourceId:input.source.id,
    sourceName:input.source.source_name,
    sourceUrl:input.source.source_url,
    state:input.jurisdiction.state_code,
    county:input.jurisdiction.level==='county'?input.jurisdiction.normalized_name:undefined,
    buyer:input.jurisdiction.name,
  }
  try{
    if(input.adapterKey==='generic-html-table-v1'){
      return {httpStatus:response.status,body,contentType,parsed:parseGenericHtmlOpportunityTable(body,descriptor,input.now)}
    }
    if(input.adapterKey==='generic-rss-atom-v1'){
      return {httpStatus:response.status,body,contentType,parsed:parseGenericRssAtomFeed(body,descriptor,input.now)}
    }
    if(input.adapterKey==='generic-json-collection-v1'){
      let payload:unknown
      try{payload=JSON.parse(body)}catch{return {httpStatus:response.status,body,contentType,errorCode:'invalid_json'}}
      return {httpStatus:response.status,body,contentType,parsed:parseGenericJsonOpportunityCollection(payload,descriptor,input.now)}
    }
    return {httpStatus:response.status,body,contentType,errorCode:'unsupported_generic_adapter'}
  }catch(error){
    return {httpStatus:response.status,body,contentType,errorCode:error instanceof Error?error.message:'adapter_parse_failed'}
  }
}

function trialId(sourceId:string,adapterKey:string,now:string){
  return `adapter-trial:${createHash('sha256').update(`${sourceId}\n${adapterKey}\n${now}`).digest('hex').slice(0,32)}`
}

async function persistTrial(client:SupabaseClient,trial:PublicAdapterTrial,payload:unknown){
  const {error}=await client.from('jhadina_public_adapter_trials').upsert({
    id:trial.id,
    source_id:trial.sourceId,
    adapter_key:trial.adapterKey,
    adapter_version:trial.adapterVersion,
    observed_at:trial.observedAt,
    source_digest:trial.sourceDigest,
    http_status:trial.httpStatus,
    parse_succeeded:trial.parseSucceeded,
    observation_count:trial.observationCount,
    stable_external_id_count:trial.stableExternalIdCount,
    duplicate_external_id_count:trial.duplicateExternalIdCount,
    provenance_complete:trial.provenanceComplete,
    access_review_approved:trial.accessReviewApproved,
    error_code:trial.errorCode??null,
    evidence_refs:trial.evidenceRefs,
    payload,
  },{onConflict:'id'})
  if(error)throw new Error(`public_adapter_trial_persist_failed:${error.message}`)
}

async function loadTrials(client:SupabaseClient,sourceId:string,adapterKey:string):Promise<PublicAdapterTrial[]>{
  const {data,error}=await client
    .from('jhadina_public_adapter_trials')
    .select('id,source_id,adapter_key,adapter_version,observed_at,source_digest,http_status,parse_succeeded,observation_count,stable_external_id_count,duplicate_external_id_count,provenance_complete,access_review_approved,error_code,evidence_refs')
    .eq('source_id',sourceId)
    .eq('adapter_key',adapterKey)
    .eq('adapter_version',ADAPTER_VERSION)
    .order('observed_at',{ascending:true})
    .limit(10)
  if(error)throw new Error(`public_adapter_trials_read_failed:${error.message}`)
  return (data??[]).map((row:any)=>({
    id:row.id,
    sourceId:row.source_id,
    adapterKey:row.adapter_key,
    adapterVersion:row.adapter_version,
    observedAt:row.observed_at,
    sourceDigest:row.source_digest,
    httpStatus:row.http_status,
    parseSucceeded:row.parse_succeeded,
    observationCount:row.observation_count,
    stableExternalIdCount:row.stable_external_id_count,
    duplicateExternalIdCount:row.duplicate_external_id_count,
    provenanceComplete:row.provenance_complete,
    accessReviewApproved:row.access_review_approved,
    errorCode:row.error_code??undefined,
    evidenceRefs:row.evidence_refs??[],
  }))
}

async function persistCertification(client:SupabaseClient,certification:ReturnType<typeof certifyPublicAdapter>,now:string){
  const {error}=await client.from('jhadina_public_adapter_certifications').upsert({
    source_id:certification.sourceId,
    adapter_key:certification.adapterKey,
    adapter_version:certification.adapterVersion,
    status:certification.status,
    trial_count:certification.trialCount,
    successful_trials:certification.successfulTrials,
    observation_count:certification.observationCount,
    stable_external_id_coverage:certification.stableExternalIdCoverage,
    blockers:certification.blockers,
    evidence_refs:certification.evidenceRefs,
    certified_at:certification.status==='ACTIVE_READ_ONLY'?now:null,
    updated_at:now,
  },{onConflict:'source_id'})
  if(error)throw new Error(`public_adapter_certification_persist_failed:${error.message}`)
}

async function persistActiveSignals(client:SupabaseClient,source:SourceRow,result:GenericAdapterParseResult,now:string){
  if(!result.signals.length)return
  const rows=result.signals.map(signal=>({
    id:signal.id,
    source_id:signal.sourceId,
    external_id:signal.externalId??null,
    state_code:signal.state,
    county_name:signal.county??null,
    locality:signal.locality??null,
    stage:signal.stage,
    title:signal.title,
    source_url:signal.sourceUrl,
    content_digest:digest(JSON.stringify(signal)),
    payload:{
      signal,
      routeAuthority:{
        automaticDiscoveryAuthorized:true,
        externalContactAuthorized:false,
        bidSubmissionAuthorized:false,
      },
      certifiedAdapter:{key:source.adapter_key,version:source.adapter_version},
    },
    captured_at:signal.capturedAt,
    last_seen_at:now,
    active:true,
    updated_at:now,
  }))
  const {error}=await client.from('jhadina_public_opportunity_inbox').upsert(rows,{onConflict:'id'})
  if(error)throw new Error(`public_generic_opportunity_inbox_persist_failed:${error.message}`)
}

async function runSourceTrial(input:{
  client:SupabaseClient
  source:SourceRow
  jurisdiction:JurisdictionRow
  fetchImpl:typeof fetch
  now:string
}){
  const adapterKey=adapterKeyFor(input.source)
  if(!adapterKey)return {sourceId:input.source.id,status:'NOT_GENERIC' as const,observations:0}

  let accessApproved=input.source.access_review_status==='approved_public_official'||input.source.access_review_status==='approved_platform'
  let accessReason=input.source.access_review_status
  if(!accessApproved&&input.source.access_review_status!=='blocked'){
    const review=await publicOfficialAccessReview(input.source.source_url,input.fetchImpl)
    accessApproved=review.approved
    accessReason=review.reason
    const nextStatus=review.approved?'approved_public_official':review.reason==='robots_disallow'?'blocked':'pending'
    const {error}=await input.client.from('jhadina_public_procurement_sources').update({
      access_review_status:nextStatus,
      access_reviewed_at:input.now,
      updated_at:input.now,
    }).eq('id',input.source.id)
    if(error)throw new Error(`public_source_access_review_update_failed:${error.message}`)
  }

  if(!accessApproved){
    return {sourceId:input.source.id,status:'ACCESS_BLOCKED' as const,observations:0,reason:accessReason}
  }

  const fetched=await fetchAndParse({...input,adapterKey})
  const parsed=fetched.parsed
  const provenanceComplete=Boolean(parsed&&parsed.signals.every(signal=>
    signal.sourceId===input.source.id&&Boolean(signal.sourceUrl)&&Boolean(signal.evidenceRef)
  ))
  const trial:PublicAdapterTrial={
    id:trialId(input.source.id,adapterKey,input.now),
    sourceId:input.source.id,
    adapterKey,
    adapterVersion:ADAPTER_VERSION,
    observedAt:input.now,
    sourceDigest:digest(fetched.body),
    httpStatus:fetched.httpStatus,
    parseSucceeded:Boolean(parsed)&&!fetched.errorCode,
    observationCount:parsed?.signals.length??0,
    stableExternalIdCount:parsed?.stableExternalIdCount??0,
    duplicateExternalIdCount:parsed?.duplicateExternalIds??0,
    provenanceComplete,
    accessReviewApproved:true,
    errorCode:fetched.errorCode,
    evidenceRefs:[
      ...input.source.evidence_refs,
      `adapter:${adapterKey}:${ADAPTER_VERSION}`,
      `source-digest:${digest(fetched.body)}`,
    ],
  }
  await persistTrial(input.client,trial,{
    contentType:fetched.contentType,
    skippedRows:parsed?.skippedRows??0,
    sampleExternalIds:parsed?.signals.slice(0,20).map(signal=>signal.externalId).filter(Boolean)??[],
  })
  const trials=await loadTrials(input.client,input.source.id,adapterKey)
  const certification=certifyPublicAdapter({
    sourceId:input.source.id,
    adapterKey,
    adapterVersion:ADAPTER_VERSION,
    sourceVerified:['official_owner_verified','official_portal_verified'].includes(input.source.verification_status),
    trials,
  })
  await persistCertification(input.client,certification,input.now)

  const nextAdapterStatus=certification.status==='ACTIVE_READ_ONLY'?'active':
    certification.status==='BLOCKED'?'degraded':'adapter_required'
  const {error:updateError}=await input.client.from('jhadina_public_procurement_sources').update({
    adapter_key:adapterKey,
    adapter_version:ADAPTER_VERSION,
    adapter_status:nextAdapterStatus,
    last_adapter_trial_at:input.now,
    certified_at:certification.status==='ACTIVE_READ_ONLY'?input.now:null,
    updated_at:input.now,
  }).eq('id',input.source.id)
  if(updateError)throw new Error(`public_source_adapter_state_update_failed:${updateError.message}`)

  if(certification.status==='ACTIVE_READ_ONLY'&&parsed){
    const activeSource={...input.source,adapter_key:adapterKey,adapter_version:ADAPTER_VERSION}
    await persistActiveSignals(input.client,activeSource,parsed,input.now)
  }
  return {
    sourceId:input.source.id,
    status:certification.status,
    observations:parsed?.signals.length??0,
    trialCount:certification.trialCount,
    successfulTrials:certification.successfulTrials,
    blockers:certification.blockers,
  }
}

export async function runPublicAdapterShadowBatch(
  client:SupabaseClient,
  input:{batchSize?:number;fetchImpl?:typeof fetch;now?:string}={},
){
  const now=input.now??new Date().toISOString()
  const batchSize=Math.max(1,Math.min(input.batchSize??10,25))
  const fetchImpl=input.fetchImpl??fetch
  const {data:sources,error}=await client
    .from('jhadina_public_procurement_sources')
    .select('id,jurisdiction_id,source_name,source_url,source_kinds,adapter_kind,discovery_provider,verification_status,official_owner_url,confidence,evidence_refs,blockers,adapter_status,adapter_key,adapter_version,access_review_status,last_adapter_trial_at')
    .in('verification_status',['official_owner_verified','official_portal_verified'])
    .in('adapter_status',['adapter_required','degraded','active'])
    .order('last_adapter_trial_at',{ascending:true,nullsFirst:true})
    .limit(batchSize)
    .returns<SourceRow[]>()
  if(error)throw new Error(`public_adapter_source_queue_read_failed:${error.message}`)
  if(!sources?.length)return {status:'IDLE' as const,processed:0,activated:0,results:[],externalActionAuthorized:false as const}

  const generic=sources.filter(source=>Boolean(adapterKeyFor(source)))
  if(!generic.length)return {status:'IDLE' as const,processed:0,activated:0,results:[],externalActionAuthorized:false as const}
  const ids=[...new Set(generic.map(source=>source.jurisdiction_id))]
  const {data:jurisdictions,error:jurisdictionError}=await client
    .from('jhadina_public_jurisdictions')
    .select('id,level,state_code,name,normalized_name')
    .in('id',ids)
    .returns<JurisdictionRow[]>()
  if(jurisdictionError)throw new Error(`public_adapter_jurisdiction_read_failed:${jurisdictionError.message}`)
  const byId=new Map((jurisdictions??[]).map(row=>[row.id,row]))

  const results=[]
  for(const source of generic){
    const jurisdiction=byId.get(source.jurisdiction_id)
    if(!jurisdiction)continue
    try{
      results.push(await runSourceTrial({client,source,jurisdiction,fetchImpl,now}))
    }catch(error){
      results.push({
        sourceId:source.id,
        status:'TRIAL_ERROR' as const,
        observations:0,
        reason:error instanceof Error?error.message:'public_adapter_trial_failed',
      })
    }
  }

  return {
    status:'PROCESSED' as const,
    processed:results.length,
    activated:results.filter(row=>row.status==='ACTIVE_READ_ONLY').length,
    results,
    automaticActivationLimitedToCertifiedReadOnlyAdapters:true as const,
    externalActionAuthorized:false as const,
  }
}
