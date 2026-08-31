import type { MediaPlaybackProgress, MediaPlaybackProgressRepository } from "@jhadina/tv-core"

/** Client-safe persistence adapter. Privileged Supabase credentials never cross this boundary. */
export class ClientMediaPlaybackProgressRepository implements MediaPlaybackProgressRepository {
  async get(userId: string, providerId: string, itemId: string): Promise<MediaPlaybackProgress | null> {
    const response = await fetch("/api/media/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "get", userId, providerId, itemId }),
    })
    if (!response.ok) throw new Error(`JHADINA_MEDIA_PLAYBACK_REQUEST_FAILED:get:${response.status}`)
    const payload = (await response.json()) as { progress: MediaPlaybackProgress | null }
    return payload.progress ?? null
  }

  async upsert(progress: MediaPlaybackProgress): Promise<MediaPlaybackProgress> {
    const response = await fetch("/api/media/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "upsert", progress }),
    })
    if (!response.ok) throw new Error(`JHADINA_MEDIA_PLAYBACK_REQUEST_FAILED:upsert:${response.status}`)
    const payload = (await response.json()) as { progress: MediaPlaybackProgress }
    return payload.progress
  }
}
