import type { NextRequest, NextResponse } from "next/server";
import {
  SPOTIFY_ACCESS_COOKIE, SPOTIFY_REFRESH_COOKIE, refreshSpotifyGrant,
  sealSpotify, spotifyAccessCookieOptions, spotifyRefreshCookieOptions,
  unsealSpotify, type SpotifyAuthGrant,
} from "@/lib/music/spotify-oauth";

type StoredAccess = Pick<SpotifyAuthGrant, "userId"|"accessToken"|"expiresAt"|"scope">;
type StoredRefresh = Pick<SpotifyAuthGrant, "userId"|"refreshToken">;
function decode<T>(value: string | undefined): T | null {
  if (!value) return null;
  try { return unsealSpotify<T>(value); } catch { return null; }
}
export function spotifySessionConnected(req: NextRequest, userId: string) {
  const access = decode<StoredAccess>(req.cookies.get(SPOTIFY_ACCESS_COOKIE)?.value);
  const refresh = decode<StoredRefresh>(req.cookies.get(SPOTIFY_REFRESH_COOKIE)?.value);
  return Boolean((access?.userId === userId && access.expiresAt > Date.now())
    || (refresh?.userId === userId && refresh.refreshToken));
}
export async function spotifySessionForRequest(req: NextRequest, userId: string) {
  const access = decode<StoredAccess>(req.cookies.get(SPOTIFY_ACCESS_COOKIE)?.value);
  const refresh = decode<StoredRefresh>(req.cookies.get(SPOTIFY_REFRESH_COOKIE)?.value);
  if (access?.userId === userId && access.expiresAt - Date.now() > 60000) {
    return { grant: { ...access, refreshToken: refresh?.userId === userId ? refresh.refreshToken : undefined } as SpotifyAuthGrant, renewed:false };
  }
  if (refresh?.userId !== userId || !refresh.refreshToken) throw new Error("Spotify reconnection required");
  const current: SpotifyAuthGrant = { userId, accessToken: access?.userId === userId ? access.accessToken : "",
    expiresAt: access?.userId === userId ? access.expiresAt : 0,
    scope: access?.userId === userId ? access.scope : "", refreshToken: refresh.refreshToken };
  const grant = await refreshSpotifyGrant(current);
  return { grant, renewed:true };
}
export function attachSpotifySession(response: NextResponse, grant: SpotifyAuthGrant) {
  response.cookies.set(SPOTIFY_ACCESS_COOKIE, sealSpotify({
    userId:grant.userId, accessToken:grant.accessToken, expiresAt:grant.expiresAt, scope:grant.scope,
  }), spotifyAccessCookieOptions(grant.expiresAt));
  if (grant.refreshToken) response.cookies.set(SPOTIFY_REFRESH_COOKIE, sealSpotify({
    userId:grant.userId, refreshToken:grant.refreshToken,
  }), spotifyRefreshCookieOptions());
  return response;
}
