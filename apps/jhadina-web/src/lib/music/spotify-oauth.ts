import { createSpotifyAuthorizationState, spotifyAuthorizationScopes } from "@jhadina/music-core";

const stateCookie = "jhadina_spotify_oauth_state";

export function spotifyStateCookieName() {
  return stateCookie;
}

export function buildSpotifyAuthorizeUrl(origin: string, state: string): string {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) throw new Error("SPOTIFY_CLIENT_ID is not configured");

  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", new URL("/api/music/spotify/callback", origin).toString());
  url.searchParams.set("scope", spotifyAuthorizationScopes().join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export function createSpotifyOAuthState(): string {
  return createSpotifyAuthorizationState();
}

export async function exchangeSpotifyCode(code: string, origin: string) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Spotify server credentials are not configured");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: new URL("/api/music/spotify/callback", origin).toString(),
  });
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Spotify token exchange failed: ${response.status}`);
  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number; token_type: string; scope: string }>;
}
