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
 * Writes go through a database function rather than a client-side upsert.
 * The function performs the conflict comparison atomically, so delayed
 * requests cannot overwrite newer progress after the newer write commits.
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
    const { data, error } = await this.client
      .rpc("upsert_media_playback_progress", {
        p_id: nextId(),
        p_user_id: progress.userId,
        p_provider_id: progress.providerId,
        p_media_id: progress.itemId,
        p_position_ms: Math.max(0, Math.trunc(progress.positionMs)),
        p_duration_ms:
          progress.durationMs === undefined
            ? null
            : Math.max(0, Math.trunc(progress.durationMs)),
        p_completed: progress.completed,
        p_updated_at: progress.updatedAt,
        p_metadata: {},
      })
      .single()

    assertNoError(error, "upsert")
    if (!data) throw new Error("JHADINA_MEDIA_PLAYBACK_PERSISTENCE_FAILED:upsert:no_result")
    return rowToProgress(data as MediaPlaybackProgressRow)
  }
}
