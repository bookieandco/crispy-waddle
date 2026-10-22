import type {Story} from "./storyTypes"

/** Convert real, read-only public author results to Home stories.
 * Never infer a private connection from public API output.
 */
export type PublicPreviewProvider="bluesky"|"mastodon"|"github"
export function publicAuthorStories(raw:unknown, provider:PublicPreviewProvider):Story[]{
 if(!Array.isArray(raw))return []
 const source:Story["source"]=provider==="bluesky"?"Bluesky":provider==="mastodon"?"Mastodon":"GitHub"
 const requiredHost=provider==="bluesky"?"bsky.app":provider==="mastodon"?"mastodon.social":"github.com"
 const seen=new Set<string>()
 return raw.slice(0,10).flatMap((entry):Story[]=>{
  if(!entry||typeof entry!=="object"||Array.isArray(entry))return []
  const item=entry as Record<string,unknown>
  if(item.provider!==provider||item.sourceTrust!=="provider_verified")return []
  if(typeof item.sourceAccount!=="string"||!item.sourceAccount||item.sourceAccount.length>200)return []
  if(typeof item.externalId!=="string"||!item.externalId||item.externalId.length>255)return []
  if(typeof item.title!=="string"||!item.title.trim()||item.title.length>300)return []
  if(typeof item.summary!=="string"||!item.summary.trim()||item.summary.length>4000)return []
  if(typeof item.occurredAt!=="string"||item.occurredAt.length>64)return []
  const timestamp=Date.parse(item.occurredAt)
  if(!Number.isFinite(timestamp)||timestamp>Date.now()+300000)return []
  let url:URL
  try{url=new URL(String(item.url))}catch{return []}
  if(url.protocol!=="https:"||url.hostname!==requiredHost||url.username||url.password)return []
  const key=provider+":"+item.externalId
  if(seen.has(key))return []
  seen.add(key)
  const provenance=Array.isArray(item.provenance)
   ?item.provenance.filter((s):s is string=>typeof s==="string"&&s.length<=160).slice(0,3):[]
  return [{
   id:"public-author:"+key,source,kind:"social",title:item.title,body:item.summary,
   occurredAt:new Date(timestamp).toISOString(),age:new Date(timestamp).toLocaleString(),
   action:{label:"View original post",href:url.toString()},
   details:[
    {label:"Author",value:item.sourceAccount},
    {label:"Connection",value:"Public author preview, not a linked account"},
    {label:"Access",value:"Read-only, not stored"},
    {label:"Provenance",value:provenance.join(" · ")||"Official public source"},
   ],
  }]
 })
}
