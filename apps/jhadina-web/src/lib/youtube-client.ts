import { decryptSecret, encryptSecret } from "./youtube-oauth";

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

type Token = { access_token: string; refresh_token?: string; expires_at: number; token_type?: string };

export function serializeYouTubeToken(token: Token) {
  return encryptSecret(JSON.stringify(token));
}

export function deserializeYouTubeToken(value: string): Token {
  return JSON.parse(decryptSecret(value)) as Token;
}

async function refreshToken(token: Token): Promise<Token> {
  if (!token.refresh_token) return token;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: required("GOOGLE_CLIENT_ID"),
      client_secret: required("GOOGLE_CLIENT_SECRET"),
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok || typeof data.access_token !== "string") throw new Error("YouTube token refresh failed");
  return { ...token, access_token: data.access_token, expires_at: Date.now() + Number(data.expires_in ?? 3600) * 1000 };
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export async function authorizedYouTubeFetch<T>(encryptedToken: string, path: string, params: Record<string, string>): Promise<{ data: T; encryptedToken: string }> {
  let token = deserializeYouTubeToken(encryptedToken);
  if (token.expires_at <= Date.now() + 60_000) token = await refreshToken(token);
  const url = new URL(`${YOUTUBE_API}/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" });
  const data = await response.json() as T;
  if (!response.ok) throw new Error(`YouTube API request failed (${response.status})`);
  return { data, encryptedToken: serializeYouTubeToken(token) };
}

export type YouTubeSearchResponse = { items: Array<{ id: { videoId?: string }; snippet: { title: string; channelTitle: string; description: string } }> };

export function mapYouTubeSearchToMusicInput(response: YouTubeSearchResponse) {
  return response.items.flatMap((item) => item.id.videoId ? [{ videoId: item.id.videoId, title: item.snippet.title, artists: [item.snippet.channelTitle] }] : []);
}
