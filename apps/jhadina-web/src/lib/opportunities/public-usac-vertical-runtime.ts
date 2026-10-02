import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PublicOpportunitySignal,
  PublicScopeRequirement,
  UsStateOrDcCode,
} from '@jhadina/opportunity-core'

const USAC_BASE='https://opendata.usac.org'
export const USAC_PUBLIC_DATASETS={
  erate470Basic:'jp7a-89nd',
  erate470Services:'39tn-hjzv',
  erateFrnStatus:'qdmp-ygft',
  rhcPostedServices:'96rf-xd57',
  rhcCommitments:'2kme-evqq',
} as const

export type UsacPublicFeed='erate470Basic'|'erateFrnStatus'|'rhcPostedServices'|'rhcCommitments'
type JsonRow=Record<string,unknown>
type ViewColumn={name?:string;fieldName?:string;dataTypeName?:string}
type ViewMeta={id?:string;name?:string;columns?:ViewColumn[]}

type JurisdictionRow={
  id:string
  level:'school_district'|'public_hospital'
  state_code:UsStateOrDcCode
  name:string
  normalized_name:string
  source_payload:Record<string,unknown>|null
}

type BuyerMatch={
  jurisdiction:JurisdictionRow
  score:number
  method:'exact'|'canonical'|'tokens'
}

type FeedReceipt={
  feed:UsacPublicFeed
  datasetId:string
  offsetBefore:number
  offsetAfter:number
  fetched:number
  matched:number
  unmatched:number
  observations:number
  completedCycle:boolean
  fundingYear:number
  errors:string[]
}

type FieldMap=Record<string,string|undefined>

const STATE_CODES=new Set<string>([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
])

const clean=(value:unknown)=>typeof value==='string'?value.replace(/\s+/g,' ').trim():
  typeof value==='number'&&Number.isFinite(value)?String(value):''

const uniq=<T>(values:T[])=>[...new Set(values)]

function digest(value:unknown){
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function safeState(value:unknown):UsStateOrDcCode|undefined{
  const state=clean(value).toUpperCase()
  return STATE_CODES.has(state)?state as UsStateOrDcCode:undefined
}

function numberValue(value:unknown):number|undefined{
  if(typeof value==='number'&&Number.isFinite(value))return value
  const raw=clean(value).replace(/[$,%]/g,'').replace(/,/g,'')
  if(!raw)return undefined
  const parsed=Number(raw)
  return Number.isFinite(parsed)?parsed:undefined
}

function dateValue(value:unknown):string|undefined{
  const raw=clean(value)
  if(!raw)return undefined
  const date=new Date(raw)
  return Number.isFinite(date.getTime())?date.toISOString().slice(0,10):undefined
}

function sourceUrl(datasetId:string){
  return `${USAC_BASE}/d/${datasetId}`
}

function normalizeName(value:string){
  return value.toLowerCase()
    .replace(/&/g,' and ')
    .replace(/['’]/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
}

const SCHOOL_GENERIC=new Set([
  'school','schools','district','public','independent','unified','community','unit','local',
  'city','county','town','township','education','educational','agency','system','systems',
  'board','of','the','isd','usd','sd','csd','r','schooling',
])
const HOSPITAL_GENERIC=new Set([
  'hospital','hospitals','medical','center','centers','health','healthcare','regional',
  'authority','district','system','systems','the','of','inc','llc',
])

function canonicalName(value:string,level:JurisdictionRow['level']){
  const raw=normalizeName(value)
    .replace(/\b(?:isd|usd|sd)\s*#?\s*(\d+)\b/g,' $1 ')
    .replace(/\bregional school unit no\s*(\d+)\b/g,' $1 ')
    .replace(/\bschool (?:city|town) of\b/g,' ')
  const stop=level==='school_district'?SCHOOL_GENERIC:HOSPITAL_GENERIC
  return raw.split(' ').filter(token=>token&&!stop.has(token)).join(' ')
}

function tokenScore(left:string,right:string){
  const a=new Set(left.split(' ').filter(Boolean))
  const b=new Set(right.split(' ').filter(Boolean))
  if(!a.size||!b.size)return 0
  const intersection=[...a].filter(token=>b.has(token)).length
  const union=new Set([...a,...b]).size
  return union?intersection/union:0
}

export function matchUsacBuyer(
  input:{name:string;state:UsStateOrDcCode;level:JurisdictionRow['level']},
  jurisdictions:JurisdictionRow[],
):BuyerMatch|undefined{
  const pool=jurisdictions.filter(row=>row.level===input.level&&row.state_code===input.state)
  if(!pool.length)return undefined
  const raw=normalizeName(input.name)
  const exact=pool.filter(row=>normalizeName(row.name)===raw||normalizeName(row.normalized_name)===raw)
  if(exact.length===1)return {jurisdiction:exact[0]!,score:1,method:'exact'}

  const canonical=canonicalName(input.name,input.level)
  if(!canonical)return undefined
  const canonicalMatches=pool.filter(row=>
    canonicalName(row.name,input.level)===canonical||
    canonicalName(row.normalized_name,input.level)===canonical
  )
  if(canonicalMatches.length===1)return {jurisdiction:canonicalMatches[0]!,score:0.96,method:'canonical'}

  const scored=pool.map(row=>({
    jurisdiction:row,
    score:Math.max(
      tokenScore(canonical,canonicalName(row.name,input.level)),
      tokenScore(canonical,canonicalName(row.normalized_name,input.level)),
    ),
  })).sort((a,b)=>b.score-a.score)
  const top=scored[0]
  const next=scored[1]
  if(!top||top.score<0.86)return undefined
  if(next&&top.score-next.score<0.12)return undefined
  return {jurisdiction:top.jurisdiction,score:top.score,method:'tokens'}
}

function normalizeColumn(value:string){
  return value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
}

function resolveField(meta:ViewMeta,aliases:string[]):string|undefined{
  const columns=meta.columns??[]
  const wanted=aliases.map(normalizeColumn)
  for(const column of columns){
    const field=column.fieldName?.trim()
    if(!field||!/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(field))continue
    const names=[column.name??'',field].map(normalizeColumn)
    if(wanted.some(alias=>names.includes(alias)))return field
  }
  for(const column of columns){
    const field=column.fieldName?.trim()
    if(!field||!/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(field))continue
    const names=[column.name??'',field].map(normalizeColumn)
    if(wanted.some(alias=>names.some(name=>name.includes(alias)||alias.includes(name))))return field
  }
  return undefined
}

async function fetchJson(fetchImpl:typeof fetch,url:string){
  const response=await fetchImpl(url,{
    headers:{accept:'application/json','user-agent':'Jhadina-USAC-Public-Procurement/1.0'},
    cache:'no-store',
    signal:AbortSignal.timeout(30_000),
  })
  if(!response.ok)throw new Error(`USAC_HTTP_${response.status}:${url}`)
  return response.json()
}

async function loadMeta(fetchImpl:typeof fetch,datasetId:string):Promise<ViewMeta>{
  const payload=await fetchJson(fetchImpl,`${USAC_BASE}/api/views/${datasetId}`)
  if(!payload||typeof payload!=='object')throw new Error(`USAC_META_INVALID:${datasetId}`)
  return payload as ViewMeta
}

function fieldMap(meta:ViewMeta,aliases:Record<string,string[]>):FieldMap{
  return Object.fromEntries(Object.entries(aliases).map(([key,names])=>[key,resolveField(meta,names)]))
}

function rowValue(row:JsonRow,field:string|undefined){
  return field?row[field]:undefined
}

async function fetchRows(input:{
  fetchImpl:typeof fetch
  datasetId:string
  selectFields:string[]
  offset:number
  limit:number
  where?:string
  order?:string
}):Promise<JsonRow[]>{
  const url=new URL(`${USAC_BASE}/resource/${input.datasetId}.json`)
  url.searchParams.set('$limit',String(input.limit))
  url.searchParams.set('$offset',String(input.offset))
  const fields=uniq(input.selectFields.filter((field):field is string=>Boolean(field)&&/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(field)))
  if(fields.length)url.searchParams.set('$select',fields.join(','))
  if(input.where)url.searchParams.set('$where',input.where)
  if(input.order)url.searchParams.set('$order',input.order)
  const payload=await fetchJson(input.fetchImpl,url.toString())
  if(!Array.isArray(payload))throw new Error(`USAC_ROWS_INVALID:${input.datasetId}`)
  return payload.filter((row):row is JsonRow=>Boolean(row)&&typeof row==='object'&&!Array.isArray(row))
}

async function loadJurisdictions(client:SupabaseClient,level:JurisdictionRow['level'],states:UsStateOrDcCode[]){
  if(!states.length)return[] as JurisdictionRow[]
  const rows:JurisdictionRow[]=[]
  for(let from=0;;from+=1000){
    const {data,error}=await client
      .from('jhadina_public_jurisdictions')
      .select('id,level,state_code,name,normalized_name,source_payload')
      .eq('level',level)
      .in('state_code',states)
      .order('id',{ascending:true})
      .range(from,from+999)
      .returns<JurisdictionRow[]>()
    if(error)throw new Error(`USAC_JURISDICTION_READ_FAILED:${error.message}`)
    const page=data??[]
    rows.push(...page)
    if(page.length<1000)break
  }
  return rows
}

async function upsertSource(client:SupabaseClient,input:{
  jurisdiction:JurisdictionRow
  feed:UsacPublicFeed
  sourceKinds:string[]
  now:string
  match:BuyerMatch
}){
  const datasetId=USAC_PUBLIC_DATASETS[input.feed]
  const id=`public-source:usac:${input.feed}:${input.jurisdiction.id}`
  const {error}=await client.from('jhadina_public_procurement_sources').upsert({
    id,
    jurisdiction_id:input.jurisdiction.id,
    state_code:input.jurisdiction.state_code,
    source_name:`USAC ${input.feed}`,
    source_url:sourceUrl(datasetId),
    source_kinds:input.sourceKinds,
    adapter_kind:'api',
    discovery_provider:'manual',
    verification_status:'official_portal_verified',
    official_owner_url:'https://www.usac.org/',
    confidence:Math.max(0.9,input.match.score),
    evidence_refs:[
      `usac-dataset:${datasetId}`,
      `buyer-match:${input.match.method}:${input.match.score.toFixed(3)}`,
    ],
    blockers:[],
    adapter_status:'active',
    adapter_key:'usac-socrata-v1',
    adapter_version:'1.0.0',
    access_review_status:'approved_platform',
    discovered_at:input.now,
    verified_at:input.now,
    last_seen_at:input.now,
    access_reviewed_at:input.now,
    certified_at:input.now,
    updated_at:input.now,
  },{onConflict:'id'})
  if(error)throw new Error(`USAC_SOURCE_UPSERT_FAILED:${error.message}`)
  return id
}

function keywords(value:string){
  const stop=new Set(['and','the','for','with','from','this','that','school','district','public','service','services','request','funding','health','care'])
  return uniq(normalizeName(value).split(' ').filter(token=>token.length>=4&&!stop.has(token))).slice(0,30)
}

function scopeRequirement(input:{
  id:string
  label:string
  description?:string
  category?:string
  state:UsStateOrDcCode
  county?:string
  evidenceRef:string
}):PublicScopeRequirement{
  return {
    id:input.id,
    label:input.label,
    description:input.description,
    category:input.category,
    keywords:keywords(`${input.label} ${input.description??''}`),
    geography:input.county?`${input.county} County, ${input.state}`:input.state,
    evidenceRefs:[input.evidenceRef],
  }
}

async function upsertSignals(client:SupabaseClient,rows:Array<{signal:PublicOpportunitySignal;scopeRequirements?:PublicScopeRequirement[]}> ,now:string){
  if(!rows.length)return
  const payload=rows.map(({signal,scopeRequirements})=>({
    id:signal.id,
    source_id:signal.sourceId,
    external_id:signal.externalId??null,
    state_code:signal.state,
    county_name:signal.county??null,
    locality:signal.locality??null,
    stage:signal.stage,
    title:signal.title,
    source_url:signal.sourceUrl,
    content_digest:digest(signal),
    payload:{
      signal,
      ...(scopeRequirements?.length?{scopeRequirements}:{}),
      routeAuthority:{
        automaticDiscoveryAuthorized:true,
        externalContactAuthorized:false,
        bidSubmissionAuthorized:false,
      },
      officialProgramSource:'USAC',
    },
    captured_at:signal.capturedAt,
    last_seen_at:now,
    active:true,
    updated_at:now,
  }))
  for(let i=0;i<payload.length;i+=250){
    const {error}=await client.from('jhadina_public_opportunity_inbox').upsert(payload.slice(i,i+250),{onConflict:'id'})
    if(error)throw new Error(`USAC_OPPORTUNITY_UPSERT_FAILED:${error.message}`)
  }
}

async function sourceState(client:SupabaseClient,feed:UsacPublicFeed){
  const sourceId=`usac:${feed}`
  const {data,error}=await client.from('jhadina_public_source_state')
    .select('checkpoint,consecutive_failures,observations')
    .eq('source_id',sourceId)
    .maybeSingle<{checkpoint:Record<string,unknown>;consecutive_failures:number;observations:number}>()
  if(error)throw new Error(`USAC_SOURCE_STATE_READ_FAILED:${error.message}`)
  return data??{checkpoint:{},consecutive_failures:0,observations:0}
}

async function persistSourceState(client:SupabaseClient,input:{
  feed:UsacPublicFeed
  status:'healthy'|'degraded'|'failed'
  checkpoint:Record<string,unknown>
  observations:number
  now:string
  error?:string
}){
  const previous=await sourceState(client,input.feed)
  const {error}=await client.from('jhadina_public_source_state').upsert({
    source_id:`usac:${input.feed}`,
    status:input.status,
    checkpoint:input.checkpoint,
    health:{
      datasetId:USAC_PUBLIC_DATASETS[input.feed],
      publicOfficialSource:true,
      readOnly:true,
      externalActionAuthorized:false,
      ...(input.error?{error:input.error}:{}),
    },
    last_success_at:input.status==='healthy'?input.now:null,
    last_error_at:input.error?input.now:null,
    consecutive_failures:input.error?previous.consecutive_failures+1:0,
    observations:previous.observations+input.observations,
    last_run_at:input.now,
    updated_at:input.now,
  },{onConflict:'source_id'})
  if(error)throw new Error(`USAC_SOURCE_STATE_WRITE_FAILED:${error.message}`)
}

function fundingWhere(field:string|undefined,fundingYear:number){
  return field?`${field} >= ${Math.max(2016,fundingYear)}`:undefined
}

const BASIC_ALIASES={
  application:['Application Number','Application ID'],
  fundingYear:['Funding Year'],
  buyerNumber:['Billed Entity Number','BEN','Applicant Number'],
  buyerName:['Billed Entity Name','Applicant Name','Entity Name'],
  buyerType:['Billed Entity Type','Applicant Type','Organization Type'],
  state:['Billed Entity State','Applicant State','State'],
  county:['Billed Entity County','Applicant County','County'],
  formUrl:['FCC Form 470 PDF','Form 470 PDF','Application URL','Form URL'],
  allowableContractDate:['Allowable Contract Date'],
}
const SERVICES_ALIASES={
  application:['Application Number','Application ID'],
  serviceCategory:['Service Category','Category of Service'],
  serviceType:['Service Type'],
  function:['Function','Service Function'],
  manufacturer:['Manufacturer'],
  quantity:['Quantity','Service Quantity'],
  narrative:['Narrative','Description','Service Description','Request for Services'],
}
const FRN_ALIASES={
  frn:['FRN','Funding Request Number'],
  application:['Application Number'],
  fundingYear:['Funding Year'],
  buyerName:['Billed Entity Name','Applicant Name'],
  buyerType:['Billed Entity Type','Applicant Type'],
  state:['Billed Entity State','Applicant State','State'],
  county:['Billed Entity County','Applicant County','County'],
  providerName:['Service Provider Name','SP Name'],
  serviceType:['Service Type'],
  category:['Category of Service','Service Category'],
  amount:['Funding Commitment Request','Committed Amount','Commitment Amount','Total Committed Amount','Pre-Discount Cost'],
  decisionDate:['FCDL Date','Funding Commitment Decision Date','Commitment Date'],
}
const RHC_POSTED_ALIASES={
  application:['Application Number','Form 461/465 Application Number'],
  fundingYear:['Funding Year'],
  buyerNumber:['HCP Number','Filing HCP','Site HCP Number'],
  buyerName:['Site Name','HCP Name','Filing HCP Name','Health Care Provider Name'],
  buyerType:['Applicant Type','Filing HCP Entity Type','HCP Type'],
  state:['Site State','Filing HCP State','State'],
  county:['Site County','Filing HCP County','County'],
  city:['Site City','Filing HCP City','City'],
  request:['Request for Services','Requested Services','Service Request'],
  start:['Posting Start Date'],
  end:['Posting End Date','Posting End Date/Time'],
  document:['Form 461/465 URL','Application URL','Processed PDF','Form PDF'],
}
const RHC_COMMIT_ALIASES={
  frn:['FRN','Funding Request Number','FRN Line Number'],
  application:['Application Number'],
  fundingYear:['Funding Year'],
  buyerNumber:['Participating HCP','Filing HCP','HCP Number'],
  buyerName:['Participating HCP Name','Filing HCP Name','HCP Name'],
  buyerType:['Participating HCP Entity Type','Filing HCP Entity Type','HCP Type'],
  state:['Participating HCP State','Filing HCP State','State'],
  county:['Participating HCP County','Filing HCP County','County'],
  city:['Participating HCP City','Filing HCP City','City'],
  providerName:['Service Provider Name'],
  request:['Service Type','Request for Services','Service'],
  amount:['Total Committed Amount','Committed Amount'],
  decisionDate:['Funding Commitment Date','Commitment Date','FCDL Date'],
}

export async function probeUsacPublicVerticalFeeds(fetchImpl:typeof fetch=fetch){
  const specs:Array<{
    datasetId:string
    aliases:Record<string,string[]>
    required:string[]
  }>=[
    {datasetId:USAC_PUBLIC_DATASETS.erate470Basic,aliases:BASIC_ALIASES,required:['application','buyerName','state']},
    {datasetId:USAC_PUBLIC_DATASETS.erate470Services,aliases:SERVICES_ALIASES,required:['application']},
    {datasetId:USAC_PUBLIC_DATASETS.erateFrnStatus,aliases:FRN_ALIASES,required:['frn','buyerName','state','providerName']},
    {datasetId:USAC_PUBLIC_DATASETS.rhcPostedServices,aliases:RHC_POSTED_ALIASES,required:['application','buyerName','state']},
    {datasetId:USAC_PUBLIC_DATASETS.rhcCommitments,aliases:RHC_COMMIT_ALIASES,required:['frn','buyerName','state','providerName']},
  ]
  const results=[]
  for(const spec of specs){
    const meta=await loadMeta(fetchImpl,spec.datasetId)
    const fields=fieldMap(meta,spec.aliases)
    const missing=spec.required.filter(key=>!fields[key])
    if(missing.length)throw new Error(`USAC_SCHEMA_REQUIRED_FIELDS_MISSING:${spec.datasetId}:${missing.join(',')}`)
    const rows=await fetchRows({
      fetchImpl,
      datasetId:spec.datasetId,
      selectFields:Object.values(fields).filter((v):v is string=>Boolean(v)),
      offset:0,
      limit:1,
    })
    results.push({
      datasetId:spec.datasetId,
      name:meta.name??spec.datasetId,
      fields,
      sampleRows:rows.length,
    })
  }
  return {status:'PASS' as const,datasets:results,readOnly:true as const}
}

async function fetchServiceScopes(fetchImpl:typeof fetch,applications:string[]){
  if(!applications.length)return {rows:new Map<string,JsonRow[]>(),fields:{} as FieldMap}
  const meta=await loadMeta(fetchImpl,USAC_PUBLIC_DATASETS.erate470Services)
  const fields=fieldMap(meta,SERVICES_ALIASES)
  if(!fields.application)return {rows:new Map<string,JsonRow[]>(),fields}
  const out=new Map<string,JsonRow[]>()
  for(let start=0;start<applications.length;start+=40){
    const batch=applications.slice(start,start+40)
    const quoted=batch.map(id=>`'${id.replace(/'/g,"''")}'`).join(',')
    const rows=await fetchRows({
      fetchImpl,
      datasetId:USAC_PUBLIC_DATASETS.erate470Services,
      selectFields:Object.values(fields).filter((v):v is string=>Boolean(v)),
      offset:0,
      limit:5000,
      where:`${fields.application} in (${quoted})`,
    })
    for(const row of rows){
      const id=clean(rowValue(row,fields.application))
      if(!id)continue
      const values=out.get(id)??[]
      values.push(row)
      out.set(id,values)
    }
  }
  return {rows:out,fields}
}

async function processErate470(input:{
  client:SupabaseClient;fetchImpl:typeof fetch;fundingYear:number;pageSize:number;now:string
}):Promise<FeedReceipt>{
  const feed='erate470Basic' as const
  const meta=await loadMeta(input.fetchImpl,USAC_PUBLIC_DATASETS[feed])
  const fields=fieldMap(meta,BASIC_ALIASES)
  if(!fields.application||!fields.buyerName||!fields.state)throw new Error('USAC_ERATE470_REQUIRED_FIELDS_MISSING')
  const state=await sourceState(input.client,feed)
  const offset=Number(state.checkpoint.fundingYear)===input.fundingYear?(Number(state.checkpoint.offset??0)||0):0
  const rows=await fetchRows({
    fetchImpl:input.fetchImpl,
    datasetId:USAC_PUBLIC_DATASETS[feed],
    selectFields:Object.values(fields).filter((v):v is string=>Boolean(v)),
    offset,
    limit:input.pageSize,
    where:fundingWhere(fields.fundingYear,input.fundingYear),
    order:fields.application?`${fields.application} ASC`:undefined,
  })
  const states=uniq(rows.map(row=>safeState(rowValue(row,fields.state))).filter((v):v is UsStateOrDcCode=>Boolean(v)))
  const jurisdictions=await loadJurisdictions(input.client,'school_district',states)
  const applications=uniq(rows.map(row=>clean(rowValue(row,fields.application))).filter(Boolean))
  const serviceData=await fetchServiceScopes(input.fetchImpl,applications)
  const results:Array<{signal:PublicOpportunitySignal;scopeRequirements?:PublicScopeRequirement[]}>= []
  let matched=0
  let unmatched=0
  for(const row of rows){
    const buyerName=clean(rowValue(row,fields.buyerName))
    const stateCode=safeState(rowValue(row,fields.state))
    const buyerType=clean(rowValue(row,fields.buyerType)).toLowerCase()
    if(!buyerName||!stateCode||buyerType&&!buyerType.includes('school district')){unmatched+=1;continue}
    const match=matchUsacBuyer({name:buyerName,state:stateCode,level:'school_district'},jurisdictions)
    if(!match){unmatched+=1;continue}
    matched+=1
    const sourceId=await upsertSource(input.client,{
      jurisdiction:match.jurisdiction,feed,sourceKinds:['solicitation','vendor_portal'],now:input.now,match,
    })
    const application=clean(rowValue(row,fields.application))
    const scopes=serviceData.rows.get(application)??[]
    const serviceFields=serviceData.fields
    const evidenceRef=`usac:erate470:${application}`
    const scopeRequirements=scopes.map((scope,index)=>{
      const category=clean(rowValue(scope,serviceFields.serviceCategory))
      const type=clean(rowValue(scope,serviceFields.serviceType))
      const fn=clean(rowValue(scope,serviceFields.function))
      const manufacturer=clean(rowValue(scope,serviceFields.manufacturer))
      const quantity=clean(rowValue(scope,serviceFields.quantity))
      const narrative=clean(rowValue(scope,serviceFields.narrative))
      const label=[type,fn].filter(Boolean).join(' — ')||category||`E-Rate service ${index+1}`
      const description=[narrative,manufacturer&&`Manufacturer: ${manufacturer}`,quantity&&`Quantity: ${quantity}`].filter(Boolean).join(' | ')||undefined
      return scopeRequirement({
        id:`erate470:${application}:${index+1}`,
        label,description,category,state:stateCode,
        county:clean(rowValue(row,fields.county))||undefined,
        evidenceRef:`${evidenceRef}:service:${index+1}`,
      })
    })
    const first=scopeRequirements[0]
    const documentUrl=clean(rowValue(row,fields.formUrl))
    const signal:PublicOpportunitySignal={
      id:`local:${stateCode.toLowerCase()}:usac:erate470:${encodeURIComponent(application)}`,
      sourceId,
      sourceUrl:documentUrl||sourceUrl(USAC_PUBLIC_DATASETS[feed]),
      sourceName:'USAC E-Rate FCC Form 470',
      title:first?.label?`${buyerName} — ${first.label}`:`${buyerName} E-Rate competitive bid ${application}`,
      description:scopeRequirements.length
        ?`${scopeRequirements.length} E-Rate requested service scope(s) published through FCC Form 470.`
        :'E-Rate competitive bidding opportunity published through FCC Form 470.',
      stage:'open_solicitation',
      state:stateCode,
      county:clean(rowValue(row,fields.county))||undefined,
      externalId:application,
      buyer:match.jurisdiction.name,
      capturedAt:input.now,
      evidenceRef,
    }
    results.push({signal,scopeRequirements})
  }
  await upsertSignals(input.client,results,input.now)
  const completedCycle=rows.length<input.pageSize
  const offsetAfter=completedCycle?0:offset+rows.length
  await persistSourceState(input.client,{
    feed,status:'healthy',checkpoint:{offset:offsetAfter,fundingYear:input.fundingYear,completedCycleAt:completedCycle?input.now:undefined},
    observations:results.length,now:input.now,
  })
  return {feed,datasetId:USAC_PUBLIC_DATASETS[feed],offsetBefore:offset,offsetAfter,fetched:rows.length,matched,unmatched,observations:results.length,completedCycle,fundingYear:input.fundingYear,errors:[]}
}

async function processAwardFeed(input:{
  client:SupabaseClient
  fetchImpl:typeof fetch
  feed:'erateFrnStatus'|'rhcCommitments'
  level:JurisdictionRow['level']
  aliases:Record<string,string[]>
  fundingYear:number
  pageSize:number
  now:string
}):Promise<FeedReceipt>{
  const meta=await loadMeta(input.fetchImpl,USAC_PUBLIC_DATASETS[input.feed])
  const fields=fieldMap(meta,input.aliases)
  if(!fields.buyerName||!fields.state||!fields.providerName||!fields.frn)throw new Error(`USAC_${input.feed}_REQUIRED_FIELDS_MISSING`)
  const state=await sourceState(input.client,input.feed)
  const offset=Number(state.checkpoint.fundingYear)===input.fundingYear?(Number(state.checkpoint.offset??0)||0):0
  const rows=await fetchRows({
    fetchImpl:input.fetchImpl,
    datasetId:USAC_PUBLIC_DATASETS[input.feed],
    selectFields:Object.values(fields).filter((v):v is string=>Boolean(v)),
    offset,
    limit:input.pageSize,
    where:fundingWhere(fields.fundingYear,input.fundingYear),
    order:fields.frn?`${fields.frn} ASC`:undefined,
  })
  const states=uniq(rows.map(row=>safeState(rowValue(row,fields.state))).filter((v):v is UsStateOrDcCode=>Boolean(v)))
  const jurisdictions=await loadJurisdictions(input.client,input.level,states)
  const observations:Array<{signal:PublicOpportunitySignal;scopeRequirements?:PublicScopeRequirement[]}>= []
  let matched=0
  let unmatched=0
  for(const row of rows){
    const buyerName=clean(rowValue(row,fields.buyerName))
    const stateCode=safeState(rowValue(row,fields.state))
    const providerName=clean(rowValue(row,fields.providerName))
    const buyerType=clean(rowValue(row,fields.buyerType)).toLowerCase()
    if(!buyerName||!stateCode||!providerName){unmatched+=1;continue}
    if(input.level==='school_district'&&buyerType&&!buyerType.includes('school district')){unmatched+=1;continue}
    const match=matchUsacBuyer({name:buyerName,state:stateCode,level:input.level},jurisdictions)
    if(!match){unmatched+=1;continue}
    matched+=1
    const sourceId=await upsertSource(input.client,{
      jurisdiction:match.jurisdiction,
      feed:input.feed,
      sourceKinds:['award'],
      now:input.now,
      match,
    })
    const frn=clean(rowValue(row,fields.frn))
    const service=clean(rowValue(row,fields.serviceType??fields.request))
    const category=clean(rowValue(row,fields.category))
    const amount=numberValue(rowValue(row,fields.amount))
    const awardDate=dateValue(rowValue(row,fields.decisionDate))
    const evidenceRef=`usac:${input.feed}:${frn}`
    const label=service||category||'USAC committed service'
    const scope=scopeRequirement({
      id:`${input.feed}:${frn}:scope`,
      label,
      description:category&&category!==label?category:undefined,
      category:category||undefined,
      state:stateCode,
      county:clean(rowValue(row,fields.county))||undefined,
      evidenceRef,
    })
    const signal:PublicOpportunitySignal={
      id:`local:${stateCode.toLowerCase()}:usac:${input.feed}:${encodeURIComponent(frn)}`,
      sourceId,
      sourceUrl:sourceUrl(USAC_PUBLIC_DATASETS[input.feed]),
      sourceName:input.feed==='erateFrnStatus'?'USAC E-Rate FCC Form 471 / FRN':'USAC Rural Health Care Commitments',
      title:`${buyerName} — ${label}`,
      description:'Official USAC commitment record identifying the funded buyer and service provider.',
      stage:'award',
      state:stateCode,
      county:clean(rowValue(row,fields.county))||undefined,
      locality:clean(rowValue(row,fields.city))||undefined,
      externalId:frn,
      amount:amount!==undefined?{max:amount,currency:'USD'}:undefined,
      buyer:match.jurisdiction.name,
      awardedPrimeName:providerName,
      awardDate,
      capturedAt:input.now,
      evidenceRef,
    }
    observations.push({signal,scopeRequirements:[scope]})
  }
  await upsertSignals(input.client,observations,input.now)
  const completedCycle=rows.length<input.pageSize
  const offsetAfter=completedCycle?0:offset+rows.length
  await persistSourceState(input.client,{
    feed:input.feed,status:'healthy',checkpoint:{offset:offsetAfter,fundingYear:input.fundingYear,completedCycleAt:completedCycle?input.now:undefined},
    observations:observations.length,now:input.now,
  })
  return {feed:input.feed,datasetId:USAC_PUBLIC_DATASETS[input.feed],offsetBefore:offset,offsetAfter,fetched:rows.length,matched,unmatched,observations:observations.length,completedCycle,fundingYear:input.fundingYear,errors:[]}
}

async function processRhcPosted(input:{
  client:SupabaseClient;fetchImpl:typeof fetch;fundingYear:number;pageSize:number;now:string
}):Promise<FeedReceipt>{
  const feed='rhcPostedServices' as const
  const meta=await loadMeta(input.fetchImpl,USAC_PUBLIC_DATASETS[feed])
  const fields=fieldMap(meta,RHC_POSTED_ALIASES)
  if(!fields.application||!fields.buyerName||!fields.state)throw new Error('USAC_RHC_POSTED_REQUIRED_FIELDS_MISSING')
  const state=await sourceState(input.client,feed)
  const offset=Number(state.checkpoint.fundingYear)===input.fundingYear?(Number(state.checkpoint.offset??0)||0):0
  const rows=await fetchRows({
    fetchImpl:input.fetchImpl,datasetId:USAC_PUBLIC_DATASETS[feed],
    selectFields:Object.values(fields).filter((v):v is string=>Boolean(v)),
    offset,limit:input.pageSize,
    where:fundingWhere(fields.fundingYear,input.fundingYear),
    order:`${fields.application} ASC`,
  })
  const states=uniq(rows.map(row=>safeState(rowValue(row,fields.state))).filter((v):v is UsStateOrDcCode=>Boolean(v)))
  const jurisdictions=await loadJurisdictions(input.client,'public_hospital',states)
  const observations:Array<{signal:PublicOpportunitySignal;scopeRequirements?:PublicScopeRequirement[]}>= []
  let matched=0
  let unmatched=0
  for(const row of rows){
    const buyerName=clean(rowValue(row,fields.buyerName))
    const stateCode=safeState(rowValue(row,fields.state))
    const application=clean(rowValue(row,fields.application))
    if(!buyerName||!stateCode||!application){unmatched+=1;continue}
    const match=matchUsacBuyer({name:buyerName,state:stateCode,level:'public_hospital'},jurisdictions)
    if(!match){unmatched+=1;continue}
    matched+=1
    const sourceId=await upsertSource(input.client,{
      jurisdiction:match.jurisdiction,feed,sourceKinds:['solicitation','vendor_portal'],now:input.now,match,
    })
    const request=clean(rowValue(row,fields.request))||'Rural Health Care requested service'
    const evidenceRef=`usac:rhc-posted:${application}`
    const scope=scopeRequirement({
      id:`rhc-posted:${application}:scope`,label:request,
      state:stateCode,county:clean(rowValue(row,fields.county))||undefined,evidenceRef,
    })
    const doc=clean(rowValue(row,fields.document))
    observations.push({
      signal:{
        id:`local:${stateCode.toLowerCase()}:usac:rhc-posted:${encodeURIComponent(application)}`,
        sourceId,
        sourceUrl:doc||sourceUrl(USAC_PUBLIC_DATASETS[feed]),
        sourceName:'USAC Rural Health Care Posted Services',
        title:`${buyerName} — ${request}`,
        description:'Official USAC Rural Health Care competitive service posting.',
        stage:'open_solicitation',
        state:stateCode,
        county:clean(rowValue(row,fields.county))||undefined,
        locality:clean(rowValue(row,fields.city))||undefined,
        externalId:application,
        buyer:match.jurisdiction.name,
        capturedAt:input.now,
        evidenceRef,
      },
      scopeRequirements:[scope],
    })
  }
  await upsertSignals(input.client,observations,input.now)
  const completedCycle=rows.length<input.pageSize
  const offsetAfter=completedCycle?0:offset+rows.length
  await persistSourceState(input.client,{
    feed,status:'healthy',checkpoint:{offset:offsetAfter,fundingYear:input.fundingYear,completedCycleAt:completedCycle?input.now:undefined},
    observations:observations.length,now:input.now,
  })
  return {feed,datasetId:USAC_PUBLIC_DATASETS[feed],offsetBefore:offset,offsetAfter,fetched:rows.length,matched,unmatched,observations:observations.length,completedCycle,fundingYear:input.fundingYear,errors:[]}
}

async function runFeed<T extends UsacPublicFeed>(
  feed:T,
  fn:()=>Promise<FeedReceipt>,
  client:SupabaseClient,
  now:string,
):Promise<FeedReceipt>{
  try{return await fn()}
  catch(error){
    const message=error instanceof Error?error.message:`USAC_${feed}_UNKNOWN_FAILURE`
    const state=await sourceState(client,feed)
    await persistSourceState(client,{
      feed,status:'failed',checkpoint:state.checkpoint,observations:0,now,error:message,
    })
    return {
      feed,datasetId:USAC_PUBLIC_DATASETS[feed],
      offsetBefore:Number(state.checkpoint.offset??0)||0,
      offsetAfter:Number(state.checkpoint.offset??0)||0,
      fetched:0,matched:0,unmatched:0,observations:0,completedCycle:false,
      fundingYear:Number(state.checkpoint.fundingYear??new Date(now).getUTCFullYear())||new Date(now).getUTCFullYear(),
      errors:[message],
    }
  }
}

export async function refreshUsacPublicVerticalFeeds(
  client:SupabaseClient,
  input:{fetchImpl?:typeof fetch;now?:string;pageSize?:number;fundingYear?:number;feeds?:UsacPublicFeed[]}={},
){
  const fetchImpl=input.fetchImpl??fetch
  const now=input.now??new Date().toISOString()
  const pageSize=Math.max(25,Math.min(input.pageSize??500,2000))
  const fundingYear=Math.max(2016,Math.min(input.fundingYear??new Date(now).getUTCFullYear(),new Date(now).getUTCFullYear()+1))

  const requested=new Set<UsacPublicFeed>(input.feeds?.length?input.feeds:[
    'erate470Basic','erateFrnStatus','rhcPostedServices','rhcCommitments',
  ])
  const receipts:FeedReceipt[]=[]
  if(requested.has('erate470Basic'))receipts.push(await runFeed('erate470Basic',()=>processErate470({client,fetchImpl,fundingYear,pageSize,now}),client,now))
  if(requested.has('erateFrnStatus'))receipts.push(await runFeed('erateFrnStatus',()=>processAwardFeed({
    client,fetchImpl,feed:'erateFrnStatus',level:'school_district',aliases:FRN_ALIASES,fundingYear,pageSize,now,
  }),client,now))
  if(requested.has('rhcPostedServices'))receipts.push(await runFeed('rhcPostedServices',()=>processRhcPosted({client,fetchImpl,fundingYear,pageSize,now}),client,now))
  if(requested.has('rhcCommitments'))receipts.push(await runFeed('rhcCommitments',()=>processAwardFeed({
    client,fetchImpl,feed:'rhcCommitments',level:'public_hospital',aliases:RHC_COMMIT_ALIASES,fundingYear,pageSize,now,
  }),client,now))

  return {
    status:receipts.some(receipt=>receipt.errors.length)?'PARTIAL' as const:'PASS' as const,
    fundingYear,
    pageSize,
    receipts,
    fetched:receipts.reduce((sum,row)=>sum+row.fetched,0),
    matched:receipts.reduce((sum,row)=>sum+row.matched,0),
    unmatched:receipts.reduce((sum,row)=>sum+row.unmatched,0),
    observations:receipts.reduce((sum,row)=>sum+row.observations,0),
    completedCycles:receipts.filter(row=>row.completedCycle).map(row=>row.feed),
    automaticDiscoveryAuthorized:true as const,
    externalContactAuthorized:false as const,
    providerOutreachAuthorized:false as const,
    bidSubmissionAuthorized:false as const,
  }
}
