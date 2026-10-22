import { createHash } from 'node:crypto'
import type { Opportunity, OpportunityPilotSourceCheck } from '@jhadina/opportunity-core'

type PublicResponse={
  ok:boolean
  status:number
  headers:{get(name:string):string|null}
  body:ReadableStream<Uint8Array>|null
}
type PublicFetch=(url:string,options:{redirect:'error';cache:'no-store';headers:Record<string,string>;signal:AbortSignal})=>Promise<PublicResponse>
export type VerifiedPublicExcerpt={
  evidenceId:string
  sourceUrl:string
  contentSha256:string
  confirmedExcerpt:string
  observedAt:string
  sourceType:'PUBLIC_SOURCE_CONTENT'
  externalActionAuthorized:false
}
const MAX_BYTES=1_000_000
function allowedUrl(raw:string,allowedHosts:readonly string[]):URL{
  const url=new URL(raw)
  const host=url.hostname.toLowerCase()
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||
    !/^[a-z0-9.-]+$/.test(host)||!host.includes('.')||
    host.endsWith('.internal')||host.endsWith('.local')||host==='localhost'||
    /^(127|0|10|192\.168|169\.254)\./.test(host)||/^[0-9.]+$/.test(host)||
    !allowedHosts.includes(host))throw Error('OCE_SOURCE_HOST_NOT_APPROVED')
  return url
}
async function boundedText(body:ReadableStream<Uint8Array>):Promise<string>{
  const reader=body.getReader()
  let n=0
  const parts:Uint8Array[]=[]
  while(true){
    const x=await reader.read()
    if(x.done)break
    n+=x.value.byteLength
    if(n>MAX_BYTES){await reader.cancel().catch(()=>undefined);throw Error('OCE_SOURCE_TOO_LARGE')}
    parts.push(x.value)
  }
  const b=new Uint8Array(n)
  let offset=0
  for(const part of parts){b.set(part,offset);offset+=part.byteLength}
  return new TextDecoder('utf-8',{fatal:true}).decode(b)
}
function readable(value:string):string{
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ')
    .replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"')
    .replace(/\s+/g,' ').trim().toLocaleLowerCase('en-US')
}
/**
 * COMMISSION.14: actually refetch owner-allowlisted sources before drafting.
 * An excerpt appearing on a public page is provenance evidence, NOT fact-checking
 * and NOT a customer acceptance or income receipt.
 */
export async function verifyCanonicalPublicExcerpts(input:{
  opportunity:Opportunity
  allowedHosts:string[]
  now:string
  maxSources?:number
},fetcher:PublicFetch=fetch as unknown as PublicFetch):Promise<{
  observations:OpportunityPilotSourceCheck[]
  sourceReceipts:VerifiedPublicExcerpt[]
  blockers:string[]
}>{
  const time=Date.parse(input.now)
  if(!Number.isFinite(time))throw Error('OCE_INVALID_VERIFICATION_TIME')
  const observations:OpportunityPilotSourceCheck[]=[]
  const sourceReceipts:VerifiedPublicExcerpt[]=[]
  const blockers:string[]=[]
  const hosts=input.allowedHosts.map(x=>x.trim().toLowerCase()).filter(Boolean)
  if(hosts.length===0)return {observations,sourceReceipts,blockers:['OCE_APPROVED_SOURCE_HOSTS_REQUIRED']}
  const cap=Math.min(5,Math.max(1,input.maxSources??5))
  for(const evidence of input.opportunity.evidence.slice(0,cap)){
    if(!evidence.excerpt||evidence.excerpt.trim().length<10||!['official','secondary'].includes(evidence.sourceType)){
      blockers.push('Source excerpt missing or not attributable: '+evidence.id)
      continue
    }
    try{
      const url=allowedUrl(evidence.sourceUrl,hosts)
      const resp=await fetcher(url.toString(),{
        headers:{accept:'text/html,text/plain;q=0.9','user-agent':'Jhadina-Opportunity-Research/1.0'},
        cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000),
      })
      if(!resp.ok||!resp.body)throw Error('OCE_SOURCE_HTTP_UNAVAILABLE:'+resp.status)
      const type=resp.headers.get('content-type')??''
      if(!/^text\/(html|plain)/i.test(type))throw Error('OCE_UNSUPPORTED_SOURCE_MEDIA')
      const reported=Number(resp.headers.get('content-length'))
      if(Number.isFinite(reported)&&reported>MAX_BYTES)throw Error('OCE_SOURCE_TOO_LARGE')
      const body=await boundedText(resp.body)
      if(!readable(body).includes(readable(evidence.excerpt)))throw Error('OCE_EXCERPT_NOT_FOUND_IN_SOURCE')
      const hash=createHash('sha256').update(body).digest('hex')
      const captured=Date.parse(evidence.capturedAt)
      if(!Number.isFinite(captured)||captured>time)throw Error('OCE_CANONICAL_CAPTURE_TIME_INVALID')
      // Keep canonical capture time for exact source-bound admission.
      const observation={
        id:'source-recheck:'+evidence.id,opportunityId:input.opportunity.id,
        sourceUrl:evidence.sourceUrl,evidenceId:evidence.id,excerpt:evidence.excerpt,
        observedAt:evidence.capturedAt,reviewedByOwner:true,
      }
      observations.push(observation)
      sourceReceipts.push({
        evidenceId:evidence.id,sourceUrl:evidence.sourceUrl,
        contentSha256:hash,confirmedExcerpt:evidence.excerpt,
        observedAt:input.now,sourceType:'PUBLIC_SOURCE_CONTENT',externalActionAuthorized:false,
      })
    }catch(error){
      blockers.push(evidence.id+': '+(error instanceof Error?error.message:'OCE_SOURCE_UNAVAILABLE'))
    }
  }
  return {observations,sourceReceipts,blockers}
}
