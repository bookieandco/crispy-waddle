import {normalizeFeedCandidate,type ExternalFeedCandidate} from "./connected-source-contract"

/**
 * JH-UX2.06 official Meta Graph payload normalizers.
 * This is deliberately NOT an OAuth client or a Facebook Home scraper.
 * The caller must independently prove the authenticated owner has the
 * correct Page/Instagram Professional account grants before invocation.
 */
type PagePost={id?:string;message?:string;created_time?:string;permalink_url?:string}
type InstagramMedia={id?:string;caption?:string;timestamp?:string;permalink?:string;media_type?:string}
type GraphList<T>={data?:T[];paging?:unknown;error?:unknown}
const valid=(id:string)=>/^[0-9]{1,40}$/.test(id)
function bounded(input:unknown,max:number){
  return typeof input==="string"?input.trim().slice(0,max):""
}
export function normalizeAuthorizedMetaPagePosts(
  input:{pageId:string;pageName:string;response:GraphList<PagePost>;providerEvidenceId:string},
):ExternalFeedCandidate[]{
  if(!valid(input.pageId) || !input.providerEvidenceId.startsWith("meta-graph:"))
    throw Error("META_PAGE_OWNER_EVIDENCE_REQUIRED")
  if(input.response.error)throw Error("META_GRAPH_RESPONSE_ERROR")
  if(!Array.isArray(input.response.data))throw Error("META_GRAPH_RESPONSE_INVALID")
  return input.response.data.slice(0,25).flatMap(post=>{
    try{
      if(!post.id?.startsWith(input.pageId+"_") || !post.message)return []
      const title=bounded(post.message,110)
      return [normalizeFeedCandidate({
        provider:"facebook_page",sourceAccount:input.pageId,externalId:post.id,
        title:bounded(input.pageName,80)+": "+title,
        summary:bounded(post.message,3000),
        occurredAt:post.created_time,url:post.permalink_url,
        provenance:[input.providerEvidenceId,"meta-graph:owned-page-post"],
      },"internal")]
    }catch{return []}
  })
}
export function normalizeAuthorizedInstagramMedia(
  input:{accountId:string;accountName:string;response:GraphList<InstagramMedia>;providerEvidenceId:string},
):ExternalFeedCandidate[]{
  if(!valid(input.accountId) || !input.providerEvidenceId.startsWith("meta-graph:"))
    throw Error("META_IG_OWNER_EVIDENCE_REQUIRED")
  if(input.response.error)throw Error("META_GRAPH_RESPONSE_ERROR")
  if(!Array.isArray(input.response.data))throw Error("META_GRAPH_RESPONSE_INVALID")
  return input.response.data.slice(0,25).flatMap(post=>{
    try{
      if(!post.id || !valid(post.id))return []
      const summary=bounded(post.caption,3000)
      return [normalizeFeedCandidate({
        provider:"instagram_professional",sourceAccount:input.accountId,externalId:post.id,
        title:bounded(input.accountName,80)+": "+(summary?summary.slice(0,100):bounded(post.media_type,80)+" post"),
        summary:summary || "Instagram Professional media; no caption supplied",
        occurredAt:post.timestamp,url:post.permalink,
        provenance:[input.providerEvidenceId,"meta-graph:owned-professional-media"],
      },"internal")]
    }catch{return []}
  })
}
