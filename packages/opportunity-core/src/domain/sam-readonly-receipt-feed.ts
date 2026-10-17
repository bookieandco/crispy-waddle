import type { SamExternalReceipt, SamExternalSource } from './sam-external-safety-audit.js'

/** SAM-SAFETY-LEDGER.12–.13: source-scoped reader contracts.
 * A caller-supplied feed is untrusted data, not evidence of complete capture.
 * These interfaces cannot send mail, submit bids, or move money.
 */
export const SAM_RECEIPT_SOURCES=[
  'action_core','provider_transport','external_provider','bid_portal',
  'signature_provider','payment_processor','fallback_observer',
] as const satisfies readonly SamExternalSource[]

export type SamReceiptWindow={from:string;through:string}
export type SamReceiptPage={
  source:SamExternalSource
  window:SamReceiptWindow
  snapshotId:string
  totalCount:number
  receipts:SamExternalReceipt[]
  nextCursor:string|null
  readOnly:true
}
export type SamReceiptPageReader=(input:{
  source:SamExternalSource;window:SamReceiptWindow;cursor:string|null;limit:number
})=>Promise<SamReceiptPage>

export type SamReceiptObservation={
  source:SamExternalSource
  window:SamReceiptWindow
  snapshotId:string
  totalCount:number
  receipts:SamExternalReceipt[]
  observedPages:number
  internallyConsistent:true
  independentlyVerified:false
  productionAuthority:false
}
export class SamReadOnlyReceiptError extends Error{
  constructor(public readonly code:string){super(code);this.name='SamReadOnlyReceiptError'}
}
const fail=(code:string):never=>{throw new SamReadOnlyReceiptError(code)}
const good=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0
const iso=(v:string):number=>Date.parse(v)
export function assertSamReceiptWindow(window:SamReceiptWindow):void{
  const start=iso(window.from),end=iso(window.through)
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>end||
    end-start>7*86_400_000)fail('SAM_RECEIPT_WINDOW_INVALID')
}
function validReceipt(r:SamExternalReceipt,source:SamExternalSource,window:SamReceiptWindow):boolean{
  const t=iso(r.observedAt)
  return good(r.id)&&good(r.operationId)&&good(r.observedAt)&&Number.isFinite(t)&&
    t>=iso(window.from)&&t<=iso(window.through)&&r.source===source&&
    ['provider_outreach','federal_bid_submission','contract_signature','money_disbursement','fallback_bypass'].includes(r.surface)&&
    ['attempted','completed','failed'].includes(r.status)&&
    (r.externalRef===undefined||good(r.externalRef))&&
    (r.authorizationId===undefined||good(r.authorizationId))&&
    (r.destinationRef===undefined||good(r.destinationRef))
}

/** Complete and bounded keyset pagination for one immutable provider snapshot.
 * Exact cardinality, source, window, snapshot and per-ID uniqueness are
 * checked. This does not prove source honesty, TLS endpoint trust or off-host
 * checkpoint ownership.
 */
export async function loadSamReceiptObservation(input:{
  source:SamExternalSource
  window:SamReceiptWindow
  readPage:SamReceiptPageReader
  pageSize?:number
  maxRecords?:number
}):Promise<SamReceiptObservation>{
  assertSamReceiptWindow(input.window)
  if(!SAM_RECEIPT_SOURCES.includes(input.source))fail('SAM_RECEIPT_SOURCE_UNKNOWN')
  const pageSize=input.pageSize??100
  const maxRecords=input.maxRecords??5000
  if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>250||
    !Number.isSafeInteger(maxRecords)||maxRecords<1||maxRecords>5000){
    fail('SAM_RECEIPT_LIMIT_INVALID')
  }
  let cursor:string|null=null
  let snapshotId:string|undefined,totalCount:number|undefined
  const seenCursors=new Set<string>()
  const seenIds=new Set<string>()
  const receipts:SamExternalReceipt[]=[]
  let pages=0
  for(;;){
    if(pages>Math.ceil(maxRecords/pageSize)+1)fail('SAM_RECEIPT_PAGE_OVERFLOW')
    const page=await input.readPage({source:input.source,window:input.window,cursor,limit:pageSize})
    pages++
    if(!page||page.readOnly!==true||page.source!==input.source||
      page.window?.from!==input.window.from||page.window?.through!==input.window.through||
      !good(page.snapshotId)||!Number.isSafeInteger(page.totalCount)||page.totalCount<0||
      !Array.isArray(page.receipts)||page.receipts.length>pageSize||
      !(page.nextCursor===null||good(page.nextCursor))){
      fail('SAM_RECEIPT_PAGE_INVALID')
    }
    if(snapshotId!==undefined&&snapshotId!==page.snapshotId)fail('SAM_RECEIPT_SNAPSHOT_CHANGED')
    if(totalCount!==undefined&&totalCount!==page.totalCount)fail('SAM_RECEIPT_TOTAL_CHANGED')
    snapshotId=page.snapshotId
    totalCount=page.totalCount
    if(totalCount>maxRecords)fail('SAM_RECEIPT_AUDIT_TOO_LARGE')
    if(page.nextCursor!==null&&page.receipts.length===0)fail('SAM_RECEIPT_EMPTY_CONTINUATION')
    for(const receipt of page.receipts){
      if(!validReceipt(receipt,input.source,input.window))fail('SAM_RECEIPT_ROW_INVALID')
      if(seenIds.has(receipt.id))fail('SAM_RECEIPT_DUPLICATE_ID')
      seenIds.add(receipt.id)
      if(receipts.length>=maxRecords)fail('SAM_RECEIPT_AUDIT_TOO_LARGE')
      receipts.push(receipt)
    }
    if(receipts.length>totalCount)fail('SAM_RECEIPT_TOTAL_CONTRADICTED')
    if(page.nextCursor===null){
      if(receipts.length!==totalCount)fail('SAM_RECEIPT_AUDIT_INCOMPLETE')
      return {source:input.source,window:input.window,snapshotId,
        totalCount,receipts,observedPages:pages,internallyConsistent:true,
        independentlyVerified:false,productionAuthority:false}
    }
    if(receipts.length===totalCount)fail('SAM_RECEIPT_EXTRA_CURSOR')
    if(seenCursors.has(page.nextCursor))fail('SAM_RECEIPT_CURSOR_LOOP')
    seenCursors.add(page.nextCursor)
    cursor=page.nextCursor
  }
}

/** Fixed HTTPS GET-only endpoint. No dynamic origin/path from page data;
 * no redirects, cookies, uploads, or fallback to an unverified host.
 * Only use a trusted operator-configured endpoint; no endpoint is enabled
 * by default in production.
 */
export function createSamHttpsGetReceiptReader(input:{
  trustedOrigin:string
  pathname:string
  fetcher?:typeof fetch
}):SamReceiptPageReader{
  const origin=new URL(input.trustedOrigin)
  if(origin.protocol!=='https:'||origin.username||origin.password||
    origin.pathname!=='/'||origin.search||origin.hash)fail('SAM_RECEIPT_ORIGIN_INVALID')
  if(!/^\/[a-zA-Z0-9/_-]+$/.test(input.pathname)||input.pathname.includes('//')||
    input.pathname.includes('..'))fail('SAM_RECEIPT_PATH_INVALID')
  const endpoint=new URL(input.pathname,origin)
  if(endpoint.origin!==origin.origin)fail('SAM_RECEIPT_ORIGIN_MISMATCH')
  const fetcher=input.fetcher??fetch
  return async ({source,window,cursor,limit})=>{
    assertSamReceiptWindow(window)
    if(!SAM_RECEIPT_SOURCES.includes(source))fail('SAM_RECEIPT_SOURCE_UNKNOWN')
    const uri=new URL(endpoint)
    uri.searchParams.set('source',source)
    uri.searchParams.set('from',window.from)
    uri.searchParams.set('through',window.through)
    uri.searchParams.set('limit',String(limit))
    if(cursor!==null)uri.searchParams.set('cursor',cursor)
    const response=await fetcher(uri.toString(),{
      method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
      headers:{accept:'application/json'},signal:AbortSignal.timeout(20_000),
    })
    if(!response.ok||!response.headers.get('content-type')?.toLowerCase().includes('application/json')){
      fail('SAM_RECEIPT_HTTP_UNAVAILABLE')
    }
    return await response.json() as SamReceiptPage
  }
}
