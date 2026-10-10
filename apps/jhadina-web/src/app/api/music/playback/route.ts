import { NextRequest, NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { musicRouteError } from "@/lib/music/music-route-error";
import { resolveMusicPlayback } from "@/lib/music/music-catalog-operations";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { userId, repository } = await authenticatedMusicScope();
    const trackId = req.nextUrl.searchParams.get("trackId")?.trim();
    if (!trackId || trackId.length > 256) {
      return NextResponse.json({ success: false, error: "Valid trackId is required" }, { status: 400 });
    }
    const data = await resolveMusicPlayback(repository, userId, trackId);
    if (!data) return NextResponse.json({ success: false, error: "No authorized playable asset for this track" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return musicRouteError(error);
  }
}
