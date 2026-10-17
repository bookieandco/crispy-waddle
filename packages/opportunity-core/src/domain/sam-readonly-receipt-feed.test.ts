import assert from 'node:assert/strict'
import {
  createSamHttpsGetReceiptReader,loadSamReceiptObservation,
  type SamReceiptPage,type SamReceiptPageReader,
} from './sam-readonly-receipt-feed.js'
import type {SamExternalReceipt} from './sam-external-safety-audit.js'

const window={from:'2026-10-17T00:00:00.000Z',through:'2026-10-17T23:59:59.000Z'}
const make=(id:string):SamExternalReceipt=>({
  id,operationId:'operation:'+id,source:'provider_transport',surface:'provider_outreach',
  status:'completed',observedAt:'2026-10-17T12:00:00.000Z',
  authorizationId:'approval:'+id,externalRef:'msg:'+id,destinationRef:'provider@example.test',
})
const first=():SamReceiptPage=>({source:'provider_transport',window,snapshotId:'stable:A',
  totalCount:3,receipts:[make('1'),make('2')],nextCursor:'after-2',readOnly:true})
const second=():SamReceiptPage=>({source:'provider_transport',window,snapshotId:'stable:A',
  totalCount:3,receipts:[make('3')],nextCursor:null,readOnly:true})
const run=async(reader:SamReceiptPageReader)=>loadSamReceiptObservation({
  source:'provider_transport',window,readPage:reader,pageSize:2,
})
const successful=await run(async ({cursor})=>cursor?second():first())
assert.equal(successful.totalCount,3)
assert.equal(successful.observedPages,2)
assert.equal(successful.receipts.length,3)
assert.equal(successful.internallyConsistent,true)
assert.equal(successful.independentlyVerified,false)
assert.equal(successful.productionAuthority,false)
for(const [label,mutate] of [
  ['source', (p:SamReceiptPage)=>{p.source='payment_processor'}],
  ['snapshot', (p:SamReceiptPage)=>{p.snapshotId='changed'}],
  ['count', (p:SamReceiptPage)=>{p.totalCount=4}],
  ['duplicate', (p:SamReceiptPage)=>{p.receipts=[make('2')]}],
  ['missing row', (p:SamReceiptPage)=>{p.receipts=[]}],
  ['invalid window', (p:SamReceiptPage)=>{p.window={...window,from:'2026-10-16T00:00:00Z'}}],
  ['write claim', (p:SamReceiptPage)=>{p.readOnly=false as true}],
  ['wrong identity', (p:SamReceiptPage)=>{p.receipts=[{...make('3'),source:'payment_processor'}]}],
  ['out-of-window', (p:SamReceiptPage)=>{p.receipts=[{...make('3'),observedAt:'2026-09-01T00:00:00Z'}]}],
] as const){
  const pages=async ({cursor}:Parameters<SamReceiptPageReader>[0])=>{
    const p=cursor?second():first()
    if(cursor)mutate(p)
    return p
  }
  await assert.rejects(run(pages),{name:'SamReadOnlyReceiptError'},label)
}
await assert.rejects(run(async ({cursor})=>cursor?{...second(),receipts:[make('3')],nextCursor:'after-2'}:first()),/SAM_RECEIPT_CURSOR_LOOP/)
await assert.rejects(run(async ({cursor})=>cursor?{...second(),receipts:[],nextCursor:null}:first()),/SAM_RECEIPT_AUDIT_INCOMPLETE/)
await assert.rejects(loadSamReceiptObservation({source:'provider_transport',
  window:{from:'2026-10-01T00:00:00Z',through:'2026-10-17T00:00:00Z'},
  readPage:async()=>first()}),/SAM_RECEIPT_WINDOW_INVALID/)
await assert.rejects(loadSamReceiptObservation({source:'provider_transport',window,
  readPage:async()=>({...first(),totalCount:5001}),maxRecords:5000}),/SAM_RECEIPT_AUDIT_TOO_LARGE/)
await assert.rejects(loadSamReceiptObservation({source:'provider_transport',window,
  readPage:async()=>first(),pageSize:251}),/SAM_RECEIPT_LIMIT_INVALID/)

// HTTPS-only fixed origin and GET-only transport. No credentials, redirects or writes.
assert.throws(()=>createSamHttpsGetReceiptReader({trustedOrigin:'http://example.test',pathname:'/v1/receipts'}),/SAM_RECEIPT_ORIGIN_INVALID/)
assert.throws(()=>createSamHttpsGetReceiptReader({trustedOrigin:'https://user:pass@example.test',pathname:'/v1/receipts'}),/SAM_RECEIPT_ORIGIN_INVALID/)
assert.throws(()=>createSamHttpsGetReceiptReader({trustedOrigin:'https://example.test',pathname:'//another.test'}),/SAM_RECEIPT_PATH_INVALID/)
const calls:Array<{url:string;init:RequestInit}>=[]
const reader=createSamHttpsGetReceiptReader({
  trustedOrigin:'https://receipts.example.test',pathname:'/v1/receipts',
  fetcher:async (url,init)=>{
    calls.push({url:String(url),init:init as RequestInit})
    return new Response(JSON.stringify({...first(),receipts:[],totalCount:0,nextCursor:null}),{
      headers:{'content-type':'application/json'},
    })
  },
})
const data=await reader({source:'provider_transport',window,cursor:null,limit:100})
assert.equal(data.readOnly,true)
assert.equal(calls[0].init.method,'GET')
assert.equal(calls[0].init.redirect,'error')
assert.equal(calls[0].init.credentials,'omit')
assert.equal(new URL(calls[0].url).origin,'https://receipts.example.test')
assert.equal(new URL(calls[0].url).searchParams.get('source'),'provider_transport')
console.log('SAM-SAFETY-LEDGER.12–.13 read-only feed tests passed')
