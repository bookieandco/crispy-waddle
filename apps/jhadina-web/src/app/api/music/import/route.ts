import { NextRequest, NextResponse } from "next/server";
import { InMemoryMusicRepository, normalizeYouTubeMusicImport } from "@jhadina/music-core";
import type { YouTubeMusicTrackInput } from "@jhadina/music-core";

const music = new InMemoryMusicRepository();

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id")?.trim() || null;
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json() as { sourceId?: string; tracks?: YouTubeMusicTrackInput[] };
    if (!body.sourceId || !Array.isArray(body.tracks)) {
      return NextResponse.json({ error: "sourceId and tracks are required" }, { status: 400 });
    }
    const imported = normalizeYouTubeMusicImport(body.sourceId, body.tracks);
    for (const artist of imported.artists) await music.upsertArtist(userId, artist);
    for (const track of imported.tracks) await music.upsertTrack(userId, track);
    await music.upsertSource({ id: imported.sourceId, userId, kind: "youtube_music", name: "YouTube Music", authorized: true, metadata: { importedAt: new Date().toISOString() } });
    return NextResponse.json({ success: true, data: { tracks: imported.tracks, artists: imported.artists, playlistNames: imported.playlistNames, count: imported.tracks.length } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid import" }, { status: 400 });
  }
}
