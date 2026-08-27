import type { MediaAsset, MusicSource, Track, SourceAssetResolver } from "@jhadina/music-core";
import { createClient } from "@/lib/supabase/client";

/**
 * Resolves only assets already persisted for the current user/source.
 * Provider credentials and arbitrary URLs never cross this boundary.
 */
export class SupabaseSourceAssetResolver implements SourceAssetResolver {
  constructor(private readonly userId: string) {}

  async resolve(source: MusicSource, track: Track): Promise<MediaAsset | null> {
    if (!this.userId || source.userId !== this.userId || !source.authorized) return null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("music_assets")
      .select("id, user_id, track_id, source_id, kind, uri, mime_type, codec, bitrate, lossless, duration_ms, provenance")
      .eq("user_id", this.userId)
      .eq("track_id", track.id)
      .eq("source_id", source.id)
      .limit(1)
      .maybeSingle();

    if (error || !data || data.user_id !== this.userId || data.track_id !== track.id || data.source_id !== source.id) {
      return null;
    }

    return {
      id: data.id,
      trackId: data.track_id,
      sourceId: data.source_id,
      kind: data.kind,
      uri: data.uri,
      mimeType: data.mime_type ?? undefined,
      codec: data.codec ?? undefined,
      bitrate: data.bitrate ?? undefined,
      lossless: data.lossless ?? undefined,
      durationMs: data.duration_ms ?? undefined,
      provenance: data.provenance ?? {},
    };
  }
}
