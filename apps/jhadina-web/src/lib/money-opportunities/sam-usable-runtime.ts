import type { SupabaseClient } from '@supabase/supabase-js'
import { certifySamUsableFinal, evaluateSamCertRows, type SamUsableCertification, type SamUsableEvidence } from '@jhadina/opportunity-core'
import { analyzeSamNotices } from './sam-analysis-runtime'
import { discoverSamProviders } from './sam-provider-runtime'
import { buildSamPursuitOptions } from './sam-pursuit-runtime'
import { getSamMarketCoverage, harvestSamDocuments, hydrateSamNoticeDetails, recentSamNoticeIds } from './sam-wide-runtime'

export async function runSamEnrichment(
  client:SupabaseClient,
  input:{limit?:number;maxDocuments?:number;maxProvidersPerNotice?:number}={},
){
  const limit=Math.max(3,Math.min(input.limit??5,20))
  const noticeIds=await recentSamNoticeIds(client,limit)
  if(!noticeIds.length)return {
    noticeIds,
    hydration:{hydrated:0,errors:[] as string[]},
    documents:{attempted:0,textCaptured:0,binaryCaptured:0,needsOcr:0,unsupported:0,failed:0},
    analysis:{analyzed:0},
    providers:{notices:0,candidates:0,errors:[] as string[]},
    pursuit:{generated:0,teamCovered:0,readyForQuote:0,errors:[] as string[]},
  }
  const hydration=await hydrateSamNoticeDetails(client,noticeIds)
  const documents=await harvestSamDocuments(client,noticeIds,Math.max(1,Math.min(input.maxDocuments??40,100)))
  const analysis=await analyzeSamNotices(client,noticeIds)
  const providers=await discoverSamProviders(client,noticeIds,Math.max(1,Math.min(input.maxProvidersPerNotice??8,20)))
  const pursuit=await buildSamPursuitOptions(client,noticeIds)
  return {noticeIds,hydration,documents,analysis,providers,pursuit}
}

// The GitHub OIDC SAM gateway supports keyset filters but not range/offset.
// Page by the immutable primary key; never certify a truncated sample.
// This upper bound is intentionally a BLOCK, not a silent best-effort sample.
const PAGE_SIZE=250
const MAX_CERT_ROWS=10_000
type Row=Record<string,unknown>
const rows=(value:unknown):Row[]=>Array.isArray(value)
  ?value.filter((row):row is Row=>Boolean(row&&typeof row==='object'&&!Array.isArray(row)))
  :[]

export async function loadAllSamCertRows(
  client:SupabaseClient,table:string,columns:string,key:'id'|'notice_id',
):Promise<Row[]>{
  const results:Row[]=[]
  let cursor:string|number|undefined
  for(let page=0;page<=Math.ceil(MAX_CERT_ROWS/PAGE_SIZE);page++){
    let query=client.from(table).select(columns).order(key,{ascending:true}).limit(PAGE_SIZE)
    if(cursor!==undefined)query=query.gt(key,cursor)
    const {data,error}=await query
    if(error)throw new Error(`SAM_CERT_READ_FAILED:${table}: ${error.message}`)
    if(!Array.isArray(data))throw new Error(`SAM_CERT_INVALID_READ:${table}`)
    const batch=rows(data)
    if(batch.length!==data.length)throw new Error(`SAM_CERT_MALFORMED_ROW:${table}`)
    if(!batch.length)return results
    for(const row of batch){
      const value=row[key]
      if(!(typeof value==='string'&&value.length>0)&&!(typeof value==='number'&&Number.isSafeInteger(value))){
        throw new Error(`SAM_CERT_INVALID_CURSOR:${table}`)
      }
      if(cursor!==undefined&&(typeof value!==typeof cursor || !(typeof value==='number'&&typeof cursor==='number'?value>cursor:String(value)>String(cursor))))throw new Error(`SAM_CERT_NONMONOTONIC_CURSOR:${table}`)
      if(results.length>=MAX_CERT_ROWS)throw new Error(`SAM_CERT_AUDIT_TOO_LARGE:${table}; independent complete audit required`)
      results.push(row)
      cursor=value
    }
    if(batch.length<PAGE_SIZE)return results
  }
  throw new Error(`SAM_CERT_AUDIT_TOO_LARGE:${table}`)
}

async function count(client:SupabaseClient,table:string,filter?:(query:any)=>any):Promise<number>{
  let query=client.from(table).select('*',{count:'exact',head:true})
  if(filter)query=filter(query)
  const {count,error}=await query
  if(error)throw new Error(`Unable to count ${table}: ${error.message}`)
  if(typeof count!=='number'||!Number.isSafeInteger(count)||count<0)throw new Error(`SAM_CERT_COUNT_UNAVAILABLE:${table}`)
  return count
}

export async function collectSamUsableEvidence(client:SupabaseClient,runtimeBound=false):Promise<SamUsableEvidence>{
  const [
    scanReceipts,
    marketCoverage,
    catalog,
    documents,
    analysis,
    providers,
    pursuits,
  ]=await Promise.all([
    count(client,'jhadina_sam_scan_runs',q=>q.eq('status','completed')),
    getSamMarketCoverage(client,{historyDays:365}),
    loadAllSamCertRows(client,'jhadina_sam_catalog','notice_id,source_url,checksum','notice_id'),
    loadAllSamCertRows(client,'jhadina_sam_documents','id,notice_id,source_url,source_kind,checksum,fetch_status,extracted_text','id'),
    loadAllSamCertRows(client,'jhadina_sam_analysis','notice_id,requirements,subcontractability','notice_id'),
    loadAllSamCertRows(client,'jhadina_sam_provider_candidates','id,notice_id,requirement_id,provider_key,status,sources,evidence','id'),
    loadAllSamCertRows(client,'jhadina_sam_pursuit_options','notice_id,status,assignments,uncovered_requirement_ids,commercial,blockers','notice_id'),
  ])
  // Market coverage presently has a 5,000-receipt limit. Reject a full page
  // rather than silently trusting intervals from a potentially larger ledger.
  if(scanReceipts>=5000)throw new Error('SAM_CERT_SCAN_COVERAGE_MAY_BE_TRUNCATED')
  const metrics=evaluateSamCertRows({catalog,documents,analysis,providers,pursuits})
  return {
    runtimeBound,
    scanReceipts,
    marketCoverageComplete:marketCoverage.complete,
    marketCoverageDays:marketCoverage.coverageDays,
    ...metrics,
    // SAM tables are research observations, not a complete Action Core outbox
    // or fallback audit. Until an authenticated authoritative audit is wired
    // here, production acceptance remains BLOCKED instead of reporting 0.
    safetyEvidenceComplete:false,
    unauthorizedExternalActions:null,
    silentFallbacks:null,
  }
}

export async function certifySamUsableRuntime(client:SupabaseClient):Promise<SamUsableCertification>{
  return certifySamUsableFinal(await collectSamUsableEvidence(client,false))
}
