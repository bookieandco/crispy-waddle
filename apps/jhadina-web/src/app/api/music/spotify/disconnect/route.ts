import { NextRequest, NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { musicRouteError } from "@/lib/music/music-route-error";
import { SPOTIFY_ACCESS_COOKIE, SPOTIFY_REFRESH_COOKIE } from "@/lib/music/spotify-oauth";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json({ success:false, error:"Cross-origin disconnect denied" }, { status:403 });
  try {
    await authenticatedMusicScope();
    const response = NextResponse.json({ success:true, locallyDisconnected:true });
    response.cookies.delete({ name:SPOTIFY_ACCESS_COOKIE, path:"/api" });
    response.cookies.delete({ name:SPOTIFY_REFRESH_COOKIE, path:"/api" });
    return response;
  } catch(error) { return musicRouteError(error); }
}
