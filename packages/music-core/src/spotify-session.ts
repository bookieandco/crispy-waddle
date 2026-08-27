export type SpotifySession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

export type SpotifySessionStatus = "connected" | "expired" | "needs_reconnect";

export function createSpotifyAuthorizationState(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function spotifySessionStatus(session: SpotifySession, now = Date.now()): SpotifySessionStatus {
  if (!session.accessToken) return "needs_reconnect";
  if (session.expiresAt !== undefined && session.expiresAt <= now) return session.refreshToken ? "expired" : "needs_reconnect";
  return "connected";
}

export function spotifyAuthorizationScopes(): string[] {
  return ["user-read-private", "user-library-read", "playlist-read-private", "playlist-read-collaborative", "user-read-recently-played"];
}
