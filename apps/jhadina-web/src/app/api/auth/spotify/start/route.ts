import { NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { musicRouteError } from "@/lib/music/music-route-error";
import { createSpotifyPending, sealSpotify, SPOTIFY_PENDING_COOKIE, spotifyAuthorizeUrl } from "@/lib/music/spotify-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { userId } = await authenticatedMusicScope();
    const pending = createSpotifyPending(userId);
    const redirect = NextResponse.redirect(spotifyAuthorizeUrl(pending));
    redirect.cookies.set(SPOTIFY_PENDING_COOKIE, sealSpotify(pending), {
      httpOnly:true, secure:process.env.NODE_ENV==="production", sameSite:"lax", path:"/api/auth/spotify", maxAge:600,
    });
    return redirect;
  } catch (error) { return musicRouteError(error); }
}
