/**
 * JH-UX2 read-source contracts. These never grant Social publication authority,
 * model-training permission, or account access just because an app is listed.
 */
export type ExternalFeedPlatform =
  | "youtube" | "facebook_page" | "instagram_professional" | "tiktok_creator"
  | "reddit" | "bluesky" | "mastodon"
export type AutomationBridge = "none" | "make" | "internal" | "n8n" | "activepieces"
export type ConnectionState =
  | "not_configured" | "authorization_required" | "registered"
  | "healthy" | "stale" | "reconnect" | "provider_error" | "disabled"

export type FeedSourceConnection = {
  provider: ExternalFeedPlatform
  identityLabel: string
  state: ConnectionState
  bridge: AutomationBridge
  lastVerifiedAt?: string
  lastSyncAt?: string
  nextRetryAt?: string
  grantedScopes: readonly string[]
  capability: "public_read" | "authorized_owner_read" | "none"
  failureCode?: string
}
export type ExternalFeedCandidate = {
  provider: ExternalFeedPlatform
  sourceAccount: string
  externalId: string
  title: string
  summary: string
  occurredAt: string
  url: string
  provenance: readonly string[]
  // Candidates from orchestration tools remain quarantined until provider
  // authorization and source evidence can be verified independently.
  sourceTrust: "provider_verified" | "workflow_unverified"
  bridge: AutomationBridge
}
export const EXTERNAL_FEED_CATALOG: ReadonlyArray<{
  id: ExternalFeedPlatform
  label: string
  lane: string
  capability: "public_read" | "authorized_owner_read"
  explanation: string
}> = [
  {id:"youtube",label:"YouTube",lane:"Watch",capability:"authorized_owner_read",
    explanation:"Consented subscription activity, not the personalized YouTube Home algorithm"},
  {id:"facebook_page",label:"Facebook Pages",lane:"Social",capability:"authorized_owner_read",
    explanation:"Approved Pages data, not personal friends' Home timelines"},
  {id:"instagram_professional",label:"Instagram Professional",lane:"Social",capability:"authorized_owner_read",
    explanation:"Eligible creator or business media with approved permissions"},
  {id:"tiktok_creator",label:"TikTok",lane:"Social",capability:"authorized_owner_read",
    explanation:"Approved creator media, not For You recommendations"},
  {id:"reddit",label:"Reddit",lane:"Social",capability:"authorized_owner_read",
    explanation:"API access subject to provider approval and restricted use"},
  {id:"bluesky",label:"Bluesky",lane:"Social",capability:"public_read",
    explanation:"Read-only public author posts through AT Protocol AppView"},
  {id:"mastodon",label:"Mastodon",lane:"Social",capability:"public_read",
    explanation:"Read-only public timeline for a verified instance"},
]

export function normalizeFeedCandidate(input:unknown, bridge:AutomationBridge):ExternalFeedCandidate {
  if(!input || typeof input!=="object" || Array.isArray(input))throw Error("FEED_ITEM_INVALID")
  const value=input as Record<string,unknown>
  const provider=EXTERNAL_FEED_CATALOG.find(x=>x.id===value.provider)?.id
  if(!provider)throw Error("FEED_PROVIDER_UNSUPPORTED")
  const bounded=(key:string,max:number)=>{
    const raw=value[key]
    if(typeof raw!=="string" || !raw.trim() || raw.length>max)throw Error("FEED_FIELD_INVALID:"+key)
    return raw.trim()
  }
  const occurredAt=bounded("occurredAt",64)
  const time=Date.parse(occurredAt)
  if(!Number.isFinite(time) || time>Date.now()+300000)throw Error("FEED_TIME_INVALID")
  const rawUrl=bounded("url",1024)
  let url:URL
  try{url=new URL(rawUrl)}catch{throw Error("FEED_URL_INVALID")}
  if(url.protocol!=="https:" || !!url.username || !!url.password)throw Error("FEED_URL_INVALID")
  if(url.hostname==="localhost" || url.hostname.endsWith(".local"))throw Error("FEED_URL_INVALID")
  const claims=Array.isArray(value.provenance)?value.provenance.filter((v):v is string=>typeof v==="string" && v.length<=160).slice(0,8):[]
  return {
    provider,sourceAccount:bounded("sourceAccount",200),externalId:bounded("externalId",255),
    title:bounded("title",300),summary:bounded("summary",4000),
    occurredAt:new Date(time).toISOString(),url:url.toString(),
    provenance:claims,
    sourceTrust:bridge==="make" || bridge==="n8n" || bridge==="activepieces"?"workflow_unverified":"provider_verified",
    bridge,
  }
}

export function connectionCopy(source:FeedSourceConnection):string {
  switch(source.state){
    case "healthy":return source.lastVerifiedAt?"Provider verified "+source.lastVerifiedAt:"Provider access verified"
    case "stale":return "Last source refresh is stale; shown content may be outdated"
    case "reconnect":return "Permission expired or revoked; reconnect required"
    case "provider_error":return "Provider data unavailable; do not show invented posts"
    case "registered":return "Account registered; live access not yet verified"
    case "authorization_required":return "Requires your explicit provider consent"
    case "not_configured":return "Operator setup required"
    case "disabled":return "You have disabled this source"
  }
}
