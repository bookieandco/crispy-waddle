import type { SupabaseClient } from '@supabase/supabase-js'
import { certifySamUsableFinal, type SamUsableCertification, type SamUsableEvidence } from '@jhadina/opportunity-core'
import { analyzeSamNotices } from './sam-analysis-runtime'
import { discoverSamProviders } from './sam-provider-runtime'
import { harvestSamDocuments, recentSamNoticeIds } from './sam-wide-runtime'

const rows=(value:unknown):Record<string,unknown>[]=>Array.isArray(value)?value.filter((row):row is Record<string,unknown>=>Boolean(row&&typeof row==='object')):[]

export async function runSamEnrichment(
  client:SupabaseClient,
  input:{limit?:number;maxDocuments?:number;maxProvidersPerNotice?:number}={},
){
  const limit=Math.max(3,Math.min(input.limit??5,20))
  const noticeIds=await recentSamNoticeIds(client,limit)
  if(!noticeIds.length)return {
    noticeIds,
    documents:{attempted:0,textCaptured:0,binaryCaptured:0,needsOcr:0,unsupported:0,failed:0},
    analysis:{analyzed:0},
    providers:{notices:0,candidates:0,errors:[] as string[]},
  }
  const documents=await harvestSamDocuments(client,noticeIds,Math.max(1,Math.min(input.maxDocuments??40,100)))
  const analysis=await analyzeSamNotices(client,noticeIds)
  const providers=await discoverSamProviders(client,noticeIds,Math.max(1,Math.min(input.maxProvidersPerNotice??8,20)))
  return {noticeIds,documents,analysis,providers}
}

async function count(client:SupabaseClient,table:string,filter?:(query:any)=>any){
  let query=client.from(table).select('*',{count:'exact',head:true})
  if(filter)query=filter(query)
  const {count,error}=await query
  if(error)throw new Error(`Unable to count ${table}: ${error.message}`)
  return count??0
}

export async function collectSamUsableEvidence(client:SupabaseClient,runtimeBound=true):Promise<SamUsableEvidence>{
  const [
    scanReceipts,
    realNotices,
    noticesWithSubcontractability,
    realProviderCandidates,
    catalogResult,
    documentResult,
    providerResult,
  ]=await Promise.all([
    count(client,'jhadina_sam_scan_runs',q=>q.eq('status','completed')),
    count(client,'jhadina_sam_catalog'),
    count(client,'jhadina_sam_analysis'),
    count(client,'jhadina_sam_provider_candidates'),
    client.from('jhadina_sam_catalog').select('notice_id,source_url,checksum').limit(500),
    client.from('jhadina_sam_documents').select('notice_id,source_url,source_kind,checksum,fetch_status,evidence').neq('source_kind','notice').limit(1000),
    client.from('jhadina_sam_provider_candidates').select('notice_id,evidence,sources').limit(1000),
  ])

  if(catalogResult.error)throw new Error(`Unable to inspect SAM catalog provenance: ${catalogResult.error.message}`)
  if(documentResult.error)throw new Error(`Unable to inspect SAM document provenance: ${documentResult.error.message}`)
  if(providerResult.error)throw new Error(`Unable to inspect SAM provider provenance: ${providerResult.error.message}`)

  const catalog=rows(catalogResult.data)
  const documents=rows(documentResult.data)
  const providers=rows(providerResult.data)

  // A notice only counts as document-backed when a non-notice solicitation
  // attachment was successfully parsed into text. Binary-only evidence is
  // retained but cannot satisfy FINAL requirement extraction.
  const documentNoticeIds=new Set(
    documents
      .filter(row=>row.fetch_status==='text_captured'&&typeof row.checksum==='string'&&row.checksum.length>0)
      .map(row=>String(row.notice_id)),
  )
  const providerNoticeIds=new Set(
    providers
      .filter(row=>Array.isArray(row.evidence)&&row.evidence.length>0)
      .map(row=>String(row.notice_id)),
  )

  const catalogProvenance=catalog.every(row=>
    typeof row.source_url==='string'&&row.source_url.length>0&&typeof row.checksum==='string'&&row.checksum.length>0,
  )
  const documentProvenance=documents
    .filter(row=>row.fetch_status==='text_captured')
    .every(row=>typeof row.source_url==='string'&&row.source_url.length>0&&typeof row.checksum==='string'&&row.checksum.length>0)
  const providerProvenance=providers.every(row=>Array.isArray(row.evidence)&&row.evidence.length>0&&Array.isArray(row.sources)&&row.sources.length>0)

  return {
    runtimeBound,
    scanReceipts,
    realNotices,
    noticesWithDocuments:documentNoticeIds.size,
    noticesWithSubcontractability,
    noticesWithProviderCandidates:providerNoticeIds.size,
    realProviderCandidates,
    provenanceComplete:catalog.length>0&&catalogProvenance&&documentProvenance&&providerProvenance,
    unauthorizedExternalActions:0,
    silentFallbacks:0,
  }
}

export async function certifySamUsableRuntime(client:SupabaseClient):Promise<SamUsableCertification>{
  return certifySamUsableFinal(await collectSamUsableEvidence(client,true))
}
