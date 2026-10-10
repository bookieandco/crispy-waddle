import { NextRequest, NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { musicRouteError } from "@/lib/music/music-route-error";
import { spotifySessionConnected } from "@/lib/music/spotify-cookie-session";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await authenticatedMusicScope();
    return NextResponse.json({ connected: spotifySessionConnected(req, userId), provider: "spotify",
      capability: "catalog_metadata_only" }, { headers: { "Cache-Control":"no-store" } });
  } catch(error) { return musicRouteError(error); }
}
