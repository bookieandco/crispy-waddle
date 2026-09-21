import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { classifySamNoticeChange, normalizeSamWideNotice, type SamWideNotice } from '@jhadina/opportunity-core'
import { scanSamOpportunityWindow } from './sam-client'
import { extractSamAttachmentText } from './sam-document-extractor'

export type SamWideScanReceipt={
  runId:number
  status:'completed'|'failed'
  postedFrom:string
  postedTo:string
  pages:number
  totalRecords:number
  seenRecords:number
  newRecords:number
  amendedRecords:number
  unchangedRecords:number
  resourceLinks:number
  changedNoticeIds:string[]
  errors:string[]
}

type Existing={notice_id:string;checksum:string;version:number}
const rows=(data:unknown):Record<string,unknown>[]=>Array.isArray(data)?data.filter((x):x is Record<string,unknown>=>Boolean(x&&typeof x==='object')):[]
const sha=(value:Uint8Array|string)=>createHash('sha256').update(value).digest('hex')
const catalogRow=(n:SamWideNotice,version:number)=>({
  notice_id:n.noticeId,solicitation_number:n.solicitationNumber??null,title:n.title,notice_type:n.noticeType??null,
  posted_date:n.postedDate??null,response_deadline:n.responseDeadline??null,naics_codes:n.naicsCodes,
  classification_codes:n.classificationCodes,set_aside:n.setAside??null,agency:n.agency??null,office:n.office??null,
  place_of_performance:n.placeOfPerformance??null,description:n.description??null,source_url:n.sourceUrl,
  resource_links:n.resourceLinks,checksum:n.checksum,version,raw:n.raw,last_seen_at:n.capturedAt,updated_at:n.capturedAt,
})
export async function runSamWideScan(client:SupabaseClient,input:{postedFrom:string;postedTo:string;maxPages?:number;pageSize?:number}):Promise<SamWideScanReceipt>{
  const started=new Date().toISOString()
  const {data:run,error:runError}=await client.from('jhadina_sam_scan_runs').insert({posted_from:input.postedFrom,posted_to:input.postedTo,status:'running',started_at:started}).select('id').single()
  if(runError||!run)throw new Error(`Unable to create SAM scan receipt: ${runError?.message??'no row'}`)
  const runId=Number((run as {id:number}).id)
  const receipt:SamWideScanReceipt={runId,status:'completed',postedFrom:input.postedFrom,postedTo:input.postedTo,pages:0,totalRecords:0,seenRecords:0,newRecords:0,amendedRecords:0,unchangedRecords:0,resourceLinks:0,changedNoticeIds:[],errors:[]}
  try{
    const result=await scanSamOpportunityWindow({postedFrom:input.postedFrom,postedTo:input.postedTo,pageSize:input.pageSize??1000,maxPages:input.maxPages??20})
    receipt.pages=result.pages;receipt.totalRecords=result.totalRecords;receipt.seenRecords=result.opportunities.length
    const notices=result.opportunities.map(raw=>normalizeSamWideNotice(raw,new Date().toISOString()))
    receipt.resourceLinks=notices.reduce((n,row)=>n+row.resourceLinks.length,0)
    for(let start=0;start<notices.length;start+=250){
      const chunk=notices.slice(start,start+250)
      const ids=chunk.map(x=>x.noticeId)
      const {data:existingRows,error:existingError}=await client.from('jhadina_sam_catalog').select('notice_id,checksum,version').in('notice_id',ids)
      if(existingError)throw new Error(`Unable to read SAM catalog: ${existingError.message}`)
      const existing=new Map(rows(existingRows).map(x=>[String(x.notice_id),x as unknown as Existing]))
      const upserts:Array<Record<string,unknown>>=[]
      const versions:Array<Record<string,unknown>>=[]
      for(const notice of chunk){
        const previous=existing.get(notice.noticeId)
        const change=classifySamNoticeChange(previous?.checksum,notice.checksum)
        const version=change==='amended'?(previous?.version??0)+1:previous?.version??1
        if(change==='new')receipt.newRecords+=1
        else if(change==='amended')receipt.amendedRecords+=1
        else receipt.unchangedRecords+=1
        if(change!=='unchanged'){
          receipt.changedNoticeIds.push(notice.noticeId)
          versions.push({notice_id:notice.noticeId,version,checksum:notice.checksum,snapshot:notice.raw,captured_at:notice.capturedAt})
        }
        upserts.push(catalogRow(notice,version))
      }
      const {error:upsertError}=await client.from('jhadina_sam_catalog').upsert(upserts,{onConflict:'notice_id'})
      if(upsertError)throw new Error(`Unable to persist SAM catalog: ${upsertError.message}`)
      if(versions.length){
        const {error:versionError}=await client.from('jhadina_sam_versions').upsert(versions,{onConflict:'notice_id,checksum',ignoreDuplicates:true})
        if(versionError)throw new Error(`Unable to persist SAM versions: ${versionError.message}`)
      }
    }
  }catch(error){
    receipt.status='failed';receipt.errors.push(error instanceof Error?error.message:'SAM scan failed')
  }
  await client.from('jhadina_sam_scan_runs').update({status:receipt.status,pages:receipt.pages,total_records:receipt.totalRecords,seen_records:receipt.seenRecords,new_records:receipt.newRecords,amended_records:receipt.amendedRecords,unchanged_records:receipt.unchangedRecords,resource_links:receipt.resourceLinks,errors:receipt.errors,completed_at:new Date().toISOString()}).eq('id',runId)
  if(receipt.status==='failed')throw new Error(receipt.errors.join('; '))
  return receipt
}

function allowedResource(url:string){
  try{const u=new URL(url);const h=u.hostname.toLowerCase();return u.protocol==='https:'&&(h==='sam.gov'||h.endsWith('.sam.gov')||h.endsWith('.gsa.gov')||h.endsWith('.gov')||h.endsWith('.mil'))}catch{return false}
}
const sourceKind=(url:string)=>{const p=new URL(url).pathname.toLowerCase();if(p.endsWith('.pdf'))return'pdf';if(p.endsWith('.docx'))return'docx';if(p.endsWith('.xlsx')||p.endsWith('.xls'))return'xlsx';if(p.endsWith('.csv'))return'csv';if(p.endsWith('.zip'))return'zip';return'attachment'}

export async function harvestSamDocuments(client:SupabaseClient,noticeIds:string[],maxDocuments=60){
  if(!noticeIds.length)return {attempted:0,textCaptured:0,binaryCaptured:0,needsOcr:0,unsupported:0,failed:0}
  const {data,error}=await client.from('jhadina_sam_catalog').select('notice_id,description,source_url,resource_links').in('notice_id',noticeIds)
  if(error)throw new Error(`Unable to load SAM resources: ${error.message}`)
  let attempted=0,textCaptured=0,binaryCaptured=0,needsOcr=0,unsupported=0,failed=0
  for(const row of rows(data)){
    const noticeId=String(row.notice_id),description=typeof row.description==='string'?row.description:'',sourceUrl=String(row.source_url)
    if(description){
      const body=new TextEncoder().encode(description)
      await client.from('jhadina_sam_documents').upsert({notice_id:noticeId,source_url:sourceUrl,source_kind:'notice',checksum:sha(body),content_type:'text/plain',byte_length:body.byteLength,extracted_text:description,fetch_status:'text_captured',evidence:{source:'sam_notice',parser:'sam_api'},updated_at:new Date().toISOString()},{onConflict:'notice_id,source_url'})
      textCaptured+=1
    }
    const links=Array.isArray(row.resource_links)?row.resource_links.filter((x):x is string=>typeof x==='string'):[]
    for(const url of links){
      if(attempted>=maxDocuments)break
      attempted+=1
      if(!allowedResource(url)){failed+=1;await client.from('jhadina_sam_documents').upsert({notice_id:noticeId,source_url:url,source_kind:'attachment',fetch_status:'blocked_host',evidence:{reason:'non-government-resource-host'},updated_at:new Date().toISOString()},{onConflict:'notice_id,source_url'});continue}
      try{
        const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)})
        const contentType=response.headers.get('content-type')??'application/octet-stream'
        if(!response.ok)throw new Error(`HTTP ${response.status}`)
        const declared=Number(response.headers.get('content-length')??0)
        if(declared>10_000_000){failed+=1;await client.from('jhadina_sam_documents').upsert({notice_id:noticeId,source_url:url,source_kind:sourceKind(url),content_type:contentType,byte_length:declared,fetch_status:'too_large',evidence:{maxBytes:10_000_000},updated_at:new Date().toISOString()},{onConflict:'notice_id,source_url'});continue}
        const bytes=new Uint8Array(await response.arrayBuffer())
        if(bytes.byteLength>10_000_000)throw new Error('RESOURCE_TOO_LARGE')
        const kind=sourceKind(url)
        const extraction=extractSamAttachmentText({bytes,contentType,sourceKind:kind,url})
        const status=extraction.status==='parsed'?'text_captured':extraction.status==='needs_ocr'?'needs_ocr':'binary_captured'
        await client.from('jhadina_sam_documents').upsert({notice_id:noticeId,source_url:url,source_kind:kind,checksum:sha(bytes),content_type:contentType,byte_length:bytes.byteLength,extracted_text:extraction.text?.slice(0,1_000_000)??null,fetch_status:status,evidence:{source:'sam_resource_link',parser:extraction.parser,parse_status:extraction.status},updated_at:new Date().toISOString()},{onConflict:'notice_id,source_url'})
        if(extraction.status==='parsed')textCaptured+=1
        else if(extraction.status==='needs_ocr'){needsOcr+=1;binaryCaptured+=1}
        else{unsupported+=1;binaryCaptured+=1}
      }catch(error){
        failed+=1
        await client.from('jhadina_sam_documents').upsert({notice_id:noticeId,source_url:url,source_kind:sourceKind(url),fetch_status:'fetch_failed',evidence:{error:error instanceof Error?error.message:'fetch failed'},updated_at:new Date().toISOString()},{onConflict:'notice_id,source_url'})
      }
    }
    if(attempted>=maxDocuments)break
  }
  return {attempted,textCaptured,binaryCaptured,needsOcr,unsupported,failed}
}

export async function recentSamNoticeIds(client:SupabaseClient,limit=10):Promise<string[]>{
  const {data,error}=await client.from('jhadina_sam_catalog').select('notice_id').order('last_seen_at',{ascending:false}).limit(Math.max(1,Math.min(limit,100)))
  if(error)throw new Error(`Unable to load recent SAM notices: ${error.message}`)
  return rows(data).map(x=>String(x.notice_id))
}
