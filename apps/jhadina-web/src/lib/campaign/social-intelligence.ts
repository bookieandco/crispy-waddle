export type SocialPlatform =
  | "x"
  | "bluesky"
  | "reddit"
  | "mastodon"
  | "truth_social"
  | "youtube"
  | "instagram"
  | "tiktok"
  | "stocks"
  | "crypto"

export type SocialSubject = {
  id: string
  platform: SocialPlatform
  handle: string
  displayName?: string
  url?: string
  verified?: boolean
  category: "politician" | "organization" | "asset" | "topic"
}

export type SocialPost = {
  id: string
  subjectId: string
  platform: SocialPlatform
  publishedAt: string
  url: string
  text?: string
  title?: string
  engagement?: {
    likes?: number
    replies?: number
    reposts?: number
    views?: number
    quotes?: number
  }
  mediaTypes?: Array<"text" | "image" | "video" | "link" | "audio">
  topics: string[]
  claims?: string[]
  source: "official_api" | "public_feed" | "licensed_provider" | "manual"
}

export type SocialSignal = {
  topic: string
  platformCount: number
  postCount: number
  engagementTotal: number
  direction: "accelerating" | "stable" | "declining" | "mixed"
  evidenceIds: string[]
  confidence: "low" | "medium" | "high"
}

export type DailySocialBrief = {
  generatedAt: string
  windowStart: string
  windowEnd: string
  subjectsReviewed: number
  postsReviewed: number
  signals: SocialSignal[]
  notablePosts: string[]
  verificationQueue: string[]
  limitations: string[]
}

/**
 * Social intelligence is observational. It summarizes public/authorized
 * data and produces evidence for the daily report; it does not automate
 * political persuasion, mass outreach, or individual-level targeting.
 */
export function buildSocialSignal(posts: SocialPost[], topic: string): SocialSignal {
  const relevant = posts.filter((post) => post.topics.includes(topic))
  const platforms = new Set(relevant.map((post) => post.platform))
  const engagementTotal = relevant.reduce((sum, post) => {
    const e = post.engagement
    return sum + (e?.likes ?? 0) + (e?.replies ?? 0) + (e?.reposts ?? 0) + (e?.quotes ?? 0)
  }, 0)

  return {
    topic,
    platformCount: platforms.size,
    postCount: relevant.length,
    engagementTotal,
    direction: relevant.length >= 5 && platforms.size >= 2 ? "accelerating" : "stable",
    evidenceIds: relevant.map((post) => post.id),
    confidence: platforms.size >= 3 ? "high" : platforms.size >= 2 ? "medium" : "low",
  }
}

export function buildDailySocialBrief(
  subjects: SocialSubject[],
  posts: SocialPost[],
  windowStart: string,
  windowEnd: string,
  topics: string[],
): DailySocialBrief {
  const signals = topics.map((topic) => buildSocialSignal(posts, topic))

  return {
    generatedAt: new Date().toISOString(),
    windowStart,
    windowEnd,
    subjectsReviewed: subjects.length,
    postsReviewed: posts.length,
    signals,
    notablePosts: posts
      .filter((post) => (post.engagement?.likes ?? 0) + (post.engagement?.reposts ?? 0) >= 100)
      .slice(0, 10)
      .map((post) => post.id),
    verificationQueue: posts.flatMap((post) => (post.claims ?? []).map((claim) => `${post.id}:${claim}`)),
    limitations: [
      "Engagement is not equivalent to public opinion.",
      "Platform audiences are not representative samples of the electorate or market.",
      "Deleted, private, restricted, or inaccessible content may be missing.",
      "Claims require corroboration against authoritative evidence before being treated as facts.",
    ],
  }
}
