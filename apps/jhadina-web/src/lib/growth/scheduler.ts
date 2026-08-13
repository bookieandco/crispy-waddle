export type SocialNetwork = "instagram" | "facebook" | "tiktok" | "youtube" | "x"

export type ScheduledPost = {
  id: string
  contentId: string
  networks: SocialNetwork[]
  publishAt: string
  timezone: string
  status: "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED"
  approvalRequired: boolean
  createdAt: string
}

export function createSchedule(input: Omit<ScheduledPost, "id" | "createdAt" | "status">): ScheduledPost {
  if (!input.networks.length) throw new Error("Select at least one social network")
  if (Number.isNaN(Date.parse(input.publishAt))) throw new Error("publishAt must be a valid ISO timestamp")
  return {
    ...input,
    id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: "SCHEDULED",
    createdAt: new Date().toISOString(),
  }
}

export function dueForPublishing(posts: ScheduledPost[], now = new Date()) {
  return posts.filter(post => post.status === "SCHEDULED" && Date.parse(post.publishAt) <= now.getTime())
}

export function cancelSchedule(post: ScheduledPost): ScheduledPost {
  if (post.status !== "SCHEDULED") throw new Error("Only scheduled posts can be cancelled")
  return { ...post, status: "CANCELLED" }
}
