import {normalizeFeedCandidate,type ExternalFeedCandidate} from "./connected-source-contract"

type Fetcher=typeof fetch
const maxItems=10
const readJSON=async(url:URL,fetcher:Fetcher)=>{
  const response=await fetcher(url,{method:"GET",cache:"no-store",headers:{"accept":"application/json"},signal:AbortSignal.timeout(7000)})
  if(!response.ok)throw Error("PUBLIC_FEED_UNAVAILABLE")
  const size=Number(response.headers.get("content-length")??"0")
  if(size>200000)throw Error("PUBLIC_FEED_TOO_LARGE")
  const text=await response.text()
  if(text.length>200000)throw Error("PUBLIC_FEED_TOO_LARGE")
  return JSON.parse(text) as unknown
}
function plain(value:unknown,max:number):string {
  if(typeof value!=="string")return ""
  return value.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,max)
}
export function safePublicHandle(handle:string):string {
  const value=handle.trim().replace(/^@/,"")
  if(!/^[A-Za-z0-9][A-Za-z0-9.-]{1,250}$/.test(value) || value.includes(".."))throw Error("PUBLIC_HANDLE_INVALID")
  return value
}
export async function readBlueskyPublicAuthor(actor:string,fetcher:Fetcher=fetch):Promise<ExternalFeedCandidate[]> {
  const handle=safePublicHandle(actor)
  const url=new URL("https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed")
  url.searchParams.set("actor",handle)
  url.searchParams.set("limit",String(maxItems))
  const body=await readJSON(url,fetcher) as {feed?:unknown[]}
  if(!Array.isArray(body?.feed))throw Error("PUBLIC_FEED_INVALID")
  return body.feed.slice(0,maxItems).flatMap(entry=>{
    try{
      if(!entry || typeof entry!=="object")return []
      const item=entry as {post?:{uri?:string;author?:{handle?:string;displayName?:string};record?:{text?:string;createdAt?:string};indexedAt?:string}}
      const p=item.post
      if(!p?.uri?.startsWith("at://"))return []
      const [, ,did,collection,rkey]=p.uri.split("/")
      if(collection!=="app.bsky.feed.post" || !did?.startsWith("did:") || !rkey || !/^[A-Za-z0-9.-]{1,120}$/.test(rkey))return []
      const author=safePublicHandle(p.author?.handle??"")
      const text=plain(p.record?.text,1500)
      if(!text)return []
      const occurredAt=p.record?.createdAt??p.indexedAt
      return [normalizeFeedCandidate({
        provider:"bluesky",sourceAccount:author,externalId:p.uri,
        title:(p.author?.displayName || author)+": "+text.slice(0,110),summary:text,
        occurredAt,url:"https://bsky.app/profile/"+encodeURIComponent(did)+"/post/"+encodeURIComponent(rkey),
        provenance:["bluesky:public-appview","read-only:author-feed"],
      },"internal")]
    }catch{return []}
  })
}
export async function readMastodonPublicAuthor(input:{handle:string;instance?:string},fetcher:Fetcher=fetch):Promise<ExternalFeedCandidate[]> {
  // Host is deliberately fixed. Arbitrary instance URLs are disallowed to
  // prevent SSRF, redirect rebinding and unreviewed provider contracts.
  const instance=input.instance??"mastodon.social"
  if(instance!=="mastodon.social")throw Error("MASTODON_INSTANCE_NOT_ALLOWLISTED")
  const handle=safePublicHandle(input.handle)
  const lookup=new URL("https://mastodon.social/api/v1/accounts/lookup")
  lookup.searchParams.set("acct",handle)
  const a=await readJSON(lookup,fetcher) as {id?:string;acct?:string;username?:string}
  if(!a || typeof a.id!=="string" || !/^[0-9]{1,32}$/.test(a.id))throw Error("MASTODON_ACCOUNT_UNAVAILABLE")
  const api=new URL("https://mastodon.social/api/v1/accounts/"+a.id+"/statuses")
  api.searchParams.set("limit",String(maxItems))
  api.searchParams.set("exclude_reblogs","true")
  const raw=await readJSON(api,fetcher) as unknown
  if(!Array.isArray(raw))throw Error("PUBLIC_FEED_INVALID")
  return raw.slice(0,maxItems).flatMap(item=>{
    try{
      if(!item || typeof item!=="object")return []
      const post=item as {id?:string;url?:string;content?:string;created_at?:string;visibility?:string}
      if(post.visibility!=="public" || typeof post.id!=="string")return []
      const text=plain(post.content,1500)
      if(!text)return []
      return [normalizeFeedCandidate({
        provider:"mastodon",sourceAccount:a.acct??handle,externalId:post.id,
        title:"@"+(a.username??handle)+": "+text.slice(0,100),summary:text,
        occurredAt:post.created_at,url:post.url,
        provenance:["mastodon:public-account","read-only:statuses"],
      },"internal")]
    }catch{return []}
  })
}
