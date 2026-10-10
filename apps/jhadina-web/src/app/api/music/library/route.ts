import { NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { musicRouteError } from "@/lib/music/music-route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId, repository } = await authenticatedMusicScope();
    const [tracks, artists, albums, playlists, recent] = await Promise.all([
      repository.listTracks(userId), repository.listArtists(userId), repository.listAlbums(userId),
      repository.listPlaylists(userId), repository.listListeningEvents(userId, 40),
    ]);
    // Library returns catalog references only. Provider secrets/asset URLs stay in playback authorization.
    return NextResponse.json({ success: true, data: { tracks, artists, albums, playlists, recent } },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return musicRouteError(error); }
}
