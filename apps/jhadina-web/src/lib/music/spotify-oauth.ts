import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/youtube-oauth";

export const SPOTIFY_PENDING_COOKIE = "jhadina_spotify_pending";
export const SPOTIFY_ACCESS_COOKIE = "jhadina_spotify_access";
export const SPOTIFY_REFRESH_COOKIE = "jhadina_spotify_refresh";
export interface PendingSpotifyAuth { userId: string; state: string; verifier: string; createdAt: number; }
export interface SpotifyAuthGrant { userId: string; accessToken: string; refreshToken?: string; expiresAt: number; scope: string; }
interface SpotifyTokenReply {
  access_token: string; refresh_token?: string; expires_in: number; scope?: string; token_type: string;
}

function clientId() {
  const id = process.env.SPOTIFY_CLIENT_ID?.trim();
  if (!id) throw new Error("SPOTIFY_CLIENT_ID is not configured");
  return id;
}
export function spotifyRedirectUri() {
  const uri = process.env.SPOTIFY_REDIRECT_URI
    || `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")}/api/auth/spotify/callback`;
  const url = new URL(uri);
  if ((url.protocol !== "https:" && url.hostname !== "127.0.0.1") || url.username || url.password)
    throw new Error("Spotify redirect origin must be HTTPS or explicit loopback");
  return url.toString();
}
export function createSpotifyPending(userId: string, now = Date.now()): PendingSpotifyAuth {
  if (!userId) throw new Error("Authenticated Jhadina identity required");
  return { userId, state: randomBytes(32).toString("base64url"),
    verifier: randomBytes(64).toString("base64url"), createdAt: now };
}
export function spotifyAuthorizeUrl(pending: PendingSpotifyAuth) {
  const challenge = createHash("sha256").update(pending.verifier).digest("base64url");
  return "https://accounts.spotify.com/authorize?" + new URLSearchParams({
    response_type: "code", client_id: clientId(), redirect_uri: spotifyRedirectUri(),
    scope: ["user-read-private","playlist-read-private","playlist-read-collaborative"].join(" "),
    state: pending.state, code_challenge_method: "S256", code_challenge: challenge,
  });
}
export function sealSpotify<T extends object>(value: T): string { return encryptSecret(JSON.stringify(value)); }
export function unsealSpotify<T>(value: string): T { return JSON.parse(decryptSecret(value)) as T; }
export function validateSpotifyPending(pending: PendingSpotifyAuth, state: string, userId: string, now = Date.now()) {
  const actual = Buffer.from(pending.state);
  const received = Buffer.from(state);
  if (pending.userId !== userId || now < pending.createdAt || now - pending.createdAt > 600000
    || actual.length !== received.length || !timingSafeEqual(actual, received)) {
    throw new Error("Spotify OAuth state or user session mismatch");
  }
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(pending.verifier)) throw new Error("Invalid PKCE verifier");
}
async function exchange(body: URLSearchParams): Promise<SpotifyTokenReply> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  if (!response.ok) throw new Error(response.status === 400 ? "Spotify grant expired or revoked" : "Spotify token exchange unavailable");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object") throw new Error("Malformed Spotify token exchange");
  const token = data as Partial<SpotifyTokenReply>;
  if (typeof token.access_token !== "string" || token.token_type?.toLowerCase() !== "bearer"
    || !Number.isFinite(token.expires_in) || (token.expires_in ?? 0) <= 0) throw new Error("Spotify token response incomplete");
  return token as SpotifyTokenReply;
}
export async function exchangeSpotifyCode(code: string, pending: PendingSpotifyAuth, now = Date.now()): Promise<SpotifyAuthGrant> {
  const token = await exchange(new URLSearchParams({
    grant_type: "authorization_code", code, client_id: clientId(),
    redirect_uri: spotifyRedirectUri(), code_verifier: pending.verifier,
  }));
  return { userId: pending.userId, accessToken: token.access_token, refreshToken: token.refresh_token,
    expiresAt: now + token.expires_in * 1000, scope: token.scope ?? "" };
}
export async function refreshSpotifyGrant(previous: SpotifyAuthGrant, now = Date.now()): Promise<SpotifyAuthGrant> {
  if (!previous.refreshToken) throw new Error("Spotify reconnection required");
  const token = await exchange(new URLSearchParams({
    grant_type: "refresh_token", refresh_token: previous.refreshToken, client_id: clientId(),
  }));
  return { userId: previous.userId, accessToken: token.access_token,
    refreshToken: token.refresh_token ?? previous.refreshToken,
    expiresAt: now + token.expires_in * 1000, scope: token.scope ?? previous.scope };
}
export function spotifyAccessCookieOptions(expiresAt: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const, path: "/api", maxAge: Math.max(1, Math.floor((expiresAt - Date.now())/1000)) };
}
export function spotifyRefreshCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const, path: "/api", maxAge: 60 * 60 * 24 * 180 };
}
