import type { SocialPost } from "./social-adapter"
import { scoreRelevance, type TopicProfile } from "./relevance"
import { toDailyLogItem, type DailyLogItem } from "./daily-log"

export type SocialPipelineResult = {
  post: SocialPost
  items: DailyLogItem[]
}

/**
 * Converts already-collected public/authorized social posts into OS-scoped
 * daily-log items. Collection itself remains the responsibility of adapters.
 */
export function processSocialPost(
  post: SocialPost,
  profiles: TopicProfile[],
): SocialPipelineResult {
  const signals = scoreRelevance(post.text, profiles)
  const items = signals.map((signal, index) =>
    toDailyLogItem({
      id: `${post.platform}:${post.id}:${signal.domain}:${index}`,
      title: `${post.platform} signal: ${signal.matchedTopics.join(", ") || "relevant content"}`,
      summary: post.text.slice(0, 500),
      evidenceIds: [`social:${post.platform}:${post.id}`],
      signal,
    }),
  )

  return { post, items }
}
