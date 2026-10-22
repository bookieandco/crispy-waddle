/**
 * One inventory for onboarding, not a claim that an external account is linked.
 * Official provider permissions and an authenticated live read are the only proof
 * that a source is usable. Publishing registry entries are never feed consent.
 */
export type SocialFeedTarget = {
  id: "youtube" | "facebook" | "instagram" | "tiktok" | "reddit" | "x" |
    "threads" | "snapchat" | "linkedin" | "bluesky" | "mastodon" |
    "pinterest" | "tumblr" | "github"
  label: string
  canRead: string
  limitation: string
  setup: "youtube_oauth" | "social_registry" | "public_preview" | "provider_app_required"
}

export const SOCIAL_FEED_TARGETS: readonly SocialFeedTarget[] = [
  {id:"youtube",label:"YouTube",setup:"youtube_oauth",canRead:"Subscribed-channel uploads after Google OAuth",
   limitation:"The YouTube personalized Home and Shorts recommendation feeds are not exposed by this integration."},
  {id:"facebook",label:"Facebook",setup:"social_registry",canRead:"Eligible owned Facebook Pages with approved Meta app permissions",
   limitation:"Not your private friends' News Feed or personal Facebook timeline."},
  {id:"instagram",label:"Instagram",setup:"social_registry",canRead:"Eligible owned Instagram professional media",
   limitation:"Not the private following, Explore, or Reels recommendation feeds."},
  {id:"tiktok",label:"TikTok",setup:"provider_app_required",canRead:"Your own public creator videos after approved Login Kit and video.list consent",
   limitation:"Not TikTok's personalized For You or Following timeline."},
  {id:"reddit",label:"Reddit",setup:"provider_app_required",canRead:"Eligible posts from communities within an approved API use case",
   limitation:"App approval, privacy boundaries, and quotas apply."},
  {id:"x",label:"X",setup:"provider_app_required",canRead:"Account or posts permitted by the applicable X API access tier",
   limitation:"Personal For You timeline access is not assumed; provider approval or fees may apply."},
  {id:"threads",label:"Threads",setup:"provider_app_required",canRead:"Eligible account and post data with approved Meta permissions",
   limitation:"Not an unrestricted Following or For You feed."},
  {id:"snapchat",label:"Snapchat",setup:"provider_app_required",canRead:"Supported public or creator-profile content when provider-approved",
   limitation:"Not your private friends' Stories or chat inbox."},
  {id:"linkedin",label:"LinkedIn",setup:"provider_app_required",canRead:"Approved member or organization content",
   limitation:"Access to the private LinkedIn home timeline is not assumed."},
  {id:"bluesky",label:"Bluesky",setup:"public_preview",canRead:"Public posts from an author you specify",
   limitation:"The preview is not a connected Following feed or saved subscription."},
  {id:"mastodon",label:"Mastodon",setup:"public_preview",canRead:"Public posts from an author on the supported instance",
   limitation:"Private timelines require separate instance and authorization handling."},
  {id:"pinterest",label:"Pinterest",setup:"provider_app_required",canRead:"Approved account, board, and Pin data",
   limitation:"Not the private personalized home recommendations feed."},
  {id:"tumblr",label:"Tumblr",setup:"provider_app_required",canRead:"Public blog posts and authorized account data where permitted",
   limitation:"A private Tumblr dashboard feed is not yet commissioned."},
  {id:"github",label:"GitHub",setup:"public_preview",canRead:"Public user events through GitHub’s official API",
   limitation:"Does not grant account access or show private repositories, notifications, or authenticated activity."},
]

export type FeedReadiness = {label:string;details:string;kind:"ready"|"pending"|"limited"|"error"}

export function feedReadiness(
  target:SocialFeedTarget,
  input:{
    youtubeConnected?:boolean
    youtubeConfigured?:boolean
    youtubeStatusUnavailable?:boolean
    registryUnavailable?:boolean
    registeredProfiles?:readonly {platform:string;status:string}[]
  },
):FeedReadiness {
  if(target.id==="youtube") {
    if(input.youtubeStatusUnavailable)return {label:"Status unavailable",details:"No permission inferred.",kind:"error"}
    if(input.youtubeConfigured===false)return {label:"Developer setup required",details:"Google OAuth must be configured before consent.",kind:"pending"}
    if(input.youtubeConnected)return {label:"Authorized in this browser",details:"Check real upload results in Home; a cookie alone is not proof of a successful provider read.",kind:"ready"}
    return {label:"Your sign-in required",details:"Connect with Google to authorize read-only access.",kind:"pending"}
  }
  if(target.setup==="public_preview")
    return {label:"Public preview available",details:"No account is linked and posts are not saved.",kind:"limited"}
  if(target.setup==="social_registry") {
    if(input.registryUnavailable)return {label:"Registry unavailable",details:"Provider grants cannot be verified.",kind:"error"}
    const count=(input.registeredProfiles??[]).filter(profile=>
      profile.platform.toLowerCase()===target.id && profile.status==="connected").length
    if(count>0)return {label:`${count} registered profile${count===1?"":"s"}`,details:"Social publishing registry only. Live feed read permission is still unverified.",kind:"limited"}
  }
  return {label:"Provider approval needed",details:"No owner-authorized live feed connection has been established.",kind:"pending"}
}
