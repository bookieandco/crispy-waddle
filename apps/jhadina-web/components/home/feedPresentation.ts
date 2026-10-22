import type { FeedSource, Story } from "./storyTypes"
import {balancedSourceMix} from "./superFeedMixer"

export type FeedView = "updates" | "social" | "watch" | "work"
const socialSources = new Set<FeedSource>(["Social","TikTok","Facebook","Snapchat","Instagram","Reddit","X","LinkedIn","Threads","Bluesky","Mastodon","GitHub","Tumblr","VK"])
const watchSources = new Set<FeedSource>(["YouTube","JhadinaTV"])

export function storyInView(story: Story, view: FeedView): boolean {
  if(view==="updates") return true
  if(view==="social") return socialSources.has(story.source)
  if(view==="watch") return watchSources.has(story.source)
  return !socialSources.has(story.source) && !watchSources.has(story.source)
}
function stamp(story: Story): number {
  const parsed=Date.parse(story.occurredAt??"")
  return Number.isFinite(parsed)?parsed:-1
}
export type FeedOrdering = "latest" | "balanced"

export function selectHomeStories(stories: readonly Story[], view: FeedView, platform: FeedSource="All", ordering: FeedOrdering="latest"): Story[] {
  const seen=new Set<string>()
  const sorted=stories.filter(story=>{
    if(story.isShortcut || !storyInView(story,view) || (platform!=="All" && story.source!==platform)) return false
    const key=story.source+":"+story.id
    if(seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a,b)=>stamp(b)-stamp(a))
  if(ordering==="latest")return sorted
  return balancedSourceMix(sorted,{minPerSource:2,maxStreak:2})
}

/** Owner-local filtering from SocialManager's unified-feed UX; no tracking or provider requests. */
export function searchHomeStories(stories:readonly Story[],query:string):Story[]{
 const needle=query.trim().slice(0,80).toLocaleLowerCase()
 if(!needle)return [...stories]
 return stories.filter(s=>(s.title+" "+s.body+" "+s.source).toLocaleLowerCase().includes(needle))
}
