import type { SupabaseClient } from '@supabase/supabase-js'

const rows=(x:unknown):Record<string,unknown>[]=>Array.isArray(x)?x.filter((v):v is Record<string,unknown>=>Boolean(v&&typeof v==='object')):[]
const text=(v:unknown)=>typeof v==='string'?v:''
const array=(v:unknown)=>Array.isArray(v)?v:[]

export function toPublicSamCatalogRow(row:Record<string,unknown>){
  return {
    noticeId:text(row.notice_id),
    solicitationNumber:text(row.solicitation_number)||undefined,
    title:text(row.title),
    noticeType:text(row.notice_type)||undefined,
    postedDate:text(row.posted_date)||undefined,
    responseDeadline:text(row.response_deadline)||undefined,
    naicsCodes:array(row.naics_codes).filter((x):x is string=>typeof x==='string'),
    classificationCodes:array(row.classification_codes).filter((x):x is string=>typeof x==='string'),
    setAside:text(row.set_aside)||undefined,
    agency:text(row.agency)||undefined,
    office:text(row.office)||undefined,
    placeOfPerformance:row.place_of_performance??undefined,
    description:text(row.description)||undefined,
    sourceUrl:text(row.source_url),
    resourceLinks:array(row.resource_links).filter((x):x is string=>typeof x==='string'),
    version:Number(row.version)||1,
    firstSeenAt:text(row.first_seen_at),
    lastSeenAt:text(row.last_seen_at),
  }
}

export async function listPublicSamCatalog(client:SupabaseClient,input:{limit?:number;naics?:string;setAside?:string}={}){
  const limit=Math.max(1,Math.min(input.limit??50,100))
  let query=client.from('jhadina_sam_catalog')
    .select('notice_id,solicitation_number,title,notice_type,posted_date,response_deadline,naics_codes,classification_codes,set_aside,agency,office,place_of_performance,description,source_url,resource_links,version,first_seen_at,last_seen_at')
    .order('last_seen_at',{ascending:false})
    .limit(limit)
  if(input.naics)query=query.contains('naics_codes',[input.naics])
  if(input.setAside)query=query.eq('set_aside',input.setAside)
  const {data,error}=await query
  if(error)throw new Error(`Unable to read SAM catalog: ${error.message}`)
  return rows(data).map(toPublicSamCatalogRow)
}

export async function readPublicSamIntelligence(client:SupabaseClient,noticeId:string){
  const [catalog,analysis,providers,documents]=await Promise.all([
    client.from('jhadina_sam_catalog').select('notice_id,solicitation_number,title,notice_type,posted_date,response_deadline,naics_codes,classification_codes,set_aside,agency,office,place_of_performance,description,source_url,resource_links,version,first_seen_at,last_seen_at').eq('notice_id',noticeId).maybeSingle(),
    client.from('jhadina_sam_analysis').select('requirements,solicitation,subcontractability,analyzed_at').eq('notice_id',noticeId).maybeSingle(),
    client.from('jhadina_sam_provider_candidates').select('requirement_id,provider_name,country,uei,cage,naics_codes,score,status,sources,evidence,discovered_at').eq('notice_id',noticeId).order('score',{ascending:false}).limit(100),
    client.from('jhadina_sam_documents').select('source_url,source_kind,checksum,content_type,byte_length,fetch_status,evidence,fetched_at').eq('notice_id',noticeId).order('fetched_at',{ascending:true}),
  ])
  if(catalog.error)throw new Error(`Unable to read SAM opportunity: ${catalog.error.message}`)
  if(!catalog.data)return undefined
  if(analysis.error)throw new Error(`Unable to read SAM analysis: ${analysis.error.message}`)
  if(providers.error)throw new Error(`Unable to read SAM providers: ${providers.error.message}`)
  if(documents.error)throw new Error(`Unable to read SAM documents: ${documents.error.message}`)
  return {
    opportunity:toPublicSamCatalogRow(catalog.data as Record<string,unknown>),
    analysis:analysis.data??null,
    providers:providers.data??[],
    documents:documents.data??[],
  }
}

export async function readRawSamCatalogNotice(client:SupabaseClient,noticeId:string):Promise<Record<string,unknown>|undefined>{
  const {data,error}=await client.from('jhadina_sam_catalog').select('raw').eq('notice_id',noticeId).maybeSingle()
  if(error)throw new Error(`Unable to read raw SAM notice: ${error.message}`)
  const raw=data&&typeof data.raw==='object'&&data.raw&&!Array.isArray(data.raw)?data.raw as Record<string,unknown>:undefined
  return raw
}
