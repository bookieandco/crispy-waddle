import { createHash } from 'node:crypto';
import type { JtvStreamMode } from './stream-capability';

export interface JtvJellyfinAccess {
  serverUrl: string;
  apiKey: string;
  userId: string;
  rightsEvidenceIds: string[];
}

export function jtvEvidenceFingerprint(ids: readonly string[]): string {
  return createHash('sha256').update(JSON.stringify([...ids].sort())).digest('hex');
}

/** Re-check the configured Jellyfin user's actual catalog entitlement for this exact asset. */
export async function jellyfinAssetIsAccessible(config: JtvJellyfinAccess, assetId: string, mode: JtvStreamMode): Promise<boolean> {
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(assetId)) return false;
  const base = new URL(config.serverUrl);
  if (base.protocol !== 'https:') return false;
  const path = mode === 'vod'
    ? `/Users/${encodeURIComponent(config.userId)}/Items/${encodeURIComponent(assetId)}`
    : '/LiveTv/Channels';
  const url = new URL(path, base);
  if (mode === 'live') url.searchParams.set('UserId', config.userId);
  if (url.origin !== base.origin) return false;
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'X-Emby-Token': config.apiKey },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    const body = await response.json() as { Id?: unknown; Items?: Array<{ Id?: unknown }> };
    return mode === 'vod'
      ? body.Id === assetId
      : Array.isArray(body.Items) && body.Items.some((channel) => channel.Id === assetId);
  } catch {
    return false;
  }
}
