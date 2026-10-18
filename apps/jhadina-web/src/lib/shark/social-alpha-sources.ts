import type {SocialObservation} from '@jhadina/social-core'
import {socialObservationToSharkSignal,type AttributedSharkSocialSignal} from './social-signal-bridge'

export type SocialAlphaSource='x'|'reddit'|'bluesky'
export type SocialAlphaPermission=Readonly<{
  source:SocialAlphaSource
  access:'PUBLIC_APPVIEW'|'APPROVED_READ_ONLY'
  termsApproved:boolean
  ownerEnabled:boolean
}>
export type PublicSocialPost=Readonly<{
  id:string
  platform:SocialAlphaSource
  author:string
  text:string
  publishedAt:string
  sourceUrl:string
  upstreamOriginId?:string
  contentFingerprint?:string
}>
export type SocialAlphaBatch=Readonly<{
  source:SocialAlphaSource
  collectedAt:string
  availableAt:string
  signals:readonly AttributedSharkSocialSignal[]
  received:number
  ignored:number
  status:'EVIDENCE_ONLY'
  canTrade:false
}>
const acceptedTime=(v:string)=>Number.isFinite(Date.parse(v))&&/^\d{4}-\d\d-\d\dT/.test(v)
const cleanId=(x:unknown,max=240)=>typeof x==='string'&&x.length>0&&x.length<=max?x:undefined
const str=(x:unknown)=>typeof x==='string'?x:undefined
const publicUrl=(raw:string):boolean=>{
  try{
    const u=new URL(raw)
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&(
      u.hostname==='bsky.app'||u.hostname==='x.com'||u.hostname==='twitter.com'||u.hostname==='reddit.com'||u.hostname==='www.reddit.com')
  }catch{return false}
}
export function admitApprovedSocialAlpha(input:Readonly<{
  permission:SocialAlphaPermission
  posts:readonly PublicSocialPost[]
  collectedAt:string
  availableAt:string
}>):SocialAlphaBatch{
  if(input.permission.termsApproved!==true||input.permission.ownerEnabled!==true||
    (input.permission.source==='bluesky'?input.permission.access!=='PUBLIC_APPVIEW':
      input.permission.access!=='APPROVED_READ_ONLY'))
    throw new Error('shark_social_alpha_access_not_approved')
  if(!acceptedTime(input.collectedAt)||!acceptedTime(input.availableAt)||
    Date.parse(input.availableAt)<Date.parse(input.collectedAt))
    throw new Error('shark_social_alpha_capture_clock_invalid')
  if(input.posts.length>30)throw new Error('shark_social_alpha_batch_limit')
  const signals:AttributedSharkSocialSignal[]=[]
  let ignored=0
  const ids=new Set<string>()
  for(const post of input.posts){
    if(post.platform!==input.permission.source||!cleanId(post.id)||
      !cleanId(post.author)||!acceptedTime(post.publishedAt)||
      Date.parse(post.publishedAt)>Date.parse(input.collectedAt)||
      !publicUrl(post.sourceUrl)||!post.text.trim()||post.text.length>12_000||
      ids.has(post.id)){
      ignored++;continue
    }
    ids.add(post.id)
    const observation:SocialObservation={
      id:post.id,kind:'trend',source:'shark-approved-social-read',
      platform:post.platform,providerProfileId:post.author,contentId:post.id,
      observedAt:post.publishedAt,sourceUrl:post.sourceUrl,
      evidence:[post.text],attributes:{text:post.text},
    }
    const signal=socialObservationToSharkSignal({
      observation,receivedAt:input.collectedAt,availableAt:input.availableAt,
      upstreamOriginId:post.upstreamOriginId,contentFingerprint:post.contentFingerprint,
    })
    if(signal)signals.push(signal)
    else ignored++
  }
  return Object.freeze({
    source:input.permission.source,collectedAt:input.collectedAt,availableAt:input.availableAt,
    signals:Object.freeze(signals),received:input.posts.length,ignored,
    status:'EVIDENCE_ONLY' as const,canTrade:false as const,
  })
}
/** Normalize separately authorized provider results; never obtain credentials here.
 * X/Reddit paid or commercial access is opt-in and supplied by an existing approved connector.
 */
export function normalizeApprovedXPosts(payload:unknown):readonly PublicSocialPost[]{
  const root=payload&&typeof payload==='object'?payload as Record<string,unknown>:{}
  const rows=Array.isArray(root.data)?root.data:[]
  return rows.slice(0,30).flatMap((raw:unknown)=>{
    const row=raw&&typeof raw==='object'?raw as Record<string,unknown>:{}
    const id=cleanId(row.id,40),author=cleanId(row.author_id),text=str(row.text),date=str(row.created_at)
    if(!id||!/^\d+$/.test(id)||!author||!text||!date)return []
    return [{id:'x:'+id,platform:'x' as const,author,text,publishedAt:date,
      sourceUrl:'https://x.com/i/status/'+id}]
  })
}
export function normalizeApprovedRedditPosts(payload:unknown):readonly PublicSocialPost[]{
  const root=payload&&typeof payload==='object'?payload as Record<string,unknown>:{}
  const data=root.data&&typeof root.data==='object'?root.data as Record<string,unknown>:{}
  const rows=Array.isArray(data.children)?data.children:[]
  return rows.slice(0,30).flatMap((raw:unknown)=>{
    const item=raw&&typeof raw==='object'?raw as Record<string,unknown>:{}
    const row=item.data&&typeof item.data==='object'?item.data as Record<string,unknown>:{}
    const id=cleanId(row.id,16),author=cleanId(row.author),title=str(row.title)??'',body=str(row.selftext)??''
    const seconds=row.created_utc,permalink=str(row.permalink)
    if(!id||!/^[a-z0-9]+$/.test(id)||!author||typeof seconds!=='number'||!Number.isSafeInteger(seconds)||
      seconds<=0||!permalink||!/^\/r\/[a-zA-Z0-9_]+\/comments\/[a-z0-9]+\//.test(permalink))return []
    return [{id:'reddit:'+id,platform:'reddit' as const,author,text:(title+'\n'+body).slice(0,12_000),
      publishedAt:new Date(seconds*1000).toISOString(),sourceUrl:'https://www.reddit.com'+permalink}]
  })
}
export function normalizePublicBlueskyPosts(payload:unknown):readonly PublicSocialPost[]{
  const root=payload&&typeof payload==='object'?payload as Record<string,unknown>:{}
  const rows=Array.isArray(root.posts)?root.posts:[]
  return rows.slice(0,30).flatMap((raw:unknown)=>{
    const row=raw&&typeof raw==='object'?raw as Record<string,unknown>:{}
    const author=row.author&&typeof row.author==='object'?row.author as Record<string,unknown>:{}
    const record=row.record&&typeof row.record==='object'?row.record as Record<string,unknown>:{}
    const uri=str(row.uri),did=str(author.did),handle=str(author.handle),text=str(record.text)
    const stamp=str(record.createdAt),indexed=str(row.indexedAt)
    if(!uri||!/^at:\/\/did:(?:plc|web):[^/]+\/app\.bsky\.feed\.post\/[a-zA-Z0-9]+$/.test(uri)||
      !did||!handle||!text||!stamp||!indexed||!acceptedTime(stamp)||!acceptedTime(indexed))return []
    const id=uri.split('/').at(-1)!
    // Prefer DID-based permalink rather than a mutable human-readable handle.
    return [{id:'bluesky:'+uri,platform:'bluesky' as const,author:did,text,
      publishedAt:stamp,sourceUrl:'https://bsky.app/profile/'+encodeURIComponent(did)+'/post/'+id}]
  })
}
export async function readPublicBlueskySearch(input:Readonly<{
  query:string
  permission:SocialAlphaPermission
  now:()=>string
  fetcher?:typeof fetch
  limit?:number
}>):Promise<SocialAlphaBatch>{
  if(input.permission.source!=='bluesky'||input.permission.access!=='PUBLIC_APPVIEW'||
    !input.permission.termsApproved||!input.permission.ownerEnabled)
    throw new Error('shark_social_alpha_access_not_approved')
  const limit=input.limit??10
  if(!Number.isInteger(limit)||limit<1||limit>25||!input.query.trim()||input.query.length>120)
    throw new Error('shark_social_alpha_query_invalid')
  const url=new URL('https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts')
  url.searchParams.set('q',input.query.trim())
  url.searchParams.set('sort','latest')
  url.searchParams.set('limit',String(limit))
  const collected=input.now()
  if(!acceptedTime(collected))throw new Error('shark_social_alpha_capture_clock_invalid')
  const response=await (input.fetcher??fetch)(url.toString(),{
    headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(8000),
  })
  if(!response.ok)throw new Error('shark_social_alpha_bluesky_unavailable')
  const body=await response.text()
  if(body.length>160_000)throw new Error('shark_social_alpha_bluesky_oversize')
  const posts=normalizePublicBlueskyPosts(JSON.parse(body))
  const available=input.now()
  return admitApprovedSocialAlpha({
    permission:input.permission,posts,collectedAt:collected,availableAt:available,
  })
}
