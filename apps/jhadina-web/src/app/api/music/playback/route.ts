import { NextRequest, NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { musicRouteError } from "@/lib/music/music-route-error";
import { resolveMusicPlayback } from "@/lib/music/music-catalog-operations";
import { resolveOwnedMusicStorage } from "@/lib/music/music-storage-playback";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { userId, repository } = await authenticatedMusicScope();
    const trackId = req.nextUrl.searchParams.get("trackId")?.trim();
    if (!trackId || trackId.length > 256) {
      return NextResponse.json({ success: false, error: "Valid trackId is required" }, { status: 400 });
    }
    const db = await createClient();
    const ownedStorage = await resolveOwnedMusicStorage(repository, userId, trackId, {
      async sign(bucket, path, ttlSeconds) {
        const { data, error } = await db.storage.from(bucket).createSignedUrl(path, ttlSeconds);
        if (error) throw error;
        return data?.signedUrl ?? null;
      },
    });
    const data = ownedStorage ?? await resolveMusicPlayback(repository, userId, trackId);
    if (!data) return NextResponse.json({ success: false, error: "No authorized playable asset for this track" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return musicRouteError(error);
  }
}
