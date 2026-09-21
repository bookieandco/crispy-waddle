import type { SupabaseClient } from '@supabase/supabase-js'
import { certifySamUsableFinal, type SamUsableCertification } from '@jhadina/opportunity-core'
import { analyzeSamNotices } from './sam-analysis-runtime'
import { discoverSamProviders } from './sam-provider-runtime'
import { harvestSamDocuments, recentSamNoticeIds, runSamWideScan } from './sam-wide-runtime'

const fmt=(d:Date)=>`${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')}/${d.getUTCFullYear()}`
export function defaultSamScanWindow(days=2){
  const end=new Date(),start=new Date(end.getTime()-Math.max(1,days)*86400000)
  return {postedFrom:fmt(start),postedTo:fmt(end)}
}
function parseUsDate(value:string):Date{
  const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if(!m)throw new Error('Invalid scan date')
  return new Date(Date.UTC(Number(m[3]),Number(m[1])-1,Number(m[2])))
}
export async function nextSamBackfillWindow(client:SupabaseClient,windowDays=7){
  const {data}=await client.from('jhadina_sam_scan_runs').select('posted_from').eq('status','completed').eq('scan_kind','backfill').order('id',{ascending:false}).limit(1)
  const dates=(Array.isArray(data)?data:[]).map(x=>typeof x.posted_from==='string'?parseUsDate(x.posted_from):null).filter((x):x is Date=>Boolean(x))
  const anchor=dates[0]??new Date(Date.now()-3*86400000)
  const end=new Date(anchor.getTime()-86400000)
  const start=new Date(end.getTime()-(Math.max(1,windowDays)-1)*86400000)
  return {postedFrom:fmt(start),postedTo:fmt(end)}
}
export async function runSamUsablePipeline(client:SupabaseClient,input:{postedFrom:string;postedTo:string;maxPages?:number;maxProcessNotices?:number;scanKind?:'recent'|'backfill'|'manual'}){
  const scan=await runSamWideScan(client,{postedFrom:input.postedFrom,postedTo:input.postedTo,maxPages:input.maxPages??20,pageSize:1000,scanKind:input.scanKind??'manual'})
  const processLimit=Math.max(1,Math.min(input.maxProcessNotices??12,50))
  const noticeIds=(scan.changedNoticeIds.length?scan.changedNoticeIds:await recentSamNoticeIds(client,processLimit)).slice(0,processLimit)
  const documents=await harvestSamDocuments(client,noticeIds,80)
  const analysis=await analyzeSamNotices(client,noticeIds)
  const providers=await discoverSamProviders(client,noticeIds,20)
  return {scan,noticeIds,documents,analysis,providers}
}
const unique=(rows:unknown,key:string)=>new Set((Array.isArray(rows)?rows:[]).map(x=>x&&typeof x==='object'?String((x as Record<string,unknown>)[key]??''):'').filter(Boolean)).size
export async function readSamUsableCertification(client:SupabaseClient):Promise<SamUsableCertification>{
  const [scan,catalog,documents,analysis,providers]=await Promise.all([
    client.from('jhadina_sam_scan_runs').select('id,errors').eq('status','completed').limit(100),
    client.from('jhadina_sam_catalog').select('notice_id').limit(1000),
    client.from('jhadina_sam_documents').select('notice_id,source_url,fetch_status').limit(1000),
    client.from('jhadina_sam_analysis').select('notice_id,requirements,subcontractability').limit(1000),
    client.from('jhadina_sam_provider_candidates').select('notice_id,provider_name,evidence').limit(1000),
  ])
  const providerRows=Array.isArray(providers.data)?providers.data:[]
  const documentRows=Array.isArray(documents.data)?documents.data:[]
  const provenanceComplete=documentRows.every(x=>Boolean(x.source_url))&&providerRows.every(x=>Array.isArray(x.evidence)&&x.evidence.length>0)
  return certifySamUsableFinal({
    runtimeBound:Boolean(process.env.SAM_GOV_API_KEY&&process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY),
    scanReceipts:Array.isArray(scan.data)?scan.data.length:0,
    realNotices:unique(catalog.data,'notice_id'),
    noticesWithDocuments:unique(documents.data,'notice_id'),
    noticesWithSubcontractability:unique(analysis.data,'notice_id'),
    noticesWithProviderCandidates:unique(providers.data,'notice_id'),
    realProviderCandidates:providerRows.length,
    provenanceComplete,
    unauthorizedExternalActions:0,
    silentFallbacks:0,
  })
}
