import { NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { musicRouteError } from "@/lib/music/music-route-error";
import { inspectMusicLiveReadiness } from "@/lib/music/music-live-readiness";
import { createClient } from "@/lib/supabase/server";
import { resolveMusicPlayback } from "@/lib/music/music-catalog-operations";
import { resolveOwnedMusicStorage } from "@/lib/music/music-storage-playback";

export const dynamic = "force-dynamic";

/** Owner-visible read-only canary; never returns bearer tokens, bucket paths or raw DB errors. */
export async function GET() {
  try {
    const { userId, repository } = await authenticatedMusicScope();
    const db = await createClient();
    const state = await inspectMusicLiveReadiness(userId, {
      async catalog(id) {
        const { error } = await db.from("music_tracks").select("id").eq("user_id", id).limit(1);
        return !error;
      },
      async checkpoint(id) {
        const { error } = await db.from("music_playback_checkpoints").select("track_id").eq("user_id", id).limit(1);
        return !error;
      },
      async ownedStorage(id) {
        const { error } = await db.storage.from("music-owned").list(id, { limit: 1 });
        return !error;
      },
      async grantedSources(id) {
        const sources = await repository.listSources(id);
        return sources.filter(source => source.userId === id
          && source.authorized && source.metadata?.role !== "catalog-library").length;
      },
      async playbackCandidates(id) {
        // Bounded discovery probe only: one valid ticket is enough to admit a
        // real playback drill. A provider listing alone is not a playable asset.
        const tracks = (await repository.listTracks(id)).slice(0, 50);
        for (const track of tracks) {
          if (await resolveMusicPlayback(repository, id, track.id)) return 1;
          const owned = await resolveOwnedMusicStorage(repository, id, track.id, {
            async sign(bucket, path, expiresIn) {
              const { data, error } = await db.storage.from(bucket).createSignedUrl(path, expiresIn);
              if (error) throw error;
              return data?.signedUrl ?? null;
            },
          });
          if (owned) return 1;
        }
        return 0;
      },
    });
    return NextResponse.json({ success: true, data: state },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return musicRouteError(error);
  }
}
