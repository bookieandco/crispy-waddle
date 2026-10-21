import type { FeedSource, Story } from "./storyTypes"

export type FeedView = "updates" | "social" | "watch" | "work"
const socialSources = new Set<FeedSource>(["Social","TikTok","Facebook","Snapchat","Instagram","Reddit","X","LinkedIn","Threads","Bluesky","Tumblr","VK"])
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
export function selectHomeStories(stories: readonly Story[], view: FeedView, platform: FeedSource="All"): Story[] {
  const seen=new Set<string>()
  return stories.filter(story=>{
    if(story.isShortcut || !storyInView(story,view) || (platform!=="All" && story.source!==platform)) return false
    const key=story.source+":"+story.id
    if(seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a,b)=>stamp(b)-stamp(a))
}
