/**
 * SAM-SAFETY-LEDGER.18–.20: manual-only read-only production shadow.
 * Does NOT call runSamMarketBootstrap, runSamEnrichment, or any write gateway.
 * Default is fail-closed with zero network receipts; never a production PASS.
 */
import {probeSamShadowDatabase} from '../src/lib/money-opportunities/sam-shadow-gateway-client'
import { createSamHttpsGetReceiptReader, SAM_RECEIPT_SOURCES, type SamReceiptWindow } from '@jhadina/opportunity-core'
import { runSamSafetyShadow, type SamSafetyShadowSource } from '@jhadina/opportunity-core/sam-safety-shadow'
import type { SamReceiptCheckpoint } from '@jhadina/opportunity-core/sam-receipt-checkpoint'

type FeedConfig={
  source:(typeof SAM_RECEIPT_SOURCES)[number]
  receiptOrigin:string
  receiptPath:string
  checkpointOrigin:string
  checkpointPath:string
  signerId:string
}
type KeyConfig={signerId:string;publicKeyPem:string}
const has=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0
const parse=(value:string|undefined,label:string):unknown=>{
  if(!value)throw new Error(label+'_MISSING')
  try{return JSON.parse(value) as unknown}catch{throw new Error(label+'_INVALID_JSON')}
}
const guardedEndpoint=(origin:string,pathname:string):URL=>{
  const url=new URL(origin)
  if(url.protocol!=='https:'||url.username||url.password||
    url.pathname!=='/'||url.search||url.hash||
    !/^\/[a-zA-Z0-9/_-]+$/.test(pathname)||
    pathname.includes('//')||pathname.includes('..')){
    throw new Error('SAM_SHADOW_UNSAFE_ENDPOINT')
  }
  return new URL(pathname,url)
}
function buildSources():SamSafetyShadowSource[]{
  const feeds=parse(process.env.SAM_SHADOW_FEEDS_JSON,'SAM_SHADOW_FEEDS')
  const keys=parse(process.env.SAM_SHADOW_TRUSTED_KEYS_JSON,'SAM_SHADOW_TRUSTED_KEYS')
  if(!Array.isArray(feeds)||!keys||typeof keys!=='object'||Array.isArray(keys)||
    feeds.length!==SAM_RECEIPT_SOURCES.length){
    throw new Error('SAM_SHADOW_SOURCE_ROSTER_INCOMPLETE')
  }
  const rawKeys=keys as Record<string,unknown>
  const seen=new Set<string>()
  return feeds.map(row=>{
    const f=row as FeedConfig
    if(!f||!SAM_RECEIPT_SOURCES.includes(f.source)||seen.has(f.source))throw new Error('SAM_SHADOW_SOURCE_DUPLICATE_OR_INVALID')
    seen.add(f.source)
    const k=rawKeys[f.source] as KeyConfig|undefined
    if(!k||!has(f.signerId)||!has(k.signerId)||f.signerId!==k.signerId||!has(k.publicKeyPem)){
      throw new Error('SAM_SHADOW_OPERATOR_KEY_MISSING_OR_MISMATCHED')
    }
    const receipt=guardedEndpoint(f.receiptOrigin,f.receiptPath)
    const checkpoint=guardedEndpoint(f.checkpointOrigin,f.checkpointPath)
    if(receipt.origin===checkpoint.origin)throw new Error('SAM_SHADOW_CHECKPOINT_MUST_BE_INDEPENDENT_ORIGIN')
    const readPage=createSamHttpsGetReceiptReader({
      trustedOrigin:f.receiptOrigin,pathname:f.receiptPath,
    })
    return {
      source:f.source,
      pinnedSignerId:k.signerId,
      pinnedPublicKeyPem:k.publicKeyPem,
      readPage,
      async readCheckpoint(window:SamReceiptWindow):Promise<SamReceiptCheckpoint>{
        const url=new URL(checkpoint)
        url.searchParams.set('source',f.source)
        url.searchParams.set('from',window.from)
        url.searchParams.set('through',window.through)
        const response=await fetch(url,{
          method:'GET',credentials:'omit',redirect:'error',cache:'no-store',
          headers:{accept:'application/json'},signal:AbortSignal.timeout(20_000),
        })
        if(!response.ok||!response.headers.get('content-type')?.toLowerCase().includes('application/json')){
          throw new Error('SAM_SHADOW_CHECKPOINT_READ_FAILED')
        }
        return await response.json() as SamReceiptCheckpoint
      },
    }
  })
}
type ShadowSummary={
  mode:'read_only_shadow'
  database:'blocked'|'queryable'
  gateway:'blocked'|'responsive'
  receiptFeeds:'not_configured'|'blocked'|'attempted_read_only'
  certification:'blocked'
  blockers:string[]
  sourceResults?:Awaited<ReturnType<typeof runSamSafetyShadow>>['sourceResults']
  verifiedSourceCount?:number
  permissions:{outreach:false;bid:false;sign:false;pay:false}
}
export async function runSamShadowCli():Promise<ShadowSummary>{
  const summary:ShadowSummary={
    mode:'read_only_shadow',database:'blocked',gateway:'blocked',
    receiptFeeds:'not_configured',certification:'blocked',blockers:[],
    permissions:{outreach:false,bid:false,sign:false,pay:false},
  }
  try{
    // Separate OIDC audience and exact workflow identity; the live SAM
    // commissioning gateway intentionally MUST reject this caller.
    await probeSamShadowDatabase()
    summary.gateway='responsive'
    summary.database='queryable'
  }catch(error){
    summary.blockers.push(error instanceof Error?error.message:'SAM_SHADOW_DB_UNAVAILABLE')
    return summary
  }
  if(process.env.SAM_SHADOW_ALLOW_EXTERNAL_READS!=='1'){
    summary.blockers.push('SAM_SHADOW_EXTERNAL_READS_NOT_APPROVED')
    return summary
  }
  let sources:SamSafetyShadowSource[]
  try{sources=buildSources()}catch(error){
    summary.receiptFeeds='blocked'
    summary.blockers.push(error instanceof Error?error.message:'SAM_SHADOW_FEEDS_UNAVAILABLE')
    return summary
  }
  summary.receiptFeeds='attempted_read_only'
  const now=new Date()
  const end=now.toISOString()
  const window:SamReceiptWindow={from:new Date(now.getTime()-86_400_000).toISOString(),through:end}
  try{
    const report=await runSamSafetyShadow({window,sources,verifiedAt:end})
    summary.sourceResults=report.sourceResults
    summary.verifiedSourceCount=report.coverage.verifiedSources.length
    summary.blockers.push(...report.coverage.gaps)
  }catch(error){
    summary.blockers.push(error instanceof Error?error.message:'SAM_SHADOW_INCOMPLETE')
  }
  return summary
}
if(process.env.SAM_SHADOW_CLI==='1'){
  runSamShadowCli().then(result=>{
    console.log(JSON.stringify(result,null,2))
    // Success would imply production certification: always exit nonzero.
    process.exitCode=1
  }).catch(error=>{
    console.error(JSON.stringify({mode:'read_only_shadow',certification:'blocked',
      error:error instanceof Error?error.message:'unexpected_shadow_failure'}))
    process.exitCode=1
  })
}
