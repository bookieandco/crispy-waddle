import type { MediaAsset, MusicSource } from "./types.js";

/** A URI ticket authorizes browser audio only for the matched owner/source/asset.
 * Spotify/YouTube catalog metadata never constitutes a playable ticket.
 */
export interface PlaybackTicket {
  trackId: string;
  sourceId: string;
  sourceUri: string;
  expiresAt?: string;
}
const SENSITIVE_QUERY_KEYS = /^(token|access_token|signature|sig|x-amz-signature|x-goog-signature|policy|key-pair-id)$/i;

export function validatePlaybackAsset(
  userId: string, trackId: string, sources: MusicSource[], asset: MediaAsset,
  nowMs = Date.now(),
): PlaybackTicket | null {
  const source = sources.find(s => s.id === asset.sourceId && s.userId === userId && s.authorized);
  if (!source || asset.trackId !== trackId || asset.provenance?.playbackAuthorized !== true
    || (asset.kind !== "stream" && asset.kind !== "file")) return null;
  if (source.metadata?.role === "catalog-library") return null;
  let url: URL;
  try { url = new URL(asset.uri); } catch { return null; }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.hash
    || /^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[::1\])/i.test(url.hostname)) return null;
  const rawExpiry = asset.provenance?.expiresAt;
  const expiresAt = typeof rawExpiry === "string" ? rawExpiry : undefined;
  if (rawExpiry !== undefined && !expiresAt) return null;
  const expiry = expiresAt === undefined ? null : Date.parse(expiresAt);
  if (expiry !== null && (!Number.isFinite(expiry) || expiry <= nowMs + 15000)) return null;
  // A signed URL without an explicit expiry is not a cache-safe playback grant.
  if (expiry === null && [...url.searchParams.keys()].some(key => SENSITIVE_QUERY_KEYS.test(key))) return null;
  return { trackId, sourceId: asset.sourceId, sourceUri: asset.uri, ...(expiresAt ? { expiresAt } : {}) };
}

/** Refresh proactively, before the browser requests stale audio bytes. */
export function playbackTicketNeedsRefresh(ticket: PlaybackTicket | null, nowMs = Date.now(), headroomMs = 60000) {
  if (!ticket) return true;
  if (!ticket.expiresAt) return false;
  const expiry = Date.parse(ticket.expiresAt);
  return !Number.isFinite(expiry) || expiry - nowMs <= headroomMs;
}
