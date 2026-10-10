import { NextRequest, NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import {
  SPOTIFY_ACCESS_COOKIE, SPOTIFY_PENDING_COOKIE, SPOTIFY_REFRESH_COOKIE,
  exchangeSpotifyCode, sealSpotify, spotifyAccessCookieOptions,
  spotifyRefreshCookieOptions, unsealSpotify, validateSpotifyPending,
  type PendingSpotifyAuth,
} from "@/lib/music/spotify-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const error = req.nextUrl.searchParams.get("error");
  if (error) return NextResponse.redirect(new URL("/music?spotify=denied", req.url));
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const encrypted = req.cookies.get(SPOTIFY_PENDING_COOKIE)?.value;
  if (!code || !state || !encrypted) return NextResponse.json({ error: "Missing Spotify OAuth state" }, { status:400 });
  try {
    const { userId } = await authenticatedMusicScope();
    const pending = unsealSpotify<PendingSpotifyAuth>(encrypted);
    validateSpotifyPending(pending, state, userId);
    const grant = await exchangeSpotifyCode(code, pending);
    const redirect = NextResponse.redirect(new URL("/music?spotify=connected", req.url));
    redirect.cookies.delete({ name: SPOTIFY_PENDING_COOKIE, path: "/api/auth/spotify" });
    redirect.cookies.set(SPOTIFY_ACCESS_COOKIE, sealSpotify({
      userId, accessToken:grant.accessToken, expiresAt:grant.expiresAt, scope:grant.scope,
    }), spotifyAccessCookieOptions(grant.expiresAt));
    if (grant.refreshToken) redirect.cookies.set(SPOTIFY_REFRESH_COOKIE, sealSpotify({
      userId, refreshToken:grant.refreshToken,
    }), spotifyRefreshCookieOptions());
    return redirect;
  } catch {
    // Fail closed: no OAuth error detail or token reaches the browser URL.
    return NextResponse.redirect(new URL("/music?spotify=error", req.url));
  }
}
