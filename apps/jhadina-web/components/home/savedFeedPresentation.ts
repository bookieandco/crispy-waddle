import type {Story,FeedSource} from "./storyTypes"

type Provider = "youtube"|"facebook_page"|"instagram_professional"|"tiktok_creator"|"reddit"|"bluesky"|"mastodon"
type Candidate = {
 provider:Provider;sourceAccount:string;externalId:string;title:string;summary:string;
 occurredAt:string;url:string;provenance:readonly string[];sourceTrust:"provider_verified"|"owner_unverified"
}
export type SavedFeedRead = {ok?:boolean;durable?:boolean;items?:unknown;status?:string}
const sourceByProvider:Record<Provider,Exclude<FeedSource,"All">>={
 youtube:"YouTube",facebook_page:"Facebook",instagram_professional:"Instagram",
 tiktok_creator:"TikTok",reddit:"Reddit",bluesky:"Bluesky",mastodon:"Social",
}
const allowedHosts:Record<Provider,readonly string[]>={
 youtube:["youtube.com","youtu.be"],facebook_page:["facebook.com"],
 instagram_professional:["instagram.com"],tiktok_creator:["tiktok.com"],
 reddit:["reddit.com","redd.it"],bluesky:["bsky.app"],mastodon:["mastodon.social"],
}
function validCandidate(raw:unknown):raw is Candidate{
 if(!raw||typeof raw!=="object")return false
 const c=raw as Partial<Candidate>
 if(!c.provider||!Object.prototype.hasOwnProperty.call(sourceByProvider,c.provider)||c.sourceTrust!=="provider_verified")return false
 if(typeof c.externalId!=="string"||!c.externalId||typeof c.sourceAccount!=="string"||!c.sourceAccount||
    typeof c.title!=="string"||!c.title||typeof c.summary!=="string"||!c.summary||
    typeof c.occurredAt!=="string"||!Number.isFinite(Date.parse(c.occurredAt))||
    !Array.isArray(c.provenance)||typeof c.url!=="string")return false
 try{
  const url=new URL(c.url)
  const hosts=allowedHosts[c.provider]
  return url.protocol==="https:"&&!url.username&&!url.password&&hosts.some(h=>url.hostname===h||url.hostname.endsWith("."+h))
 }catch{return false}
}
/** Only display valid saved evidence returned by the owner-scoped route. No fake posts. */
export function presentSavedFeed(input:SavedFeedRead):Story[]{
 if(input.ok!==true||input.durable!==true||!Array.isArray(input.items))return []
 const seen=new Set<string>()
 return input.items.slice(0,25).flatMap(raw=>{
  if(!validCandidate(raw))return []
  const key=raw.provider+":"+raw.sourceAccount+":"+raw.externalId
  if(seen.has(key))return []
  seen.add(key)
  const source=sourceByProvider[raw.provider]
  return [{
   id:"saved-feed:"+key,source,kind:source==="YouTube"?"youtube" as const:"social" as const,
   title:raw.title,body:raw.summary.slice(0,800),occurredAt:raw.occurredAt,
   age:"Saved provider update · "+new Date(raw.occurredAt).toLocaleDateString(),
   action:{label:"Open original",href:raw.url},
   details:[{label:"Provider",value:raw.provider},{label:"Account",value:raw.sourceAccount},
    {label:"Source trust",value:"Provider response · owner-scoped storage"},
    {label:"Provenance",value:raw.provenance.slice(0,3).join(" · ")||"Provider response"}],
  } satisfies Story]
 })
}
