import { createHash } from 'node:crypto'
import { persistSamCatalogBatches } from './sam-gateway-batches'
import { reconcileSamObservedHistory } from './sam-history-recovery'
import type { SupabaseClient } from '@supabase/supabase-js'
import { classifySamNoticeChange, computeSamMarketCoverage, nextSamBootstrapWindow, normalizeSamWideNotice, type SamCoverageInterval, type SamMarketCoverage, type SamWideNotice } from '@jhadina/opportunity-core'
import { scanSamOpportunityWindow, searchSamOpportunities } from './sam-client'
import { extractSamAttachmentText } from './sam-document-extractor'
import { classifySamDocumentLink, readBoundedSamDocument } from './sam-document-resource'
import { getSamApiKey } from './sam-config'
import { certifySamBulkCoverageRange, samBulkPostedDay, samBulkRowToApiNotice, streamSamBulkRows } from './sam-bulk-client'

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
  source?:{kind:'api'|'bulk_snapshot';url?:string;sha256?:string;bytes?:number;sourceRows?:number;snapshotAt?:string}
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
  const {data:run,error:runError}=await client.from('jhadina_sam_scan_runs').insert({posted_from:input.postedFrom,posted_to:input.postedTo,status:'running',source_kind:'api',started_at:started}).select('id').single()
  if(runError||!run)throw new Error(`Unable to create SAM scan receipt: ${runError?.message??'no row'}`)
  const runId=Number((run as {id:number}).id)
  const receipt:SamWideScanReceipt={runId,status:'completed',postedFrom:input.postedFrom,postedTo:input.postedTo,pages:0,totalRecords:0,seenRecords:0,newRecords:0,amendedRecords:0,unchangedRecords:0,resourceLinks:0,changedNoticeIds:[],errors:[],source:{kind:'api'}}
  try{
    const result=await scanSamOpportunityWindow({postedFrom:input.postedFrom,postedTo:input.postedTo,pageSize:input.pageSize??1000,maxPages:input.maxPages??20})
    receipt.pages=result.pages;receipt.totalRecords=result.totalRecords;receipt.seenRecords=result.opportunities.length
    if(result.truncated)throw new Error(`SAM_SCAN_WINDOW_TRUNCATED:${result.opportunities.length}/${result.totalRecords}`)
    const notices=result.opportunities.map(raw=>normalizeSamWideNotice(raw,new Date().toISOString()))
    receipt.resourceLinks=notices.reduce((n,row)=>n+row.resourceLinks.length,0)
    for(let start=0;start<notices.length;start+=250){
      const chunk=notices.slice(start,start+250)
      const ids=chunk.map(x=>x.noticeId)
      const {data:existingRows,error:existingError}=await client.from('jhadina_sam_catalog').select('notice_id,checksum,version').in('notice_id',ids)
      if(existingError)throw new Error(`Unable to read SAM catalog: ${existingError.message}`)
      await reconcileSamObservedHistory(client, rows(existingRows) as Existing[], { write: true })
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
      await persistSamCatalogBatches(client,upserts,versions)
    }
  }catch(error){
    receipt.status='failed';receipt.errors.push(error instanceof Error?error.message:'SAM scan failed')
  }
  const {error:receiptError}=await client.from('jhadina_sam_scan_runs').update({status:receipt.status,pages:receipt.pages,total_records:receipt.totalRecords,seen_records:receipt.seenRecords,new_records:receipt.newRecords,amended_records:receipt.amendedRecords,unchanged_records:receipt.unchangedRecords,resource_links:receipt.resourceLinks,errors:receipt.errors,completed_at:new Date().toISOString()}).eq('id',runId)
  if(receiptError)throw new Error(`Unable to persist SAM scan receipt: ${receiptError.message}; original_status=${receipt.status}; original_error=${receipt.errors.join('; ')}`)
  if(receipt.status==='failed')throw new Error(receipt.errors.join('; '))
  return receipt
}


async function persistSamNoticeChunk(client:SupabaseClient,chunk:SamWideNotice[],receipt:SamWideScanReceipt){
  if(!chunk.length)return
  const ids=chunk.map(x=>x.noticeId)
  const {data:existingRows,error:existingError}=await client.from('jhadina_sam_catalog').select('notice_id,checksum,version').in('notice_id',ids)
  if(existingError)throw new Error(`Unable to read SAM catalog: ${existingError.message}`)
  await reconcileSamObservedHistory(client, rows(existingRows) as Existing[], { write: true })
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
  await persistSamCatalogBatches(client,upserts,versions)
}

export async function runSamBulkSnapshotScan(
  client:SupabaseClient,
  input:{targetFrom:string;targetTo:string;sourceUrl?:string},
):Promise<SamWideScanReceipt>{
  const started=new Date().toISOString()
  const {data:run,error:runError}=await client.from('jhadina_sam_scan_runs').insert({
    posted_from:input.targetFrom,
    posted_to:input.targetTo,
    status:'running',
    scan_kind:'backfill',
    source_kind:'bulk_snapshot',
    started_at:started,
  }).select('id').single()
  if(runError||!run)throw new Error(`Unable to create SAM bulk scan receipt: ${runError?.message??'no row'}`)
  const runId=Number((run as {id:number}).id)
  const receipt:SamWideScanReceipt={
    runId,
    status:'completed',
    postedFrom:input.targetFrom,
    postedTo:input.targetTo,
    pages:0,
    totalRecords:0,
    seenRecords:0,
    newRecords:0,
    amendedRecords:0,
    unchangedRecords:0,
    resourceLinks:0,
    changedNoticeIds:[],
    errors:[],
    source:{kind:'bulk_snapshot'},
  }
  const noticeIds=new Set<string>()
  let sourceMinDay:string|null=null
  let sourceMaxDay:string|null=null
  let pending:SamWideNotice[]=[]
  const flush=async()=>{
    if(!pending.length)return
    const chunk=pending
    pending=[]
    await persistSamNoticeChunk(client,chunk,receipt)
  }

  try{
    const capturedAt=new Date().toISOString()
    const snapshot=await streamSamBulkRows({
      sourceUrl:input.sourceUrl,
      onRow:async row=>{
        const postedDay=samBulkPostedDay(row)
        if(postedDay){
          if(!sourceMinDay||postedDay<sourceMinDay)sourceMinDay=postedDay
          if(!sourceMaxDay||postedDay>sourceMaxDay)sourceMaxDay=postedDay
        }
        if(!postedDay||postedDay<input.targetFrom||postedDay>input.targetTo)return
        const notice=normalizeSamWideNotice(samBulkRowToApiNotice(row),capturedAt)
        if(noticeIds.has(notice.noticeId))throw new Error(`SAM_BULK_DUPLICATE_NOTICE:${notice.noticeId}`)
        noticeIds.add(notice.noticeId)
        receipt.seenRecords+=1
        receipt.resourceLinks+=notice.resourceLinks.length
        pending.push(notice)
        if(pending.length>=250)await flush()
      },
    })
    await flush()

    if(receipt.seenRecords<1)throw new Error('SAM_BULK_TARGET_WINDOW_EMPTY')
    if(!sourceMinDay||!sourceMaxDay)throw new Error('SAM_BULK_POSTED_DATE_RANGE_MISSING')
    const coverageRange=certifySamBulkCoverageRange({
      targetFrom:input.targetFrom,
      targetTo:input.targetTo,
      sourceMinDay,
      sourceMaxDay,
      lastModified:snapshot.lastModified,
    })
    if(!coverageRange)throw new Error('SAM_BULK_SNAPSHOT_DOES_NOT_COVER_TARGET')
    receipt.postedFrom=coverageRange.from
    receipt.postedTo=coverageRange.to
    receipt.pages=1
    receipt.totalRecords=receipt.seenRecords
    receipt.source={
      kind:'bulk_snapshot',
      url:snapshot.sourceUrl,
      sha256:snapshot.sha256,
      bytes:snapshot.bytes,
      sourceRows:snapshot.sourceRows,
      snapshotAt:snapshot.lastModified,
    }
  }catch(error){
    receipt.status='failed'
    receipt.errors.push(error instanceof Error?error.message:'SAM bulk scan failed')
  }

  const {error:receiptError}=await client.from('jhadina_sam_scan_runs').update({
    posted_from:receipt.postedFrom,
    posted_to:receipt.postedTo,
    status:receipt.status,
    source_kind:'bulk_snapshot',
    source_url:receipt.source?.url??null,
    source_sha256:receipt.source?.sha256??null,
    source_bytes:receipt.source?.bytes??null,
    source_rows:receipt.source?.sourceRows??null,
    source_snapshot_at:receipt.source?.snapshotAt??null,
    pages:receipt.pages,
    total_records:receipt.totalRecords,
    seen_records:receipt.seenRecords,
    new_records:receipt.newRecords,
    amended_records:receipt.amendedRecords,
    unchanged_records:receipt.unchangedRecords,
    resource_links:receipt.resourceLinks,
    errors:receipt.errors,
    completed_at:new Date().toISOString(),
  }).eq('id',runId)
  if(receiptError)throw new Error(`Unable to persist SAM bulk receipt: ${receiptError.message}; original_status=${receipt.status}; original_error=${receipt.errors.join('; ')}`)

  if(receipt.status==='failed')throw new Error(receipt.errors.join('; '))
  return receipt
}

function allowedResource(url:string){return classifySamDocumentLink(url)!=='blocked'}
const sourceKind=(url:string)=>{
  const p=new URL(url).pathname.toLowerCase()
  if(p.endsWith('.pdf'))return'pdf'
  if(p.endsWith('.docx'))return'docx'
  if(p.endsWith('.xlsx')||p.endsWith('.xls'))return'xlsx'
  if(p.endsWith('.csv'))return'csv'
  if(p.endsWith('.zip'))return'zip'
  return'attachment'
}
function authorizedSamUrl(rawUrl:string){
  const url=new URL(rawUrl)
  const host=url.hostname.toLowerCase()
  if((host==='api.sam.gov'||host==='api-alpha.sam.gov')&&!url.searchParams.has('api_key')){
    const apiKey=getSamApiKey()
    if(!apiKey)throw new Error('SAM_GOV_ATTACHMENT_CREDENTIAL_UNAVAILABLE')
    url.searchParams.set('api_key',apiKey)
  }
  return url
}
async function fetchGovernmentResource(rawUrl:string){
  if(classifySamDocumentLink(rawUrl)!=='file')throw new Error('RESOURCE_IS_NOT_A_DOCUMENT')
  const response=await fetch(authorizedSamUrl(rawUrl),{
    method:'GET',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20_000),
  })
  if(response.status>=300&&response.status<400){
    await response.body?.cancel().catch(()=>undefined)
    throw new Error('RESOURCE_REDIRECT_NOT_ALLOWED')
  }
  if(!response.ok){
    await response.body?.cancel().catch(()=>undefined)
    throw new Error(`RESOURCE_HTTP_${response.status}`)
  }
  return response
}
function isHttpUrl(value:string){
  try{const url=new URL(value);return url.protocol==='https:'||url.protocol==='http:'}catch{return false}
}

export async function harvestSamDocuments(client:SupabaseClient,noticeIds:string[],maxDocuments=60){
  const empty={attempted:0,textCaptured:0,binaryCaptured:0,needsOcr:0,unsupported:0,failed:0,referencesSkipped:0}
  if(!noticeIds.length)return empty
  const {data,error}=await client.from('jhadina_sam_catalog')
    .select('notice_id,description,source_url,resource_links').in('notice_id',noticeIds)
  if(error)throw new Error(`Unable to load SAM resources: ${error.message}`)
  const counts={...empty}
  const seen=new Set<string>()
  const limit=Math.max(1,Math.min(Number.isFinite(maxDocuments)?Math.floor(maxDocuments):60,100))
  const persist=async (row:Record<string,unknown>)=>{
    const {error:writeError}=await client.from('jhadina_sam_documents')
      .upsert(row,{onConflict:'notice_id,source_url'})
    if(writeError)throw new Error(`SAM_DOCUMENT_PERSIST_FAILED:${writeError.message}`)
  }
  const consumeFile=async (noticeId:string,url:string,source:'sam_resource_link'|'sam_notice_description')=>{
    if(counts.attempted>=limit)return
    const key=JSON.stringify([noticeId,url])
    if(seen.has(key))return
    seen.add(key)
    counts.attempted+=1
    let row:Record<string,unknown>
    let status:'text_captured'|'needs_ocr'|'binary_captured'|'fetch_failed'|'too_large'='fetch_failed'
    try{
      const response=await fetchGovernmentResource(url)
      const bytes=await readBoundedSamDocument(response,{url})
      const contentType=response.headers.get('content-type')??'application/octet-stream'
      const extraction=extractSamAttachmentText({bytes,contentType,sourceKind:sourceKind(url),url})
      status=extraction.status==='parsed'&&extraction.text?'text_captured':
        extraction.status==='needs_ocr'?'needs_ocr':'binary_captured'
      row={
        notice_id:noticeId,source_url:url,source_kind:'attachment',checksum:sha(bytes),
        content_type:contentType,byte_length:bytes.byteLength,
        extracted_text:extraction.text?.slice(0,1_000_000)??null,fetch_status:status,
        evidence:{source,parser:extraction.parser,parse_status:extraction.status},
        updated_at:new Date().toISOString(),
      }
    }catch(error){
      const reason=error instanceof Error?error.message:'RESOURCE_FETCH_FAILED'
      status=reason==='RESOURCE_TOO_LARGE'?'too_large':'fetch_failed'
      row={
        notice_id:noticeId,source_url:url,source_kind:'attachment',fetch_status:status,
        evidence:{source,error:reason.slice(0,200)},updated_at:new Date().toISOString(),
      }
    }
    // Database errors are outside the fetch/parse catch; failed persistence
    // must never be counted as successful document capture.
    await persist(row)
    if(status==='text_captured')counts.textCaptured+=1
    else if(status==='needs_ocr'){counts.needsOcr+=1;counts.binaryCaptured+=1}
    else if(status==='binary_captured'){counts.unsupported+=1;counts.binaryCaptured+=1}
    else counts.failed+=1
  }

  for(const row of rows(data)){
    const noticeId=String(row.notice_id??'')
    const description=typeof row.description==='string'?row.description.trim():''
    const sourceUrl=typeof row.source_url==='string'?row.source_url:''
    if(!noticeId)throw new Error('SAM_DOCUMENT_NOTICE_ID_MISSING')
    if(description){
      if(isHttpUrl(description)){
        const classification=classifySamDocumentLink(description)
        if(classification==='file')await consumeFile(noticeId,description,'sam_notice_description')
        else if(classification==='reference')counts.referencesSkipped+=1
        else{
          await persist({
            notice_id:noticeId,source_url:description,source_kind:'notice',fetch_status:'blocked_host',
            evidence:{source:'sam_notice_description',reason:'non-government-resource-host'},
            updated_at:new Date().toISOString(),
          })
          counts.failed+=1
        }
      }else{
        const body=new TextEncoder().encode(description)
        await persist({
          notice_id:noticeId,source_url:sourceUrl,source_kind:'notice',checksum:sha(body),
          content_type:'text/plain',byte_length:body.byteLength,extracted_text:description,
          fetch_status:'text_captured',evidence:{source:'sam_notice',parser:'sam_api'},
          updated_at:new Date().toISOString(),
        })
        counts.textCaptured+=1
      }
    }
    const links=Array.isArray(row.resource_links)?
      row.resource_links.filter((v):v is string=>typeof v==='string'&&v.length>0):[]
    for(const url of links){
      const classification=classifySamDocumentLink(url)
      if(classification==='reference'){counts.referencesSkipped+=1;continue}
      if(counts.attempted>=limit)break
      if(classification==='blocked'){
        counts.attempted+=1
        await persist({
          notice_id:noticeId,source_url:url,source_kind:'attachment',fetch_status:'blocked_host',
          evidence:{reason:'non-government-resource-host'},updated_at:new Date().toISOString(),
        })
        counts.failed+=1
        continue
      }
      await consumeFile(noticeId,url,'sam_resource_link')
    }
    if(counts.attempted>=limit)break
  }
  return counts
}

export async function hydrateSamNoticeDetails(client:SupabaseClient,noticeIds:string[]){
  let hydrated=0
  const errors:string[]=[]
  for(const noticeId of noticeIds){
    try{
      const page=await searchSamOpportunities({noticeId,limit:5,offset:0})
      const candidates=Array.isArray(page.opportunitiesData)?page.opportunitiesData:[]
      const raw=candidates.find(row=>String(row.noticeId??row.solicitationNumber??row.contractOpportunityId??'')===noticeId)??candidates[0]
      if(!raw){errors.push(`${noticeId}: detail lookup returned no notice`);continue}
      const notice=normalizeSamWideNotice(raw,new Date().toISOString())
      const hydrationReceipt:SamWideScanReceipt={
        runId:0,status:'completed',postedFrom:'',postedTo:'',pages:1,totalRecords:1,seenRecords:1,
        newRecords:0,amendedRecords:0,unchangedRecords:0,resourceLinks:notice.resourceLinks.length,
        changedNoticeIds:[],errors:[],source:{kind:'api'},
      }
      await persistSamNoticeChunk(client,[notice],hydrationReceipt)
      hydrated+=1
    }catch(error){
      errors.push(`${noticeId}: ${error instanceof Error?error.message:'detail hydration failed'}`)
    }
  }
  return {hydrated,errors}
}

function isSamAttachmentResourceLink(value:string){
  try{
    const url=new URL(value)
    const path=url.pathname.toLowerCase()
    return path.includes('/opportunities/resources/files/')||
      /\.(?:pdf|docx?|xlsx?|csv|txt|rtf|zip)(?:$|\/)/i.test(path)
  }catch{return false}
}

export function rankSamNoticeRows(input:Record<string,unknown>[],limit=10):string[]{
  const bounded=Math.max(1,Math.min(limit,100))
  return input
    .map(row=>{
      const description=typeof row.description==='string'?row.description:''
      const noticeType=typeof row.notice_type==='string'?row.notice_type:''
      const links=Array.isArray(row.resource_links)
        ? row.resource_links.filter((value):value is string=>typeof value==='string'&&value.length>0)
        : []
      const attachmentLinks=links.filter(isSamAttachmentResourceLink).length
      const auxiliaryLinks=Math.max(0,links.length-attachmentLinks)
      // Real solicitation attachments dominate the commissioning score because
      // SAM-USABLE.FINAL deliberately does not count notice text as document
      // evidence. Auxiliary API/search links remain a weak signal only.
      const score=attachmentLinks*1000+auxiliaryLinks*10+
        (/attach|performance work statement|\bpws\b|statement of work|\bsow\b/i.test(description)?40:0)+
        (/solicitation|request for quote|\brfq\b|request for proposal|\brfp\b/i.test(description)?25:0)+
        (/solicitation|combined synopsis|amendment/i.test(noticeType)?15:0)+
        (description.length>=500?5:0)
      return {noticeId:String(row.notice_id??''),score,postedDate:String(row.posted_date??'')}
    })
    .filter(row=>row.noticeId)
    .sort((a,b)=>b.score-a.score||b.postedDate.localeCompare(a.postedDate))
    .slice(0,bounded)
    .map(row=>row.noticeId)
}

export async function recentSamNoticeIds(client:SupabaseClient,limit=10):Promise<string[]>{
  const bounded=Math.max(1,Math.min(limit,100))
  const candidateLimit=Math.max(100,Math.min(1000,bounded*50))
  const fields='notice_id,description,notice_type,resource_links,posted_date'
  // Keep attachment-bearing notices in a separate candidate pool. Hydrated API
  // rows use timestamp-shaped posted_date strings while bulk rows may be
  // date-only; sorting that text before scoring caused hydrated rows to crowd
  // attachment-backed bulk rows out of the old top-50 window.
  const [linkedResult,recentResult]=await Promise.all([
    client.from('jhadina_sam_catalog')
      .select(fields)
      .not('resource_links','eq','[]')
      .order('posted_date',{ascending:false})
      .limit(candidateLimit),
    client.from('jhadina_sam_catalog')
      .select(fields)
      .order('posted_date',{ascending:false})
      .limit(candidateLimit),
  ])
  if(linkedResult.error)throw new Error(`Unable to load attachment-backed SAM notices: ${linkedResult.error.message}`)
  if(recentResult.error)throw new Error(`Unable to load recent SAM notices: ${recentResult.error.message}`)
  const combined=new Map<string,Record<string,unknown>>()
  for(const row of [...rows(linkedResult.data),...rows(recentResult.data)]){
    const noticeId=String(row.notice_id??'')
    if(noticeId&&!combined.has(noticeId))combined.set(noticeId,row)
  }
  return rankSamNoticeRows([...combined.values()],bounded)
}

export async function failStaleSamScanRuns(client:SupabaseClient,olderThanMinutes=90){
  const minutes=Math.max(15,Math.min(Math.floor(olderThanMinutes),24*60))
  const cutoff=new Date(Date.now()-minutes*60_000).toISOString()
  const completedAt=new Date().toISOString()
  const {data,error}=await client.from('jhadina_sam_scan_runs')
    .update({status:'failed',errors:['SAM_SCAN_ORPHANED_PREVIOUS_RUNTIME'],completed_at:completedAt})
    .eq('status','running')
    .lt('started_at',cutoff)
    .select('id')
  if(error)throw new Error(`Unable to reconcile stale SAM scan receipts: ${error.message}`)
  return rows(data).map(row=>Number(row.id)).filter(Number.isFinite)
}


const isoDay=(date:Date)=>date.toISOString().slice(0,10)
const apiDay=(iso:string)=>{
  const match=iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if(!match)throw new Error('Invalid SAM ISO day')
  return `${match[2]}/${match[3]}/${match[1]}`
}
const spanDays=(from:string,to:string)=>{
  const a=new Date(from+'T00:00:00.000Z').getTime()
  const b=new Date(to+'T00:00:00.000Z').getTime()
  return Math.floor((b-a)/86_400_000)+1
}

export async function completedSamScanIntervals(client:SupabaseClient):Promise<SamCoverageInterval[]>{
  const {data,error}=await client
    .from('jhadina_sam_scan_runs')
    .select('posted_from,posted_to')
    .eq('status','completed')
    .order('id',{ascending:true})
    .limit(5000)
  if(error)throw new Error(`Unable to load SAM scan coverage: ${error.message}`)
  return rows(data)
    .filter(row=>typeof row.posted_from==='string'&&typeof row.posted_to==='string')
    .map(row=>({postedFrom:String(row.posted_from),postedTo:String(row.posted_to)}))
}

export async function getSamMarketCoverage(
  client:SupabaseClient,
  input:{historyDays?:number;today?:string}={},
):Promise<SamMarketCoverage>{
  const historyDays=Math.max(1,Math.min(Math.floor(input.historyDays??365),3650))
  const today=input.today??isoDay(new Date())
  const targetEnd=new Date(today+'T00:00:00.000Z')
  if(Number.isNaN(targetEnd.getTime()))throw new Error('Invalid SAM coverage date')
  const targetStart=new Date(targetEnd.getTime()-(historyDays-1)*86_400_000)
  return computeSamMarketCoverage({
    intervals:await completedSamScanIntervals(client),
    targetFrom:isoDay(targetStart),
    targetTo:today,
  })
}

export type SamBootstrapReceipt={
  complete:boolean
  coverage:SamMarketCoverage
  successfulWindows:number
  attempts:number
  receipts:SamWideScanReceipt[]
}

export async function runSamMarketBootstrap(
  client:SupabaseClient,
  input:{
    historyDays?:number
    windowDays?:number
    maxWindows?:number
    maxPages?:number
    pageSize?:number
    today?:string
    source?:'bulk'|'api'
    bulkSourceUrl?:string
  }={},
):Promise<SamBootstrapReceipt>{
  const historyDays=Math.max(1,Math.min(Math.floor(input.historyDays??365),3650))
  const preferredWindowDays=Math.max(1,Math.min(Math.floor(input.windowDays??7),31))
  const maxWindows=Math.max(1,Math.min(Math.floor(input.maxWindows??4),31))
  const maxPages=Math.max(1,Math.min(Math.floor(input.maxPages??20),100))
  const pageSize=Math.max(1,Math.min(Math.floor(input.pageSize??1000),1000))
  const today=input.today??isoDay(new Date())
  let intervals=await completedSamScanIntervals(client)
  let coverage=computeSamMarketCoverage({
    intervals,
    targetFrom:isoDay(new Date(new Date(today+'T00:00:00.000Z').getTime()-(historyDays-1)*86_400_000)),
    targetTo:today,
  })
  const receipts:SamWideScanReceipt[]=[]
  let successfulWindows=0
  let attempts=0
  let activeWindowDays=preferredWindowDays

  if((input.source??'bulk')==='bulk'&&!coverage.complete){
    attempts=1
    const receipt=await runSamBulkSnapshotScan(client,{
      targetFrom:coverage.targetFrom,
      targetTo:coverage.targetTo,
      sourceUrl:input.bulkSourceUrl,
    })
    receipts.push(receipt)
    successfulWindows=1
    intervals.push({postedFrom:receipt.postedFrom,postedTo:receipt.postedTo})
    coverage=computeSamMarketCoverage({
      intervals,
      targetFrom:coverage.targetFrom,
      targetTo:coverage.targetTo,
    })
  }

  while(!coverage.complete&&successfulWindows<maxWindows&&attempts<maxWindows*6){
    const window=nextSamBootstrapWindow({intervals,today,historyDays,windowDays:activeWindowDays})
    if(!window)break
    attempts+=1
    try{
      const receipt=await runSamWideScan(client,{
        postedFrom:apiDay(window.from),
        postedTo:apiDay(window.to),
        maxPages,
        pageSize,
      })
      receipts.push(receipt)
      successfulWindows+=1
      intervals.push({postedFrom:receipt.postedFrom,postedTo:receipt.postedTo})
      activeWindowDays=preferredWindowDays
      coverage=computeSamMarketCoverage({
        intervals,
        targetFrom:coverage.targetFrom,
        targetTo:coverage.targetTo,
      })
    }catch(error){
      const message=error instanceof Error?error.message:String(error)
      if(message.includes('SAM_SCAN_WINDOW_TRUNCATED')&&spanDays(window.from,window.to)>1){
        activeWindowDays=Math.max(1,Math.floor(spanDays(window.from,window.to)/2))
        continue
      }
      // A personal SAM key can be quota-limited for the rest of the UTC day.
      // Keep completed bulk/API coverage durable and leave the uncovered tail
      // as coverage debt instead of discarding progress or falsely completing.
      if(message.includes('429')||message.toLowerCase().includes('throttl'))break
      throw error
    }
  }
  return {complete:coverage.complete,coverage,successfulWindows,attempts,receipts}
}
