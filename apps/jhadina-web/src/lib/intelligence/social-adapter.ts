import type { RawObservation } from "./observation"

export type SocialPlatform = "x" | "instagram" | "tiktok" | "facebook" | "youtube" | "bluesky" | "reddit" | "mastodon"

export type SocialCollectionRequest = {
  platform: SocialPlatform
  accountUrl?: string
  query?: string
  since?: string
  limit?: number
}

export type SocialPost = {
  id: string
  platform: SocialPlatform
  authorId?: string
  authorName?: string
  url: string
  publishedAt: string
  text: string
  engagement?: {
    likes?: number
    comments?: number
    shares?: number
    views?: number
  }
  mediaUrls?: string[]
}

export interface SocialSourceAdapter {
  readonly platform: SocialPlatform
  collect(request: SocialCollectionRequest): Promise<SocialPost[]>
}

export function socialPostToObservation(post: SocialPost, collector: string): RawObservation {
  return {
    id: `social:${post.platform}:${post.id}`,
    sourceId: `social:${post.platform}`,
    url: post.url,
    capturedAt: new Date().toISOString(),
    content: post.text,
    contentHash: `pending:${post.id}`,
    collector,
    status: "new",
    metadata: {
      platform: post.platform,
      authorId: post.authorId ?? "",
      authorName: post.authorName ?? "",
      publishedAt: post.publishedAt,
      likes: post.engagement?.likes ?? 0,
      comments: post.engagement?.comments ?? 0,
      shares: post.engagement?.shares ?? 0,
      views: post.engagement?.views ?? 0,
    },
  }
}
