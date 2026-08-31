import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  MediaPlaybackProgress,
  MediaPlaybackProgressRepository,
} from "@jhadina/tv-core"

type MediaPlaybackProgressRow = {
  id: string
  user_id: string
  provider_id: string
  media_id: string
  position_ms: number
  duration_ms: number | null
  completed: boolean
  updated_at: string
  metadata: Record<string, unknown>
}

function rowToProgress(row: MediaPlaybackProgressRow): MediaPlaybackProgress {
  return {
    userId: row.user_id,
    providerId: row.provider_id,
    itemId: row.media_id,
    positionMs: row.position_ms,
    durationMs: row.duration_ms ?? undefined,
    completed: row.completed,
    updatedAt: row.updated_at,
  }
}

function nextId(): string {
  return `media_progress_${crypto.randomUUID()}`
}

function assertNoError(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`JHADINA_MEDIA_PLAYBACK_PERSISTENCE_FAILED:${context}:${error.message}`)
}

/**
 * Supabase adapter for MediaPlaybackProgressRepository.
 *
 * This remains outside Media Core: the core contract knows nothing about
 * Supabase, credentials, or database row naming. The caller must provide the
 * existing service-role client used by Jhadina's persistence boundary.
 */
export class SupabaseMediaPlaybackProgressRepository
  implements MediaPlaybackProgressRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async get(
    userId: string,
    providerId: string,
    itemId: string,
  ): Promise<MediaPlaybackProgress | null> {
    const { data, error } = await this.client
      .from("media_playback_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("provider_id", providerId)
      .eq("media_id", itemId)
      .maybeSingle()

    assertNoError(error, "get")
    return data ? rowToProgress(data as MediaPlaybackProgressRow) : null
  }

  async upsert(progress: MediaPlaybackProgress): Promise<MediaPlaybackProgress> {
    const row: MediaPlaybackProgressRow = {
      id: nextId(),
      user_id: progress.userId,
      provider_id: progress.providerId,
      media_id: progress.itemId,
      position_ms: Math.max(0, Math.trunc(progress.positionMs)),
      duration_ms:
        progress.durationMs === undefined
          ? null
          : Math.max(0, Math.trunc(progress.durationMs)),
      completed: progress.completed,
      updated_at: progress.updatedAt,
      metadata: {},
    }

    const { data, error } = await this.client
      .from("media_playback_progress")
      .upsert(row, { onConflict: "user_id,provider_id,media_id" })
      .select("*")
      .single()

    assertNoError(error, "upsert")
    return rowToProgress(data as MediaPlaybackProgressRow)
  }
}
