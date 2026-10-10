import { NextRequest, NextResponse } from "next/server";
import { SpotifyWebApiProvider } from "@jhadina/music-core";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { musicRouteError } from "@/lib/music/music-route-error";
import { attachSpotifySession, spotifySessionForRequest } from "@/lib/music/spotify-cookie-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json({ success: false, error: "Cross-origin import denied" }, { status: 403 });
  try {
    const { userId, repository } = await authenticatedMusicScope();
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json({ success: false, error: "Valid import request required" }, { status: 400 });
    const { playlistId } = body as { playlistId?: unknown };
    if (typeof playlistId !== "string" || !/^[A-Za-z0-9]{1,64}$/.test(playlistId))
      return NextResponse.json({ success: false, error: "Valid Spotify playlist ID required" }, { status: 400 });

    // Refresh occurs before catalog import. A provider 403, timeout, or a database
    // failure must not discard a newly rotated refresh token.
    const { grant, renewed } = await spotifySessionForRequest(req, userId);
    let response: NextResponse;
    try {
      const provider = new SpotifyWebApiProvider({
        clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
        redirectUri: process.env.SPOTIFY_REDIRECT_URI ?? "",
      }, { accessToken: grant.accessToken, expiresAt: grant.expiresAt }, repository);
      const playlist = await provider.importPlaylist(userId, playlistId);
      response = NextResponse.json({ success: true, data: {
        playlistId: playlist.id, count: playlist.trackIds.length, playbackAuthorized: false,
      } }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const permissionDenied = /\b(401|403|404)\b/.test(message) || message.includes("unavailable; access");
      response = NextResponse.json({ success: false, error: permissionDenied
        ? "This Spotify playlist is unavailable to your connected account"
        : "Spotify catalog import could not be completed" },
        { status: permissionDenied ? 403 : 503, headers: { "Cache-Control": "no-store" } });
    }
    if (renewed) attachSpotifySession(response, grant);
    return response;
  } catch (error) {
    if (error instanceof SyntaxError)
      return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    const reason = error instanceof Error ? error.message : "";
    if (reason.includes("reconnection") || reason.includes("expired or revoked"))
      return NextResponse.json({ success: false, error: "Reconnect Spotify to import playlists" }, { status: 401 });
    return musicRouteError(error);
  }
}
