/** Browser-only hints: the backend HMAC/rights check remains authoritative. */
export const STREAM_RENEWAL_LEAD_MS = 5 * 60 * 1000;
export const STREAM_RECOVERY_RETRY_LIMIT = 1;

export function signedStreamExpiryMs(sourceUrl: string): number | null {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== 'https:' || url.pathname !== '/api/jhadinatv/jellyfin/stream') return null;
    const token = url.searchParams.get('token') ?? '';
    if (token.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
    const encoded = token.split('.')[0];
    const parsed = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    if (parsed.v !== 1 || !Number.isSafeInteger(parsed.expiresAt) ||
        typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= 0) return null;
    return parsed.expiresAt * 1000;
  } catch { return null; }
}

export function renewalDelayMs(sourceUrl: string, nowMs = Date.now()): number | null {
  const expires = signedStreamExpiryMs(sourceUrl);
  if (expires === null) return null;
  return Math.max(0, expires - nowMs - STREAM_RENEWAL_LEAD_MS);
}

export function playbackFailureHint(code: number | undefined): string {
  switch (code) {
    case 1: return 'Playback was interrupted. Tap Retry to request a fresh authorized source.';
    case 2: return 'The stream could not be reached. Check your connection, then tap Retry.';
    case 3: return 'Your browser could not decode this stream. Try a supported source or the broadcaster’s player.';
    case 4: return 'This source may be offline, expired, or unsupported on iPhone. Tap Retry to re-check your access.';
    default: return 'Playback stopped. Tap Retry to request a new authorized source.';
  }
}

export function restoredVodPosition(position: number, duration: number): number | null {
  if (!Number.isFinite(position) || position <= 0) return null;
  const limit = Number.isFinite(duration) && duration > 0 ? Math.max(0, duration - 1) : position;
  return Math.min(position, limit);
}
